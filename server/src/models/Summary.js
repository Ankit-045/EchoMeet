const mongoose = require('mongoose');

const summarySchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  roomName: { type: String },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  transcript: { type: String, default: '' },
  summary: { type: String, default: '' },
  keyPoints: [{ type: String }],
  actionItems: [{
    item: { type: String },
    assignee: { type: String },
    deadline: { type: String }
  }],
  duration: { type: Number }, // meeting duration in seconds
  participantCount: { type: Number },
  generatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Summary', summarySchema);
