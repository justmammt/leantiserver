import nodemailer from "nodemailer";
const transporter = nodemailer.createTransport({
    pool: true,
    host: 'smtp.leantify.eu',
    port: 465,
    secure: true,
    auth: {
        user: 'no-reply',
        pass: process.env.NO_REPLY_PWD.toString()
    },
    tls: {
        rejectUnauthorized: false
    }
});


export default transporter
