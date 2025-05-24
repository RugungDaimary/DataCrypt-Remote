import express from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import User from "../models/User.js";
import Transfer from "../models/Transfer.js";
import { auth } from "../middleware/auth.js";
import { sendEmail } from "../utils/email.js";
import { uploadToS3, s3 } from "../utils/s3.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

const uploadFields = upload.fields([
  { name: "encryptedFile", maxCount: 1 },
  { name: "encryptedAESKey", maxCount: 1 },
]);

const s3Client = new S3Client({ region: process.env.AWS_REGION });

// Unified "inbox" endpoint: returns signed URLs for both file and key
router.get("/inbox", auth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const transfers = await Transfer.find({ "recipient.email": userEmail })
      .populate("sender", "name email")
      .sort({ createdAt: -1 });

    const items = await Promise.all(
      transfers.map(async (t) => {
        const encryptedFileUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: t.filePath,
          }),
          { expiresIn: 300 }
        );
        const encryptedKeyUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: t.encryptedKeyPath,
          }),
          { expiresIn: 300 }
        );
        return {
          _id: t._id,
          fileName: t.fileName,
          fileSize: t.fileSize,
          sender: t.sender,
          createdAt: t.createdAt,
          encryptedFileUrl,
          encryptedKeyUrl,
        };
      })
    );

    res.status(200).json(items);
  } catch (error) {
    console.error("Error fetching inbox files:", error);
    res.status(500).json({ message: "Failed to retrieve inbox files" });
  }
});

router.post("/upload", auth, uploadFields, async (req, res) => {
  try {
    const encryptedFile = req.files.encryptedFile?.[0];
    const encryptedAESKey = req.files.encryptedAESKey?.[0];

    if (!encryptedFile || !encryptedAESKey) {
      return res.status(400).json({ message: "Both files are required" });
    }

    const { recipientEmail } = req.body;
    const fileName = req.body.fileName || encryptedFile.originalname;

    if (!recipientEmail) {
      return res.status(400).json({ message: "Recipient email is required" });
    }

    const recipient = await User.findOne({ email: recipientEmail });
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    const { fileKey: encryptedFileKey } = await uploadToS3(encryptedFile);
    const { fileKey: aesKeyFileKey } = await uploadToS3(encryptedAESKey);

    const accessToken = uuidv4();

    const transfer = new Transfer({
      fileName,
      fileSize: encryptedFile.size,
      filePath: encryptedFileKey,
      encryptedKeyPath: aesKeyFileKey,
      sender: req.user._id,
      recipient: {
        email: recipientEmail,
        userId: recipient._id,
      },
      accessToken,
    });

    await transfer.save();

    const io = req.app.get("io");
    if (io) {
      io.to(recipientEmail).emit("new-file", {
        fileName,
        sender: { name: req.user.name, email: req.user.email },
        createdAt: transfer.createdAt,
        transferId: transfer._id,
      });
    }

    const accessLink = `${process.env.CLIENT_URL}/download/${accessToken}`;

    await sendEmail({
      to: recipientEmail,
      subject: `${req.user.name} sent you an encrypted file`,
      text: `${req.user.name} (${req.user.email}) has sent you an encrypted file: ${fileName}. You can download it using this link: ${accessLink}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">You've Received an Encrypted File</h2>
          <p><strong>${req.user.name}</strong> (${
        req.user.email
      }) has sent you an encrypted file:</p>
          <p style="font-weight: bold;">${fileName}</p>
          <p>File size: ${(encryptedFile.size / 1024 / 1024).toFixed(2)} MB</p>
          <p>You can download it using the link below:</p>
          <div style="margin: 20px 0;">
            <a href="${accessLink}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Download File
            </a>
          </div>
          <p style="color: #6b7280; font-size: 0.9em;">This link will expire in 7 days.</p>
          <p style="color: #6b7280; font-size: 0.9em;">You'll need your private key to decrypt this file.</p>
        </div>
      `,
    });

    res.status(201).json({
      message: "Files uploaded and encrypted successfully",
      transferId: transfer._id,
      accessLink,
    });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/sent", auth, async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Sender email is required" });
    }

    const sender = await User.findOne({ email });
    if (!sender) {
      return res.status(404).json({ message: "User not found" });
    }

    const transfers = await Transfer.find({ sender: sender._id })
      .populate("sender", "name email")
      .populate("recipient.userId", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(transfers);
  } catch (error) {
    console.error("Error fetching sent files:", error);
    res.status(500).json({ message: "Failed to retrieve sent files" });
  }
});

router.get("/file/:token", async (req, res) => {
  try {
    const transfer = await Transfer.findOne({ accessToken: req.params.token });

    if (!transfer) {
      return res.status(404).json({ message: "File not found" });
    }

    if (transfer.expiresAt && new Date() > transfer.expiresAt) {
      return res.status(410).json({ message: "Link has expired" });
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: transfer.filePath,
      Expires: 60,
    };

    // If using aws-sdk v3, use getSignedUrl as above
    const fileUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: transfer.filePath,
      }),
      { expiresIn: 60 }
    );

    res.json({ fileUrl });
  } catch (error) {
    console.error("Download file by token error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
