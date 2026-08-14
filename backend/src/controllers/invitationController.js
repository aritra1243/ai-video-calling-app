const crypto = require('crypto');
const Invitation = require('../models/Invitation');
const Meeting = require('../models/Meeting');
const User = require('../models/User');

// POST /api/invitations - Send a meeting invitation to a user
exports.createInvitation = async (req, res, next) => {
  try {
    const { inviteeId, meetingTitle, roomId: providedRoomId } = req.body;

    if (!inviteeId) {
      return res.status(400).json({ message: 'Invitee ID is required' });
    }

    const invitee = await User.findById(inviteeId);
    if (!invitee) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    let meeting;
    let roomId = providedRoomId;

    if (roomId) {
      meeting = await Meeting.findOne({ roomId });
    }

    if (!meeting) {
      roomId = roomId || crypto.randomUUID().slice(0, 8);
      const title = meetingTitle || `Call with ${invitee.name}`;
      meeting = new Meeting({
        roomId,
        hostId: req.user._id,
        title,
        participants: [{
          userId: req.user._id,
          name: req.user.name,
          email: req.user.email,
        }],
      });
      await meeting.save();
    }

    const invitation = new Invitation({
      inviterId: req.user._id,
      inviteeId,
      meetingId: meeting._id,
      roomId: meeting.roomId,
      meetingTitle: meeting.title,
      status: 'pending',
    });

    await invitation.save();

    const populated = await Invitation.findById(invitation._id)
      .populate('inviterId', 'name email avatar')
      .populate('inviteeId', 'name email avatar');

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation: populated,
      meeting,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/invitations - Get pending invitations for logged-in user
exports.getMyInvitations = async (req, res, next) => {
  try {
    const invitations = await Invitation.find({
      inviteeId: req.user._id,
      status: 'pending',
    })
      .populate('inviterId', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ invitations });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/invitations/:id/rsvp - Accept or decline an invitation
exports.rsvpInvitation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'accepted' | 'declined'

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ message: 'Status must be accepted or declined' });
    }

    const invitation = await Invitation.findOne({
      _id: id,
      inviteeId: req.user._id,
    });

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    invitation.status = status;
    await invitation.save();

    // If accepted, add user to meeting participants
    if (status === 'accepted') {
      const meeting = await Meeting.findOne({ roomId: invitation.roomId });
      if (meeting) {
        const exists = meeting.participants.some(
          p => p.userId?.toString() === req.user._id.toString()
        );
        if (!exists) {
          meeting.participants.push({
            userId: req.user._id,
            name: req.user.name,
            email: req.user.email,
          });
          await meeting.save();
        }
      }
    }

    res.json({
      message: `Invitation ${status}`,
      invitation,
    });
  } catch (error) {
    next(error);
  }
};
