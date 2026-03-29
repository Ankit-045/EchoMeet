const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    guestName: { type: String },
    role: { type: String, enum: ['host', 'co-host', 'participant', 'guest'], default: 'participant' },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
    isActive: { type: Boolean, default: true }
  }],
  settings: {
    maxParticipants: { type: Number, default: 25 },
    allowGuestAccess: { type: Boolean, default: true },
    allowScreenShare: { type: Boolean, default: true },
    allowChat: { type: Boolean, default: true },
    allowHandRaise: { type: Boolean, default: true },
    isRecording: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    screenShareWhitelist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    approvedParticipants: [{ type: String }] // List of user identities allowed in private meetings
  },
  isActive: { type: Boolean, default: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', roomSchema);
