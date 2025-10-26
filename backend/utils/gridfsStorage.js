const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

/**
 * Get GridFS bucket for storing files
 * @returns {GridFSBucket}
 */
function getGridFSBucket() {
    const db = mongoose.connection.db;
    return new GridFSBucket(db, { bucketName: 'plantImages' });
}

/**
 * Upload image buffer to GridFS
 * @param {Buffer} buffer - Image buffer
 * @param {String} filename - Original filename
 * @param {String} contentType - MIME type
 * @returns {Promise<String>} - GridFS file ID
 */
async function uploadImageToGridFS(buffer, filename, contentType) {
    return new Promise((resolve, reject) => {
        const bucket = getGridFSBucket();
        const uploadStream = bucket.openUploadStream(filename, {
            contentType: contentType
        });

        uploadStream.on('finish', () => {
            console.log('✅ Image uploaded to GridFS:', uploadStream.id);
            resolve(uploadStream.id.toString());
        });

        uploadStream.on('error', (error) => {
            console.error('❌ GridFS upload error:', error);
            reject(error);
        });

        uploadStream.end(buffer);
    });
}

/**
 * Get image stream from GridFS
 * @param {String} fileId - GridFS file ID
 * @returns {Promise<{stream: Stream, contentType: String}>}
 */
async function getImageFromGridFS(fileId) {
    return new Promise((resolve, reject) => {
        const bucket = getGridFSBucket();
        const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));

        downloadStream.on('file', (file) => {
            const stream = downloadStream;
            const contentType = file.contentType || 'image/jpeg';
            resolve({ stream, contentType });
        });

        downloadStream.on('error', (error) => {
            console.error('❌ GridFS download error:', error);
            reject(error);
        });
    });
}

/**
 * Delete image from GridFS
 * @param {String} fileId - GridFS file ID
 * @returns {Promise<void>}
 */
async function deleteImageFromGridFS(fileId) {
    try {
        const bucket = getGridFSBucket();
        await bucket.delete(new mongoose.Types.ObjectId(fileId));
        console.log('🗑️ Image deleted from GridFS:', fileId);
    } catch (error) {
        console.error('❌ GridFS delete error:', error);
        throw error;
    }
}

module.exports = {
    uploadImageToGridFS,
    getImageFromGridFS,
    deleteImageFromGridFS
};

