import { db } from "../../database.js"

export default async function deletePlaylist(req, res) {
    const { id } = req.body;
    const user = req.user.user_id;

    const playlist = await db.any("SELECT id FROM playlists WHERE id = $1 AND user_id = $2", [id, user]);
    if (!playlist[0]) {
        return res.status(404).send("Playlist not found");
    }

    try {
        const playlist_id = await db.func("delete_playlist", [playlist[0].id]);
        return res.status(200).json(playlist_id[0]);
    } catch (err) {
        console.error(err);
        return res.status(500).send("Error deleting playlist");
    }
}