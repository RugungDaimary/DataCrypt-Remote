import express from 'express';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Search users by email or name
router.get('/search', auth, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    // Find users matching the query (excluding the current user)
    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        {
          $or: [
            { email: { $regex: query, $options: 'i' } },
            { name: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    }).select('_id name email publicKey');
    
    // Map users to the required format
    const formattedUsers = users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      publicKey: user.publicKey
    }));
    
    res.json(formattedUsers);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user's public key
router.put('/public-key', auth, async (req, res) => {
  try {
    const { publicKey } = req.body;
    
    if (!publicKey) {
      return res.status(400).json({ message: 'Public key is required' });
    }
    
    // Update user's public key
    req.user.publicKey = publicKey;
    await req.user.save();
    
    res.json({ message: 'Public key updated successfully' });
  } catch (error) {
    console.error('Update public key error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's public key by email
router.get('/public-key/:email', auth, async (req, res) => {
  try {
    const { email } = req.params;
    
    // Find user by email
    const user = await User.findOne({ email }).select('publicKey');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.publicKey) {
      return res.status(404).json({ message: 'User has not set a public key' });
    }
    
    res.json({ publicKey: user.publicKey });
  } catch (error) {
    console.error('Get public key error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;