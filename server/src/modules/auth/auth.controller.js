const authService = require('./auth.service');

async function register(req, res) {
    try {
        const data = await authService.register(req.body);
        res.status(201).json(data);
    } catch (error) {
        if (error && error.status && error.body) {
            return res.status(error.status).json(error.body);
        }
        console.error('❌ Registration error:', error.message || error, error.errors || '');
        res.status(500).json({ error: error.message || 'Registration failed' });
    }
}

async function login(req, res) {
    try {
        const data = await authService.login(req.body);
        res.json(data);
    } catch (error) {
        if (error && error.status && error.body) {
            return res.status(error.status).json(error.body);
        }
        console.error('❌ Login error:', error.message || error, error.errors || '');
        res.status(500).json({ error: error.message || 'Login failed' });
    }
}

async function guest(req, res) {
    try {
        const data = await authService.guestAccess(req.body);
        res.status(201).json(data);
    } catch (error) {
        if (error && error.status && error.body) {
            return res.status(error.status).json(error.body);
        }
        console.error('❌ Guest access error:', error.message || error, error.errors || '');
        res.status(500).json({ error: error.message || 'Guest access failed' });
    }
}

async function googleSignIn(req, res) {
    try {
        const data = await authService.googleSignIn(req.body);
        res.json(data);
    } catch (error) {
        if (error && error.status && error.body) {
            return res.status(error.status).json(error.body);
        }
        console.error('❌ Google sign-in error:', error.message || error, error.errors || '');
        res.status(500).json({ error: error.message || 'Google sign-in failed' });
    }
}

function me(req, res) {
    res.json(authService.getMe(req.user));
}

module.exports = {
    register,
    login,
    guest,
    googleSignIn,
    me,
};
