import express from "express";
const router = express.Router();
import createPlaylist from "./playlist/create.js";
import deletePlaylist from "./playlist/delete.js";
import addToPlaylist from "./playlist/add.js";
import removeFromPlaylist from "./playlist/remove.js";

router.post("/create/playlist", async (req, res) => {
  createPlaylist(req, res);
});

router.post("/delete/playlist", async (req, res) => {
  deletePlaylist(req, res);
});

router.post("/add/playlist", async (req, res) => {
  addToPlaylist(req, res);
});

router.post("/remove/playlist", async (req, res) => {
  removeFromPlaylist(req, res);
});

export default router;
