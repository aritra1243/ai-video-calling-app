const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
  inviterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  inviteeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
  },
  roomId: {
    type: String,
    required: true,
  },
  meetingTitle: {
    type: String,
    default: 'Video Meeting',
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Invitation', invitationSchema);
