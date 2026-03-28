const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { validateRegister, validateLogin, validateGuestAccess } = require('../middleware/validate');

const router = express.Router();

// Register
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const user = new User({ name, email, password });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });

    res.status(201).json({ user, token });
  } catch (error) {
    // Log the real error — never swallow it silently
    console.error('❌ Registration error:', error.message, error.errors || '');
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

// Login
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });

    res.json({ user, token });
  } catch (error) {
    console.error('❌ Login error:', error.message, error.errors || '');
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});

// Guest access
router.post('/guest', validateGuestAccess, async (req, res) => {
  try {
    const { name } = req.body;
    const guestName = name || `Guest_${uuidv4().slice(0, 6)}`;

    const user = new User({
      name: guestName,
      email: `guest_${uuidv4()}@echomeet.guest`,
      password: uuidv4(),
      isGuest: true
    });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('❌ Guest access error:', error.message, error.errors || '');
    res.status(500).json({ error: error.message || 'Guest access failed' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
