import express from "express";
const router = express.Router();
import axios from "axios";
import sharp from "sharp";
import { db } from "../database.js";

router.get("/covers/:songId", async (req, res) => {
  const { songId } = req.params;
  try {
    const result = await db.any(
      "SELECT cover FROM songs WHERE id = $1",
      [songId]
    )
    if (songId === 'undefined' || !songId || songId === "undefined" || songId === "null") {
      return res.status(400).send("ID canzone mancante");
    }

    if (!result[0]) {
      return res.status(404).send("Canzone non trovata.");
    }

    const response = await axios({
      url: process.env.CDN_URL + result[0].cover,
      method: "GET",
      responseType: "arraybuffer",
    });

    const compressedImage = await sharp(response.data)
      .png({ quality: 50 })
      .toBuffer();

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", compressedImage.length);
    res.send(compressedImage);
  } catch (error) {
    return res.status(500).send("Error getting image");
  }
});

router.get("/albumcovers/:albumId", async (req, res) => {
  const { albumId } = req.params;
  const result = await db.any(
    "SELECT cover FROM albums WHERE id = $1",
    [albumId]
  )
  if (albumId === 'undefined' || !albumId) {
    return res.status(400).send("ID album mancante");
  }
  if (!result[0]) {
    return res.status(404).send("Album non trovato.");
  }

  const response = await axios({
    url: process.env.CDN_URL + result[0].cover,
    method: 'GET',
    responseType: 'stream',
  });

  res.setHeader("Content-Type", "image/png");
  response.data.pipe(res);
});

router.get("/artistcovers/:artistId", async (req, res) => {
  const { artistId } = req.params;

  if (artistId === 'undefined' || !artistId) {
    return res.status(400).send("ID artista mancante");
  }

  const result = await db.any(
    "SELECT cover FROM users WHERE id = $1 AND is_artist = true",
    [artistId]
  )

  if (!result[0]) {
    return res.status(404).send("Artista non trovato.");
  }
  if (!result[0].cover) {
    return res.status(404).send("Cover non trovato.");
  }
  const response = await axios({
    url: process.env.CDN_URL + result[0].cover,
    method: 'GET',
    responseType: 'stream',
  });

  res.setHeader("Content-Type", "image/png");
  response.data.pipe(res);
});

export default router;
