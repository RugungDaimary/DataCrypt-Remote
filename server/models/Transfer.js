import mongoose from "mongoose";

const transferSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  filePath: {
    type: String,
    required: true, // S3 file key for the encrypted file
  },
  encryptedKeyPath: {
    type: String,
    required: true, // S3 file key for the AES key
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  recipient: {
    email: { type: String, required: true }, // Recipient email
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Optional: Link to User model
  },
  accessToken: {
    type: String,
    required: true,
    unique: true, // Ensure the access token is unique
  },
  downloaded: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Transfer = mongoose.model("Transfer", transferSchema);

export default Transfer;
