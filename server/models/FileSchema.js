const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  senderEmail: { type: String, required: true }, // Email of the sender
  recipientEmail: { type: String, required: true, index: true }, // Email of the recipient
  originalName: { type: String, required: true }, // Original file name
  encryptedFileUrl: { type: String, required: true }, // S3 URL or key for the encrypted file
  encryptedKeyUrl: { type: String, required: true }, // S3 URL or key for the encrypted AES key
  fileSize: { type: Number, required: true },
  uploadDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model("File", fileSchema);
