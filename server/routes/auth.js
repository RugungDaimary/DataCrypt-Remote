import express from 'express';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';
import { sendEmail } from '../utils/email.js';

const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, publicKey } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Generate OTP secret
    const otpSecret = speakeasy.generateSecret({ length: 20 }).base32;
    
    // Create new user
    const user = new User({
      name,
      email,
      password,
      publicKey,
      otpSecret
    });
    
    await user.save();
    
    // Generate OTP
    const otp = speakeasy.totp({
      secret: otpSecret,
      encoding: 'base32',
      step: 300 // 5 minutes
    });
    console.log('Generated OTP:', otp);
    // Send OTP via email
    await sendEmail({
      to: email,
      subject: 'Verify Your Account',
      text: `Your verification code is: ${otp}. It will expire in 5 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Verify Your Account</h2>
          <p>Thank you for registering with Secure Encrypted File Transfer.</p>
          <p>Your verification code is:</p>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `
    });
    
    res.status(201).json({ message: 'User registered. Please verify your email.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify OTP
    const isValid = speakeasy.totp.verify({
      secret: user.otpSecret,
      encoding: 'base32',
      token: otp,
      step: 300, // 5 minutes
      window: 1 // Allow 1 step before and after
    });
    
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    
    // Mark user as verified
    user.isVerified = true;
    await user.save();
    
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login with email and password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is verified
    if (!user.isVerified) {
      return res.status(401).json({ message: 'Email not verified' });
    }
    
    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        publicKey: user.publicKey
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send OTP for login
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is verified
    if (!user.isVerified) {
      return res.status(401).json({ message: 'Email not verified' });
    }
    
    // Generate OTP
    const otp = speakeasy.totp({
      secret: user.otpSecret,
      encoding: 'base32',
      step: 300 // 5 minutes
    });
    
    // Send OTP via email
    await sendEmail({
      to: email,
      subject: 'Your Login Code',
      text: `Your login code is: ${otp}. It will expire in 5 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Your Login Code</h2>
          <p>You requested to login with a one-time password.</p>
          <p>Your login code is:</p>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `
    });
    
    res.json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login with OTP
router.post('/login/otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is verified
    if (!user.isVerified) {
      return res.status(401).json({ message: 'Email not verified' });
    }
    
    // Verify OTP
    const isValid = speakeasy.totp.verify({
      secret: user.otpSecret,
      encoding: 'base32',
      token: otp,
      step: 300, // 5 minutes
      window: 1 // Allow 1 step before and after
    });
    
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        publicKey: user.publicKey
      }
    });
  } catch (error) {
    console.error('OTP login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/user', auth, async (req, res) => {
  try {
    res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      publicKey: req.user.publicKey
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;