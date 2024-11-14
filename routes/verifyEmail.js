import { db } from "../database.js";
export default async function verifyEmail(req, res) {
    const token = req.params.token;

    try {
        // Connessione al database e recupero dell'utente
        const rows = await db.any(
            "SELECT id, is_verified FROM users WHERE verification_token = $1",
            [token]
        );

        // Verifica se l'utente esiste e il token è valido
        if (rows.length === 0) {
            return res.status(404).json({ error: "Token non valido o già utilizzato" });
        }

        const user = rows[0];

        // Se l'email è già verificata, invia una risposta adeguata
        if (user.is_verified) {
            return res.status(400).json({ message: "Email già verificata" });
        }

        // Aggiorna lo stato di verifica nel database
        await db.any(
            "UPDATE users SET is_verified = true, verification_token = NULL WHERE id = $1",
            [user.id]
        );

        // Risposta di conferma
        res.status(200).json({ message: "Email verificata con successo" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Errore nel verificare l'email" });
    }
}