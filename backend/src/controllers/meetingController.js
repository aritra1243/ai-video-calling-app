const crypto = require('crypto');
const mongoose = require('mongoose');
const Meeting = require('../models/Meeting');
const path = require('path');
const fs = require('fs');

// Helper to query meeting by ObjectId _id or string roomId safely without Mongoose CastError
const getMeetingQuery = (id) => {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return { $or: [{ _id: id }, { roomId: id }] };
  }
  return { roomId: id };
};

// POST /api/meetings
exports.createMeeting = async (req, res, next) => {
  try {
    const { title } = req.body;
    const roomId = crypto.randomUUID().slice(0, 8);

    const meeting = new Meeting({
      roomId,
      hostId: req.user._id,
      title: title || 'Untitled Meeting',
      participants: [{
        userId: req.user._id,
        name: req.user.name,
        email: req.user.email,
      }],
    });

    await meeting.save();

    res.status(201).json({
      message: 'Meeting created',
      meeting,
      meetingLink: `/meeting/${roomId}`,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/meetings
exports.getMeetings = async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = {
      $or: [
        { hostId: req.user._id },
        { 'participants.userId': req.user._id },
      ],
    };

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$and = [
        {
          $or: [
            { title: searchRegex },
            { roomId: searchRegex },
            { 'transcript.text': searchRegex },
            { 'summary.summary': searchRegex },
          ],
        },
      ];
    }

    const meetings = await Meeting.find(query)
      .sort({ createdAt: -1 })
      .populate('hostId', 'name email avatar')
      .limit(50);

    res.json({ meetings });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/meetings/:id/action-items/:itemIndex
exports.toggleActionItem = async (req, res, next) => {
  try {
    const { id, itemIndex } = req.params;
    const index = parseInt(itemIndex, 10);

    const meeting = await Meeting.findOne(getMeetingQuery(id));

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    if (!meeting.summary || !meeting.summary.actionItems || !meeting.summary.actionItems[index]) {
      return res.status(404).json({ message: 'Action item not found' });
    }

    meeting.summary.actionItems[index].completed = !meeting.summary.actionItems[index].completed;
    meeting.markModified('summary');
    await meeting.save();

    res.json({
      message: 'Action item updated',
      actionItems: meeting.summary.actionItems,
    });
  } catch (error) {
    next(error);
  }
};


// GET /api/meetings/:id
exports.getMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne(getMeetingQuery(req.params.id)).populate('hostId', 'name email avatar');

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    res.json({ meeting });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/meetings/:id
exports.deleteMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne(getMeetingQuery(req.params.id));

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    if (meeting.hostId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the host can delete this meeting' });
    }

    // Delete recording file if exists
    if (meeting.recordingFilename) {
      const filePath = path.join(__dirname, '../../storage/recordings', meeting.recordingFilename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Meeting.findByIdAndDelete(meeting._id);
    res.json({ message: 'Meeting deleted' });
  } catch (error) {
    next(error);
  }
};

// POST /api/meetings/:id/recording
exports.uploadRecording = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No recording file uploaded' });
    }

    const meeting = await Meeting.findOne(getMeetingQuery(req.params.id));

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    meeting.recordingUrl = `/api/meetings/${meeting._id}/recording`;
    meeting.recordingFilename = req.file.filename;
    meeting.status = 'ended';
    meeting.endedAt = new Date();
    await meeting.save();

    res.json({
      message: 'Recording uploaded successfully',
      meeting,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/meetings/:id/recording
exports.getRecording = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne(getMeetingQuery(req.params.id));

    if (!meeting || !meeting.recordingFilename) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    const filePath = path.join(__dirname, '../../storage/recordings', meeting.recordingFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Recording file not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/meetings/:id/join
exports.joinMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne(getMeetingQuery(req.params.id));

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Add participant if not already in the list
    const alreadyJoined = meeting.participants.some(
      (p) => p.userId && p.userId.toString() === req.user._id.toString()
    );

    if (!alreadyJoined) {
      meeting.participants.push({
        userId: req.user._id,
        name: req.user.name,
        email: req.user.email,
      });
    }

    if (meeting.status === 'scheduled') {
      meeting.status = 'active';
      meeting.startedAt = new Date();
    }

    await meeting.save();
    res.json({ meeting });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/meetings/:id/end
exports.endMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne(getMeetingQuery(req.params.id));

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Only the host can end the meeting
    if (meeting.hostId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the host can end this meeting' });
    }

    meeting.status = 'ended';
    meeting.endedAt = new Date();
    await meeting.save();

    res.json({ meeting });
  } catch (error) {
    next(error);
  }
};

