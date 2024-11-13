import nodemailer from "nodemailer";

export default transporter = nodemailer.createTransport({
    pool: true,
    host: 'smtp.leantify.eu',
    port: 465,
    secure: true,
    auth: {
        user: 'no-reply',
        pass: process.env.NO_REPLY_PWD
    },
    tls: {
        rejectUnauthorized: false
    }
});

