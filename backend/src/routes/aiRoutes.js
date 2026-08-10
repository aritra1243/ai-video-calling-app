const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/:id/transcribe', aiController.transcribe);
router.post('/:id/summarize', aiController.summarize);
router.post('/:id/ask', aiController.askMeeting);
router.get('/:id/transcript', aiController.getTranscript);
router.get('/:id/summary', aiController.getSummary);

module.exports = router;
