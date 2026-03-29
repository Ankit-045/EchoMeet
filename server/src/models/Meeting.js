const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  meetingId: { type: String, required: true, unique: true, index: true },
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scheduledAt: { type: Date, required: true },
  duration: { type: Number, default: 60 }, // duration in minutes
  createdAt: { type: Date, default: Date.now },
  settings: {
    isPrivate: { type: Boolean, default: false }
  }
});

module.exports = mongoose.model('Meeting', meetingSchema);
