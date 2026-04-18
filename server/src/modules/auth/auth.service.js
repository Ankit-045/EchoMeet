const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const User = require('../../models/User');

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
let googleClient;

function getGoogleClientId() {
    const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
        throw { status: 500, body: { error: 'Google Sign-In is not configured' } };
    }
    return clientId;
}

function getGoogleClient() {
    if (!googleClient) {
        googleClient = new OAuth2Client(getGoogleClientId());
    }
    return googleClient;
}

async function verifyGoogleCredential(credential) {
    try {
        const clientId = getGoogleClientId();
        const ticket = await getGoogleClient().verifyIdToken({
            idToken: credential,
            audience: clientId,
        });
        const payload = ticket.getPayload();

        if (!payload || !payload.sub || !payload.email) {
            throw new Error('Missing required token claims');
        }
        if (!payload.email_verified) {
            throw new Error('Email is not verified by Google');
        }
        if (!GOOGLE_ISSUERS.has(payload.iss)) {
            throw new Error('Invalid token issuer');
        }

        return {
            googleId: payload.sub,
            email: payload.email.toLowerCase().trim(),
            name: payload.name || payload.email.split('@')[0],
            avatar: payload.picture || '',
        };
    } catch (error) {
        if (error && error.status && error.body) {
            throw error;
        }
        throw { status: 401, body: { error: 'Invalid Google credential' } };
    }
}

function signToken(userId, expiresIn) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: expiresIn || process.env.JWT_EXPIRE || '7d'
    });
}

async function register({ name, email, password }) {
    if (!name || !email || !password) {
        throw { status: 400, body: { error: 'All fields are required' } };
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw { status: 400, body: { error: 'Email already registered' } };
    }

    const user = new User({ name, email, password });
    await user.save();

    const token = signToken(user._id);
    return { user, token };
}

async function login({ email, password }) {
    if (!email || !password) {
        throw { status: 400, body: { error: 'Email and password required' } };
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
        throw { status: 401, body: { error: 'Invalid credentials' } };
    }

    const token = signToken(user._id);
    return { user, token };
}

async function guestAccess({ name }) {
    const guestName = name || `Guest_${uuidv4().slice(0, 6)}`;

    const user = new User({
        name: guestName,
        email: `guest_${uuidv4()}@echomeet.guest`,
        password: uuidv4(),
        isGuest: true
    });
    await user.save();

    const token = signToken(user._id, '24h');
    return { user, token };
}

async function googleSignIn({ credential }) {
    if (!credential) {
        throw { status: 400, body: { error: 'Google credential is required' } };
    }

    const googleProfile = await verifyGoogleCredential(credential);

    let user = await User.findOne({ googleId: googleProfile.googleId });

    if (!user) {
        user = await User.findOne({ email: googleProfile.email });

        if (user && user.googleId && user.googleId !== googleProfile.googleId) {
            throw { status: 409, body: { error: 'Email is linked to another Google account' } };
        }

        if (user) {
            user.googleId = googleProfile.googleId;
            if (!user.avatar && googleProfile.avatar) {
                user.avatar = googleProfile.avatar;
            }
            if (!user.name && googleProfile.name) {
                user.name = googleProfile.name;
            }
            if (user.isGuest) {
                user.isGuest = false;
            }
            await user.save();
        } else {
            user = new User({
                name: googleProfile.name,
                email: googleProfile.email,
                avatar: googleProfile.avatar,
                authProvider: 'google',
                googleId: googleProfile.googleId,
            });
            await user.save();
        }
    }

    const token = signToken(user._id);
    return { user, token };
}

function getMe(user) {
    return { user };
}

module.exports = {
    register,
    login,
    guestAccess,
    googleSignIn,
    getMe,
};
