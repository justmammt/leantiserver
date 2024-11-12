import { db } from "../../database.js"

export default async function addToPlaylist(req, res) {
    const { id, song_id } = req.body;
    const user = req.user.user_id;

    const playlist = await db.any("SELECT id FROM playlists WHERE id = $1 AND user_id = $2", [id, user]);
    if (!playlist[0]) {
        return res.status(404).send("Playlist not found");
    }

    try {
        await db.func("add_to_playlist", [playlist[0].id, song_id]);
        return res.status(200).json({ status: "Done" });
    } catch (err) {
        console.error(err);
        return res.status(500).send("Error adding song to playlist");
    }
}