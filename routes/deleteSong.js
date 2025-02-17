
import { deleteFile, getFileIdByPath } from "../backblaze.js";
import "dotenv/config";

import { db } from "../database.js";

export default async function deleteSong(song_id, req, res) {
  const artist = req.user.username
  const artist_id = req.user.user_id
  const songInfo = await db.any(`SELECT * from songs where id = $1`, [song_id]);
  console.log(songInfo)
  const is_artist = req.user.is_artist
  if (!is_artist) {
    return res.status(401).send("Unauthorized");
  }
  if (!songInfo[0]) {
    return res.status(404).send("Song not found");
  }

  if (songInfo[0].artist_id !== artist_id) {
    return res.status(401).send("Unauthorized");
  }

  await deleteFile(await getFileIdByPath(process.env.BUCKET_ID, songInfo[0].cover), songInfo[0].cover);
  await deleteFile(await getFileIdByPath(process.env.BUCKET_ID, songInfo[0].path), songInfo[0].path);

  try {
    await db.func("delete_song", [song_id]);
    console.log("Song deleted successfully!");
    return res.status(200).send("Song deleted successfully");
  } catch (error) {
    console.error("Error deleting song:", error);
    return res.status(500).send("Error deleting song");
  }

}
