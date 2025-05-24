import dotenv from "dotenv";
dotenv.config();
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListBucketsCommand, // Import ListBucketsCommand to test connection
} from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

// Configure AWS S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Test connection to AWS S3
(async () => {
  try {
    const command = new ListBucketsCommand({});
    await s3.send(command);
    console.log("Connected to AWS S3 successfully!");
  } catch (error) {
    console.error("Failed to connect to AWS S3:", error);
  }
})();

// Upload file to S3
export const uploadToS3 = async (file) => {
  const fileKey = `${uuidv4()}-${file.originalname}`;
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: fileKey,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    const command = new PutObjectCommand(params);
    await s3.send(command);
    const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
    return {
      fileKey,
      fileUrl,
    };
  } catch (error) {
    console.error("S3 upload error:", error);
    throw new Error("Failed to upload file to S3");
  }
};

// Delete file from S3
export const deleteFromS3 = async (fileKey) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: fileKey,
  };

  try {
    const command = new DeleteObjectCommand(params);
    await s3.send(command);
  } catch (error) {
    console.error("S3 delete error:", error);
    throw new Error("Failed to delete file from S3");
  }
};
export { s3 };


