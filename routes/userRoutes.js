import express from "express";
const router = express.Router();
import { db } from "../database.js";

router.get("/my/infos", async (req, res) => {
  const userId = req.user.user_id;
  const user = await db.any("SELECT id, username, subscription, is_artist FROM users WHERE id = $1", [userId]);
  return res.status(200).json(user[0]);
});

router.get("/my/albums", async (req, res) => {
  const userId = req.user.user_id;
  const albums = await db.any("SELECT id, name FROM albums WHERE artist_id = $1", [userId]);
  return res.status(200).json(albums);
});

router.get("/my/songs", async (req, res) => {
  const userId = req.user.user_id;
  const songs = await db.any("SELECT id, name FROM songs WHERE artist_id = $1 AND album_id is NULL", [userId]);
  return res.status(200).json(songs);
});

router.get("/my/songs/:albumId", async (req, res) => {
  const userId = req.user.user_id;
  const albumId = req.params.albumId;
  const songs = await db.any("SELECT id, name FROM songs WHERE artist_id = $1 AND album_id = $2", [userId, albumId]);
  return res.status(200).json(songs);
});

router.get("/my/playlists", async (req, res) => {
  const userId = req.user.user_id;
  const playlists = await db.any("SELECT id, name FROM playlists WHERE user_id = $1", [userId]);
  if (!playlists[0]) {
    return res.status(404).send("No playlists found");
  }
  return res.status(200).json(playlists);
});

export default router;
