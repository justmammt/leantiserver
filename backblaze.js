import B2 from "backblaze-b2";
import "dotenv/config"

const b2 = new B2({
    applicationKeyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_KEY
});

export async function uploadFile(bucketId, fileBuffer, destinationPath, mimeType = 'application/octet-stream') { // Added mimeType parameter
    try {
        await b2.authorize();

        const uploadUrlResponse = await b2.getUploadUrl(bucketId);
        const { uploadUrl, authorizationToken } = uploadUrlResponse.data;

        const fileName = destinationPath;

        const response = await b2.uploadFile({
            uploadUrl,
            uploadAuthToken: authorizationToken,
            fileName,
            data: fileBuffer,
            // Explicitly set the content type if provided, or default to 'application/octet-stream'
            contentType: mimeType  
        });

        console.log("File uploaded successfully:", response.data.fileId);
        return response.data.fileId; // Return the file ID
    } catch (error) {
        console.error("Error uploading file:", error);
        throw error; // Re-throw the error for better error handling
    }
}


export async function deleteFile(fileId, fileName) {
    try {
        await b2.authorize();
        const response = await b2.deleteFileVersion({ fileId, fileName });
        console.log('File deleted:', response.data);
    } catch (error) {
        console.error('Error deleting file:', error);
        throw error;  // Re-throw for consistent error handling
    }
}


export async function getFileIdByPath(bucketId, filePath) {
    try {
        await b2.authorize();

        const response = await b2.listFileNames({
            bucketId: bucketId,
            maxFileCount: 1000, // Adjust as needed
        });

        const files = response.data.files;
        const targetFile = files.find(file => file.fileName === filePath);

        if (targetFile) {
            console.log(`File ID: ${targetFile.fileId}`);
            return targetFile.fileId;
        } else {
            console.log('File not found.');
            return null;
        }
    } catch (error) {
        console.error('Error finding file ID:', error);
        throw error; // Re-throw the error
    }
}