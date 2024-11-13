import transporter from "../email/transporter";

export default function sendEmail(to, subject, text, html) {
    transporter.sendMail({
        from: {
            name: "Leantify No-reply",
            address: "no-reply@leantify.eu"
        },
        to: to,
        subject: subject,
        text: text,
        html: html
    }, (error, info) => {
        if (error) {
            return console.log('Errore durante l\'invio:', error);
        }
        console.log('Email inviata:', info.response);
    });
}