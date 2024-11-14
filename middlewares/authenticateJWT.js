import jwt from 'jsonwebtoken';

export default function authenticateJWT(req, res, next) {
    const token = req.header('Authorization')?.split(' ')[1];

    if (!token) return res.status(401).send('Accesso negato.');

    try {
        const verified = jwt.verify(token, process.env.SECRET_KEY);
        req.user = verified; // Salva l'utente decodificato per le successive richieste
        next();
    } catch (err) {
        console.log(err)
        res.status(400).send('Token non valido.');
    }
};