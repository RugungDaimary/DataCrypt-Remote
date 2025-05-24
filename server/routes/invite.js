import express from "express";
import { sendEmail } from "../utils/email.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { email, senderName } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  // You can add domain validation here if needed

  try {
    await sendEmail({
      to: email,
      subject: "You're Invited to Secure Encrypted File Transfer!",
      text: `You've been invited to join Secure Encrypted File Transfer. Click the link below to sign up!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 2px 8px #0001;">
          <div style="background: #4f46e5; color: #fff; padding: 24px 0; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 2rem;">Secure Encrypted File Transfer</h1>
          </div>
          <div style="padding: 32px 24px;">
            <h2 style="color: #4f46e5; margin-bottom: 12px;">You're Invited!</h2>
            <p style="font-size: 1.1rem; color: #374151;">
              Hello,
              <br /><br />
              ${(senderName || "Someone")} wants to securely share files with you using our platform.<br />
              <b>To receive files, you need to create an account.</b>
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="http://localhost:5173/signup" style="background: #4f46e5; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-size: 1.1rem; font-weight: bold; box-shadow: 0 2px 4px #0002;">
                Create Your Account
              </a>



        
            </div>
            <p style="color: #6b7280; font-size: 0.95rem;">
              If you did not expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    });
    res.json({ message: "Invitation sent!" });
  } catch (err) {
    res.status(500).json({ message: "Failed to send invitation." });
  }
});

export default router;
