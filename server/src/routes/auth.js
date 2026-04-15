const express = require('express');
const { auth } = require('../middleware/auth');
const { validateRegister, validateLogin, validateGuestAccess } = require('../middleware/validate');
const { register, login, guest, me } = require('../modules/auth/auth.controller');

const router = express.Router();

// Register
router.post('/register', validateRegister, register);

// Login
router.post('/login', validateLogin, login);

// Guest access
router.post('/guest', validateGuestAccess, guest);

// Get current user
router.get('/me', auth, me);

module.exports = router;
