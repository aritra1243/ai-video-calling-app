const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.use(authMiddleware);

router.post('/', meetingController.createMeeting);
router.get('/', meetingController.getMeetings);
router.get('/:id', meetingController.getMeeting);
router.delete('/:id', meetingController.deleteMeeting);
router.patch('/:id/join', meetingController.joinMeeting);
router.patch('/:id/end', meetingController.endMeeting);
router.patch('/:id/action-items/:itemIndex', meetingController.toggleActionItem);
router.post('/:id/recording', upload.single('recording'), meetingController.uploadRecording);
router.get('/:id/recording', meetingController.getRecording);

module.exports = router;
