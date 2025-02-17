import express from "express";
const router = express.Router();
import { db } from "../database.js";
import User from "../models/user.js";

router.get("/songs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const song = await db.any("SELECT id, name, artist_id, album_id, plays FROM songs WHERE id = $1", [id]);

    if (!song[0]) {
      return res.status(404).send("Song not found");
    }

    const artist = await db.any("SELECT username FROM users WHERE id = $1", [song[0].artist_id]);

    if (song[0].album_id != null) {
      const album = await db.any("SELECT name FROM albums WHERE id = $1", [song[0].album_id]);
      return res.status(200).json({
        ...song[0],
        artist: artist[0].username,
        album: album[0].name
      });
    }
    return res.status(200).json({
      ...song[0],
      artist: artist[0].username,
    });
  } catch (error) {
    console.log('ERROR:', error);
    return res.status(500).send("Error fetching song");
  }
});

router.get("/albums/:id", async (req, res) => {
  const { id } = req.params;
  const album = await db.any("SELECT id, name, artist_id FROM albums WHERE id = $1", [id]);
  if (!album[0]) {
    return res.status(404).send("Album not found");
  }
  const artist = await db.any("SELECT username FROM users WHERE id = $1", [album[0].artist_id]);
  const songs = await db.any("SELECT id, name, plays FROM songs WHERE album_id = $1 ORDER BY created_at", [id]);
  return res.status(200).json({
    ...album[0],
    artist: artist[0].username,
    songs
  });
});

router.get("/artists/:id", async (req, res) => {
  const { id } = req.params;
  const artist = new User(id)
  await artist.fetchInfo()
  if (!artist || !artist.isArtist) {
    return res.status(404).send("Artist not found");
  }
  const albums = await db.any("SELECT id, name FROM albums WHERE artist_id = $1", [id]);
  const songs = await db.any("SELECT id, name, album_id, plays FROM songs WHERE artist_id = $1", [id]);
  return res.status(200).json({
    ...artist.infos,
    albums,
    songs
  });
});

router.get("/playlists/:id", async (req, res) => {
  const { id } = req.params;
  const [infos, song_ids] = await Promise.all([
    db.any("SELECT name FROM playlists WHERE id = $1", [id]),
    db.any("SELECT song_id from playlist_songs WHERE playlist_id = $1", [id])
  ]);
  let songs = [];
  for (let i = 0; i < song_ids.length; i++) {
    const song = await db.any("SELECT id, name, artist_id, album_id, plays FROM songs WHERE id = $1", [song_ids[i].song_id]);
    if (song[0]) {
      songs.push(song[0]);
    }
  }
  return res.status(200).json({
    ...infos[0],
    count: songs.length,
    songs
  });
});

export default router;
