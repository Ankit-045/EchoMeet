const express = require('express');
const { auth } = require('../middleware/auth');
const {
    validateRegister,
    validateLogin,
    validateGuestAccess,
    validateGoogleSignIn,
} = require('../middleware/validate');
const { register, login, guest, googleSignIn, me } = require('../modules/auth/auth.controller');

const router = express.Router();

// Register
router.post('/register', validateRegister, register);

// Login
router.post('/login', validateLogin, login);

// Guest access
router.post('/guest', validateGuestAccess, guest);

// Google sign-in
router.post('/google', validateGoogleSignIn, googleSignIn);

// Get current user
router.get('/me', auth, me);

module.exports = router;
