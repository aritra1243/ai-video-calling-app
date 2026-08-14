const mongoose = require('mongoose');

const directMessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  senderName: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  read: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

directMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
directMessageSchema.index({ receiverId: 1, senderId: 1, createdAt: 1 });

module.exports = mongoose.model('DirectMessage', directMessageSchema);
