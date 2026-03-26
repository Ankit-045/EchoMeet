const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderName: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['group', 'private'], default: 'group' },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recipientName: { type: String },
  timestamp: { type: Date, default: Date.now }
});

messageSchema.index({ roomId: 1, timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);
