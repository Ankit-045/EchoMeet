const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../../models/User');

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

function getMe(user) {
    return { user };
}

module.exports = {
    register,
    login,
    guestAccess,
    getMe,
};
