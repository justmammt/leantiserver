import express from "express";
const router = express.Router();
import { db } from "../database.js";

router.get("/search", async (req, res) => {
  const { query } = req.query;
  const user = req.user.user_id;

  if (!query) {
    return res.status(400).send("Query is required");
  }

  try {
    const searchTerm = '%' + query + '%';

    const [songs, artists, albums] = await Promise.all([
      db.any("SELECT id, name, artist_id, plays FROM songs WHERE name ILIKE $1", [searchTerm]),
      db.any("SELECT id, username, subscription FROM users WHERE username ILIKE $1 AND is_artist = true", [searchTerm]),
      db.any("SELECT id, name, artist_id FROM albums WHERE name ILIKE $1", [searchTerm])
    ]);
    artists.sort((a, b) => {
      if (a.subscription === "plus" && b.subscription === "basic") return -1;
      if (a.subscription === "basic" && b.subscription === "plus") return 1;
      return 0;
    });
    return res.status(200).json({
      songs,
      artists,
      albums,
    });
  } catch (error) {
    console.error("Errore durante la ricerca:", error);
    return res.status(500).send("Errore interno del server.");
  }
});

export default router;
