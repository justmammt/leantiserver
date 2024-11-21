import { db } from "../../database.js";

export default async function randomSongs(req, res) {
    try {
        // Recupera un certo numero di canzoni casuali (es. 10) unendo le informazioni sugli artisti
        const result = await db.any(`
            SELECT 
                songs.id, 
                songs.name, 
                users.username AS artist 
            FROM songs
            JOIN users ON songs.artist_id = users.id
            ORDER BY RANDOM()
            LIMIT 10;
        `);

        if (result.length === 0) {
            return res.status(404).json({ message: "No songs found" });
        }

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("Errore nel recuperare canzoni casuali:", error);
        res.status(500).json({
            success: false,
            message: "Internal error retrieving random songs",
        });
    }
}