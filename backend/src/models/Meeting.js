const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    default: 'Untitled Meeting',
  },
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    email: String,
    joinedAt: { type: Date, default: Date.now },
  }],
  status: {
    type: String,
    enum: ['scheduled', 'active', 'ended'],
    default: 'scheduled',
  },
  startedAt: Date,
  endedAt: Date,
  recordingUrl: String,
  recordingFilename: String,
  transcript: {
    text: String,
    segments: [{
      start: Number,
      end: Number,
      text: String,
      speaker: String,
    }],
    processedAt: Date,
  },
  summary: {
    title: String,
    summary: String,
    keyPoints: [String],
    decisions: [String],
    actionItems: [{
      assignee: String,
      task: String,
      completed: { type: Boolean, default: false },
    }],
    nextSteps: [String],
    processedAt: Date,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Meeting', meetingSchema);
