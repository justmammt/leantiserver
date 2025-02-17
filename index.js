import express from "express";
const app = express();
const port = 5678;
import multer from "multer";
const storage = multer({ storage: multer.memoryStorage() });
import path from "path"
import axios from "axios"
import 'dotenv/config'
import { db } from "./database.js"
import { rateLimit } from "express-rate-limit";
import { deleteFile, getFileIdByPath } from "./backblaze.js";
import cors from 'cors'
const __dirname = path.resolve();
import compression from "compression";
import sharp from "sharp";
import adminRouter from "./routes/admin.js";
import mediaRouter from "./routes/mediaRoutes.js";
import searchRouter from "./routes/searchRoutes.js";
import userRouter from "./routes/userRoutes.js";
import contentRouter from "./routes/contentRoutes.js";
import playlistRouter from "./routes/playlistRoutes.js";
import deleteSong from "./routes/deleteSong.js";
import authenticateJWT from "./middlewares/authenticateJWT.js";
import fse from "fs-extra";
import randomSongs from "./routes/random/songs.js";
import { Server } from "socket.io";
import authRouter from "./routes/auth.js";

const WsApp = express();
const server = createServer(WsApp);
const io = new Server(server);

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    jwt.verify(token, process.env.SECRET_KEY);
    next();
  } catch (err) {
    next(new Error("Invalid token."))
  }
});

const activeListeners = new Map();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("start-song", ({ userId, songId, duration }) => {
    if (!activeListeners.has(userId)) {
      activeListeners.set(userId, {});
      console.log("registered user active")
    }

    activeListeners.get(userId)[songId] = {
      duration,
      listenedTime: 0,
      isComplete: false,
      lastReportedPosition: 0,
      timestamp: Date.now(),
    };
  });

  socket.on("progress", ({ userId, songId, currentPosition }) => {
    const userSongs = activeListeners.get(userId);

    if (!userSongs || !userSongs[songId]) return;

    const songData = userSongs[songId];
    const deltaTime = (Date.now() - songData.timestamp) / 1000;
    if (currentPosition > songData.lastReportedPosition) {
      songData.listenedTime += deltaTime;
    }

    songData.lastReportedPosition = currentPosition;
    songData.timestamp = Date.now();
    if (
      songData.listenedTime >= songData.duration / 2 &&
      !songData.isComplete
    ) {
      songData.isComplete = true;
      console.log(`User ${userId} has listened 50% of song ${songId}`)
      try {
        db.none("UPDATE songs SET plays = plays + 1 WHERE id = $1", [songId]);
      } catch (err) {
        console.log(err)
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

io.listen(5679);

app.use(express.json());
app.use(compression());
app.use(
  maybe(
    authenticateJWT
  )
);


function maybe(fn) {
  return function (req, res, next) {
    if (
      req.path === "/login" ||
      req.path === "/register" ||
      req.path.startsWith("/covers") ||
      req.path.startsWith("/albumcovers") ||
      req.path.startsWith("/artistcovers") ||
      req.path.startsWith("/verifyemail")
    ) {
      next();
    } else {
      fn(req, res, next);
    }
  };
}


const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: true, // Disable the `X-RateLimit-*` headers
})

const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
})

app.set('trust proxy', 1);

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { uploadFile } from "./backblaze.js";
import sendEmail from "./functions/sendEmail.js";
import emailHTML from "./email/emailHTML.js";
import { createServer } from "http";
import User from "./models/user.js";

// Numero di iterazioni (cost) per bcrypt
const saltRounds = 10;

app.use(cors())

app.use("/", authRouter);
app.use("/admin", adminRouter);
app.use("/", mediaRouter);
app.use("/", searchRouter);
app.use("/", userRouter);
app.use("/", contentRouter);
app.use("/", playlistRouter);



app.get("/", (req, res) => {
  res.send("Hello " + req.user.username)
})


app.get("/listen/:songId", async (req, res) => {
  const { songId } = req.params;
  const userId = req.user.user_id;

  console.log("Listen started")

  if (!songId) {
    return res.status(400).send("ID canzone mancante");
  }

  try {
    // 1. Recupera i dettagli della canzone dal database
    const result = await db.any(
      "SELECT path FROM songs WHERE id = $1",
      [songId]
    );

    if (!result[0]) {
      return res.status(404).send("Canzone non trovata.");
    }
    return res.status(200).send({ url: process.env.CDN_URL + result[0].path });

  } catch (error) {
    console.error("Errore durante l'ascolto:", error);
    res.status(500).send("Errore interno del server.");
  }
});




app.get("/random/songs", async (req, res) => {
  randomSongs(req, res)
});

app.listen(port, "0.0.0.0", () => {
  console.log(`App listening at http://0.0.0.0:${port}`);
});
