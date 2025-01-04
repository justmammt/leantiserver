import express from "express";
const app = express();
const port = 5678;
import multer from "multer";
const storage = multer({ dest: "tmp/" });
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
import createPlaylist from "./routes/playlist/create.js";
import deletePlaylist from "./routes/playlist/delete.js";
import addToPlaylist from "./routes/playlist/add.js";
import removeFromPlaylist from "./routes/playlist/remove.js";
import deleteSong from "./routes/deleteSong.js";
import verifyEmail from "./routes/verifyEmail.js"
import authenticateJWT from "./middlewares/authenticateJWT.js";
import { Server } from 'socket.io';
import fse from "fs-extra";
import randomSongs from "./routes/random/songs.js";

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

app.post("/register", authLimiter, async (req, res) => {
  const { username, password, email } = req.body;


  // 1. Verifica se l'input è valido (convalida di base)
  if (!username || !password || !email) {
    return res.status(400).send("Username, password ed email sono obbligatori.");
  }

  if (!email.match(/([@])\w+/g)) {
    return res.status(400).send("Email non valida.");
  }

  if (password.length < 8) {
    return res.status(400).send("La password deve avere almeno 8 caratteri.");
  }

  // 2. Controlla se l'utente esiste già nel database

  const existingUser = await db.any(`SELECT * FROM users WHERE username = $1`, [username])
  if (existingUser[0]) {
    return res.status(400).send("Questo nome utente è già registrato.");
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const token = jwt.sign({ verifyemail: true }, process.env.SECRET_KEY);
    await db.func('create_user', [username, hashedPassword, email])
      .then(async (data) => {
        console.log("An user has been created"); // print data;
        await db.any(
          "UPDATE users SET verification_token = $2 WHERE id = $1",
          [data[0].create_user, token]
        );
        sendEmail(email.toString(), "Registration confirmation", "Confirm your email address", emailHTML(token));
        return res.status(200).send("Registrazione completata con successo!");
      })
      .catch(error => {
        console.log('ERROR:', error); // print the error;
      })



  } catch (error) {
    console.error("Errore durante la registrazione:", error);
    res.status(500).send("Errore del server. Riprova più tardi.");
  }
});

app.post('/login', authLimiter, async (req, res) => {
  const username = req.body.username;
  const password = req.body.password

  const _user = await db.oneOrNone(`SELECT id, password FROM users WHERE username = $1`, [username]);
  if (!_user) return res.status(400).send('Utente non trovato.');

  const isValidPassword = await bcrypt.compare(password, _user.password);
  if (!isValidPassword) return res.status(401).send('Password errata.');

  const user = new User(_user.id);

  const user_id = user.id
  await user.fetchInfo()
  console.log({
    username: user.username,
    user_id,
    is_artist: user.isArtist,
    subscription: user.subscription
  })

  // Crea un token JWT
  const token = jwt.sign({ username: user.username, user_id: user_id, is_artist: user.isArtist, subscription: user.subscription }, process.env.SECRET_KEY, { expiresIn: "30d" });

  // Invia il token al client
  if (user.isVerified) {
    return res.json({ token, username: user.username, user_id, is_artist: user.isArtist, subscription: user.subscription, is_verified: user.isVerified });
  } else {
    return res.status(403).json({ is_verified });
  }
});

app.get("/verifyemail/:token", async (req, res) => {
  verifyEmail(req, res);
});



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

app.use(
  maybe(
    authenticateJWT
  )
);

app.get("/", (req, res) => {
  res.send("Hello " + req.user.username)
})

app.post(
  "/admin/songs/create", uploadLimiter,
  storage.fields([
    { name: "name", maxCount: 1 },
    { name: "cover", maxCount: 1 },
    { name: "mp3", maxCount: 1 },
    { name: "album_id", maxCount: 1 },
  ]),
  async (req, res) => {

    const artist = req.user.username
    const artist_id = req.user.user_id
    const songName = req.body.name;

    const is_artist = req.user.is_artist
    if (!is_artist) {
      return res.status(401).send("Unauthorized");
    }

    if (!req.files || !req.files["cover"] || !req.files["cover"][0]) {
      console.log("Cover file is required");
      return res.status(400).send("Cover file is required");

    }

    if (!req.files || !req.files["mp3"] || !req.files["mp3"][0]) {
      console.log("MP3 file is required");
      return res.status(400).send("MP3 file is required");
    }

    if (req.body.album_id === 0 || req.body.album_id === "0") {
      db.func("create_song", [songName,
        artist_id
      ])

        .then(data => {
          let _coverFileName = req.files["cover"][0].filename;
          let _songFileName = req.files["mp3"][0].filename;

          uploadFile(process.env.BUCKET_ID, path.join(__dirname, "/tmp/" + _coverFileName), "covers/songs/" + data[0].create_song + "/cover.png");
          uploadFile(process.env.BUCKET_ID, path.join(__dirname, "/tmp/" + _songFileName), "songs/" + data[0].create_song + "/song.mp3"); // print data;
          fse.deleteFile(path.join(__dirname, "/tmp/" + _coverFileName));
          fse.deleteFile(path.join(__dirname, "/tmp/" + _songFileName));
          return res.status(200).send("Song created successfully!");
        })
        .catch(error => {
          console.log('ERROR:', error); // print the error;
          return res.status(500).send(error.detail);
        })
    }
    else {
      db.func("create_song_in_album", [songName,
        artist_id, req.body.album_id
      ])

        .then(data => {
          let _coverFileName = req.files["cover"][0].filename;
          let _songFileName = req.files["mp3"][0].filename;

          uploadFile(process.env.BUCKET_ID, path.join(__dirname, "/tmp/" + _coverFileName), "covers/songs/" + data[0].create_song_in_album + "/cover.png");
          uploadFile(process.env.BUCKET_ID, path.join(__dirname, "/tmp/" + _songFileName), "songs/" + data[0].create_song_in_album + "/song.mp3");
          fse.deleteFile(path.join(__dirname, "/tmp/" + _coverFileName));
          fse.deleteFile(path.join(__dirname, "/tmp/" + _songFileName));
          return res.status(200).send("Song created successfully in album!");
        })
        .catch(error => {
          console.log('ERROR:', error); // print the error;
          return res.status(500).send(error.detail);
        })
    }
  }
);

app.post("/admin/songs/delete", (req, res) => {
  deleteSong(req.body.id, req, res);
});

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

app.get("/covers/:songId", async (req, res) => {
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
app.get("/albumcovers/:albumId", async (req, res) => {
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

app.get("/artistcovers/:artistId", async (req, res) => {
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
})

app.post(
  "/admin/albums/create", uploadLimiter,
  storage.fields([
    { name: "name", maxCount: 1 },
    { name: "cover", maxCount: 1 },
    { name: "release_date", maxCount: 1 },
  ]),
  async (req, res) => {

    const artist_id = req.user.user_id
    const name = req.body.name.toString();
    const release_date = req.body.release_date;

    const is_artist = req.user.is_artist
    if (!is_artist) {
      return res.status(401).send("Unauthorized");
    }

    if (!req.files || !req.files["cover"] || !req.files["cover"][0]) {
      return res.status(400).send("Cover file is required");

    }

    db.func("create_album", [name,
      artist_id, release_date
    ])

      .then(data => {
        let _coverFileName = req.files["cover"][0].filename;
        console.log(data[0].create_album)

        uploadFile(process.env.BUCKET_ID, path.join(__dirname, "/tmp/" + _coverFileName), "covers/albums/" + data[0].create_album + "/cover.png");
        fse.deleteFile(path.join(__dirname, "/tmp/" + _coverFileName));
        return res.status(200).send("Album created successfully!");
      })
      .catch(error => {
        console.log('ERROR:', error); // print the error;
        return res.status(500).send(error.detail);
      })

  }
);

app.post("/admin/albums/delete", async (req, res) => {
  const artist_id = req.user.user_id
  const album_id = req.body.id;
  const album = await db.any(`SELECT * from albums where id = $1`, [album_id]);

  const is_artist = req.user.is_artist
  if (!is_artist) {
    return res.status(401).send("Unauthorized");
  }

  if (!album[0]) {
    return res.status(404).send("Album not found");
  }

  if (album[0].artist_id !== artist_id) {
    return res.status(401).send("Unauthorized");
  }

  await deleteFile(await getFileIdByPath(process.env.BUCKET_ID, album[0].cover), album[0].cover);

  try {
    await db.func("delete_album", [album_id]);
    console.log("Album deleted successfully!");
    return res.status(200).send("Album deleted successfully");
  } catch (error) {
    console.error("Error deleting album:", error);
    return res.status(500).send("Error deleting album");
  }
});

app.get("/search", async (req, res) => {
  const { query } = req.query;
  const user = req.user.user_id

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

app.get("/my/infos", async (req, res) => {
  const userId = req.user.user_id;
  const user = await db.any("SELECT id, username, subscription, is_artist FROM users WHERE id = $1", [userId]);
  return res.status(200).json(user[0]);
})

app.get("/my/albums", async (req, res) => {
  const userId = req.user.user_id;
  const albums = await db.any("SELECT id, name FROM albums WHERE artist_id = $1", [userId]);
  return res.status(200).json(albums);
});

app.get("/my/songs", async (req, res) => {
  const userId = req.user.user_id;
  const songs = await db.any("SELECT id, name FROM songs WHERE artist_id = $1 AND album_id is NULL", [userId]);
  return res.status(200).json(songs);
});

app.get("/my/songs/:albumId", async (req, res) => {
  const userId = req.user.user_id;
  const albumId = req.params.albumId;
  const songs = await db.any("SELECT id, name FROM songs WHERE artist_id = $1 AND album_id = $2", [userId, albumId]);
  return res.status(200).json(songs);
});
app.get("/my/playlists", async (req, res) => {
  const userId = req.user.user_id;
  const playlists = await db.any("SELECT id, name FROM playlists WHERE user_id = $1", [userId]);
  if (!playlists[0]) {
    return res.status(404).send("No playlists found");
  }
  return res.status(200).json(playlists);
});

app.post("/admin/image/set", uploadLimiter, storage.fields([{ name: "image", maxCount: 1 }]), async (req, res) => {

  const artist_id = req.user.user_id

  const result = await db.any("SELECT id, cover from users where id = $1", [artist_id])
  if (!result[0]) {
    return res.status(404).send("User not found");
  }
  if (!req.files || !req.files["image"] || !req.files["image"][0]) {
    return res.status(400).send("Image file is required");
  }
  if (result[0].cover) {
    await deleteFile(await getFileIdByPath(process.env.BUCKET_ID, result[0].cover), result[0].cover);
  }
  try {
    let _coverFileName = req.files["image"][0].filename;

    uploadFile(process.env.BUCKET_ID, path.join(__dirname, "/tmp/" + _coverFileName), "covers/artists/" + result[0].id + "/cover.png");
    fse.deleteFile(path.join(__dirname, "/tmp/" + _coverFileName));
    await db.any("UPDATE users SET cover = $1 WHERE id = $2", ["covers/artists/" + result[0].id + "/cover.png", result[0].id]);

    return res.status(200).send("Image uploaded successfully!");
  } catch (error) {
    console.log('ERROR:', error); // print the error;
    return res.status(500).send("Error uploading image");
  }
})

app.get("/songs/:id", async (req, res) => {
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
    console.log('ERROR:', error); // print the error;
    return res.status(500).send("Error fetching song");
  }
});

app.get("/albums/:id", async (req, res) => {
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

app.get("/artists/:id", async (req, res) => {
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

app.get("/playlists/:id", async (req, res) => {
  const { id } = req.params;
  const [infos, song_ids] = await Promise.all([
    db.any("SELECT name FROM playlists WHERE id = $1", [id]),
    db.any("SELECT song_id from playlist_songs WHERE playlist_id = $1", [id])
  ])
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
app.post("/create/playlist", async (req, res) => {
  createPlaylist(req, res)
});

app.post("/delete/playlist", async (req, res) => {
  deletePlaylist(req, res)
});

app.post("/add/playlist", async (req, res) => {
  addToPlaylist(req, res)
});

app.post("/remove/playlist", async (req, res) => {
  removeFromPlaylist(req, res)
});

app.get("/random/songs", async (req, res) => {
  randomSongs(req, res)
});

app.listen(port, "0.0.0.0", () => {
  console.log(`App listening at http://0.0.0.0:${port}`);
});
