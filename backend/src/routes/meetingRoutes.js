const express = require('express');
const router = express.Router();
const multer = require('multer');
const meetingController = require('../controllers/meetingController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.use(authMiddleware);

router.post('/', meetingController.createMeeting);
router.get('/', meetingController.getMeetings);
router.get('/:id', meetingController.getMeeting);
router.get('/:id/messages', meetingController.getMeetingMessages);
router.delete('/:id', meetingController.deleteMeeting);
router.patch('/:id/join', meetingController.joinMeeting);
router.patch('/:id/end', meetingController.endMeeting);
router.patch('/:id/action-items/:itemIndex', meetingController.toggleActionItem);

// Recording upload with explicit multer error handling
router.post('/:id/recording', (req, res, next) => {
  upload.single('recording')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error during recording upload:', err.code, err.message);
      return res.status(400).json({
        message: `Upload error: ${err.message}`,
        code: err.code,
      });
    } else if (err) {
      console.error('Non-multer upload error:', err.message);
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, meetingController.uploadRecording);

router.get('/:id/recording', meetingController.getRecording);

module.exports = router;
