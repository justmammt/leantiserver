import express from 'express';
const router = express.Router();
import multer from "multer";
const storage = multer({ storage: multer.memoryStorage() });
import { uploadFile, deleteFile, getFileIdByPath } from "../backblaze.js";
import { db } from "../database.js";
import authenticateJWT from "../middlewares/authenticateJWT.js";
import deleteSong from './deleteSong.js';

// Admin Songs Routes
router.post(
  "/songs/create", 
  storage.fields([
    { name: "name", maxCount: 1 },
    { name: "cover", maxCount: 1 },
    { name: "mp3", maxCount: 1 },
    { name: "album_id", maxCount: 1 },
  ]),
  async (req, res) => {
    const artist = req.user.username;
    const artist_id = req.user.user_id;
    const songName = req.body.name;

    if (!req.user.is_artist) {
      return res.status(401).send("Unauthorized");
    }

    if (!req.files?.cover?.[0]) {
      return res.status(400).send("Cover file is required");
    }

    if (!req.files?.mp3?.[0]) {
      return res.status(400).send("MP3 file is required");
    }

    try {
      const createFunction = req.body.album_id === 0 || req.body.album_id === "0" 
        ? "create_song" 
        : "create_song_in_album";
      const params = req.body.album_id === 0 || req.body.album_id === "0"
        ? [songName, artist_id]
        : [songName, artist_id, req.body.album_id];

      const data = await db.func(createFunction, params);

      await Promise.all([
        uploadFile(process.env.BUCKET_ID, req.files.cover[0].buffer, 
          `covers/songs/${data[0][createFunction]}/cover.png`),
        uploadFile(process.env.BUCKET_ID, req.files.mp3[0].buffer,
          `songs/${data[0][createFunction]}/song.mp3`)
      ]);

      return res.status(200).send("Song created successfully!");
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).send(error.detail);
    }
  }
);

router.post("/songs/delete", async (req, res) => {
  try {

    await deleteSong(req.body.id, req, res);
  } catch (error) {
    console.error('Error deleting song:', error);
    return res.status(500).send("Error deleting song");
  }
});

// Admin Albums Routes
router.post(
  "/albums/create", 
  storage.fields([
    { name: "name", maxCount: 1 },
    { name: "cover", maxCount: 1 },
    { name: "release_date", maxCount: 1 },
  ]),
  async (req, res) => {
    const artist_id = req.user.user_id;
    const name = req.body.name.toString();
    const release_date = req.body.release_date;

    if (!req.user.is_artist) {
      return res.status(401).send("Unauthorized");
    }

    if (!req.files?.cover?.[0]) {
      return res.status(400).send("Cover file is required");
    }

    try {
      const data = await db.func("create_album", [name, artist_id, release_date]);
      await uploadFile(
        process.env.BUCKET_ID, 
        req.files.cover[0].buffer,
        `covers/albums/${data[0].create_album}/cover.png`
      );
      return res.status(200).send("Album created successfully!");
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).send(error.detail);
    }
  }
);

router.post("/albums/delete", async (req, res) => {
  const artist_id = req.user.user_id;
  const album_id = req.body.id;

  try {
    const album = await db.one("SELECT * FROM albums WHERE id = $1", [album_id]);
    
    if (album.artist_id !== artist_id) {
      return res.status(401).send("Unauthorized");
    }

    await deleteFile(
      await getFileIdByPath(process.env.BUCKET_ID, album.cover), 
      album.cover
    );
    await db.func("delete_album", [album_id]);
    return res.status(200).send("Album deleted successfully");
  } catch (error) {
    console.error("Error deleting album:", error);
    return res.status(500).send("Error deleting album");
  }
});

// Admin Image Routes
router.post("/image/set", 
  storage.fields([{ name: "image", maxCount: 1 }]), 
  async (req, res) => {
    const artist_id = req.user.user_id;

    try {
      const user = await db.one("SELECT id, cover FROM users WHERE id = $1", [artist_id]);
      
      if (!req.files?.image?.[0]) {
        return res.status(400).send("Image file is required");
      }

      if (user.cover) {
        await deleteFile(
          await getFileIdByPath(process.env.BUCKET_ID, user.cover), user.cover
        );
      }

      await uploadFile(
        process.env.BUCKET_ID, 
        req.files.image[0].buffer,
        `covers/artists/${user.id}/cover.png`
      );
      await db.none("UPDATE users SET cover = $1 WHERE id = $2", [
        `covers/artists/${user.id}/cover.png`,
        user.id
      ]);

      return res.status(200).send("Image uploaded successfully!");
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).send("Error uploading image");
    }
  }
);

export default router;
