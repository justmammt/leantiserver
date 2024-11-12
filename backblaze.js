import B2 from "backblaze-b2";
import "dotenv/config"
import fse from "fs-extra";

const b2 = new B2({
    applicationKeyId: process.env.B2_KEY_ID, // or accountId: 'accountId'
    applicationKey: process.env.B2_KEY // or masterApplicationKey
});

export async function uploadFile(bucketId, localFilePath, destinationPath) {
    try {
        await b2.authorize();

        // Ottieni l'URL di upload per il bucket
        const uploadUrlResponse = await b2.getUploadUrl(bucketId);
        const { uploadUrl, authorizationToken } = uploadUrlResponse.data;

        // Leggi il contenuto del file locale
        const fileData = fse.readFileSync(localFilePath);
        const fileName = destinationPath; // Esempio: "songs/albumName/song.mp3"

        // Esegui l'upload
        const response = await b2.uploadFile({
            uploadUrl,
            uploadAuthToken: authorizationToken,
            fileName, 
            data: fileData, 
        });

        console.log("File caricato con successo:", response.data.fileId);
    } catch (error) {
        console.error("Errore durante l'upload:", error);
    }
}
export async function deleteFile(fileId, fileName) {
    try {
        await b2.authorize()
        const response = await b2.deleteFileVersion({
            fileId,
            fileName,
        });

        console.log('File eliminato:', response.data);
    } catch (error) {
        console.error('Errore durante l\'eliminazione del file:', error);
    }
}
export async function getFileIdByPath(bucketId, filePath) {
    try {
        await b2.authorize();

        // Elenca i file nel bucket
        const response = await b2.listFileNames({
            bucketId: bucketId,
            maxFileCount: 1000, // Elenca fino a 1000 file (modificabile se necessario)
        });

        const files = response.data.files;

        // Trova il file che corrisponde alla path
        const targetFile = files.find(file => file.fileName === filePath);

        if (targetFile) {
            console.log(`ID del file: ${targetFile.fileId}`);
            return targetFile.fileId;
        } else {
            console.log('File non trovato.');
            return null;
        }
    } catch (error) {
        console.error('Errore durante la ricerca del file ID:', error);
    }
}


