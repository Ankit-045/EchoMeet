const mongoose = require('mongoose');

const attendanceSummarySchema = new mongoose.Schema({
    meetingId: { type: String, required: true, index: true },
    userIdentity: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, required: true },
    isGuest: { type: Boolean, default: false },
    totalTimeMs: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['present', 'absent'], required: true },
    firstJoinTime: { type: Date },
    lastLeaveTime: { type: Date },
    meetingStartTime: { type: Date, required: true },
    meetingEndTime: { type: Date, required: true },
    meetingDurationMs: { type: Number, required: true, min: 0 },
    finalizedAt: { type: Date, default: Date.now },
}, { timestamps: true });

attendanceSummarySchema.index({ meetingId: 1, userIdentity: 1 }, { unique: true });
attendanceSummarySchema.index({ user: 1, meetingEndTime: -1 });

module.exports = mongoose.model('AttendanceSummary', attendanceSummarySchema);
