const mongoose = require('mongoose');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROOM_ID_REGEX = /^[A-Z0-9]{6,10}$/;

function validateString(val, maxLen = 500) {
    return typeof val === 'string' && val.length > 0 && val.length <= maxLen;
}

function validateRoomId(val) {
    return typeof val === 'string' && val.length >= 4 && val.length <= 20;
}

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

module.exports = {
    EMAIL_REGEX,
    ROOM_ID_REGEX,
    validateString,
    validateRoomId,
    isValidObjectId,
};
