import { db } from "../../database.js"

export default async function createPlaylist(req, res) {
    const { name } = req.body;
    const user = req.user.user_id;

    if (!name) {
        return res.status(400).send("Name is required");
    }

    try {
        const playlist_id = await db.func("create_playlist", [name, user]);
        return res.status(200).json(playlist_id[0]);
    } catch (err) {
        console.error(err);
        return res.status(500).send("Error creating playlist");
    }
};