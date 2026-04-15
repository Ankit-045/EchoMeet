const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema({
    meetingId: { type: String, required: true, index: true },
    userIdentity: { type: String, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, required: true },
    isGuest: { type: Boolean, default: false },
    joinTime: { type: Date, required: true },
    leaveTime: { type: Date, required: true },
    durationMs: { type: Number, required: true, min: 0 },
}, { timestamps: true });

attendanceSessionSchema.index({ meetingId: 1, userIdentity: 1, joinTime: 1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
