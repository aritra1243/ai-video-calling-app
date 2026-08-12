const mongoose = require('mongoose');

const standupEntrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userEmail: {
    type: String,
  },
  // The calendar date this standup is for (YYYY-MM-DD as a Date at midnight UTC)
  date: {
    type: Date,
    required: true,
    index: true,
  },
  // ISO date string of the Monday of this week (for easy weekly grouping)
  weekStart: {
    type: Date,
    required: true,
    index: true,
  },
  // Day of week: 0=Mon, 1=Tue, ..., 4=Fri
  dayOfWeek: {
    type: Number,
    required: true,
  },
  win: {
    type: String,
    trim: true,
    default: '',
  },
  oneThing: {
    type: String,
    trim: true,
    default: '',
  },
  challenge: {
    type: String,
    trim: true,
    default: '',
  },
  // Derived: did yesterday's "one thing" match today's "win"?
  achievedOneThing: {
    type: Boolean,
    default: null, // null = not yet evaluated
  },
  // Derived: was the challenge resolved?
  challengeResolved: {
    type: Boolean,
    default: null,
  },
}, {
  timestamps: true,
});

// Unique constraint: one entry per user per day
standupEntrySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('StandupEntry', standupEntrySchema);
