const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  roomName: { type: String },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, required: true },
  isGuest: { type: Boolean, default: false },
  joinTime: { type: Date, required: true },
  leaveTime: { type: Date },
  duration: { type: Number, default: 0 }, // in seconds
  status: { type: String, enum: ['present', 'absent', 'partial'], default: 'present' },
  meetingDate: { type: Date, default: Date.now }
});

attendanceSchema.index({ roomId: 1, user: 1 });

// Calculate duration before saving
attendanceSchema.pre('save', function (next) {
  if (this.joinTime && this.leaveTime) {
    this.duration = Math.floor((this.leaveTime - this.joinTime) / 1000);
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
