const DirectMessage = require('../models/DirectMessage');
const User = require('../models/User');

// @desc    Get direct messages between authenticated user and another user
// @route   GET /api/messages/direct/:userId
// @access  Private
exports.getDirectMessages = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { userId: otherUserId } = req.params;

    const messages = await DirectMessage.find({
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(100);

    // Mark unread messages sent to current user as read
    await DirectMessage.updateMany(
      { senderId: otherUserId, receiverId: currentUserId, read: false },
      { $set: { read: true } }
    );

    res.json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Send a direct message
// @route   POST /api/messages/direct
// @access  Private
exports.sendDirectMessage = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const { receiverId, message } = req.body;

    if (!receiverId || !message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and message content are required',
      });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Recipient user not found',
      });
    }

    const directMsg = await DirectMessage.create({
      senderId,
      receiverId,
      senderName: req.user.name,
      message: message.trim(),
    });

    res.status(201).json({
      success: true,
      message: directMsg,
    });
  } catch (err) {
    next(err);
  }
};
