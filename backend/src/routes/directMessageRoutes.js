const express = require('express');
const router = express.Router();
const {
  getDirectMessages,
  sendDirectMessage,
} = require('../controllers/directMessageController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/direct', sendDirectMessage);
router.get('/direct/:userId', getDirectMessages);

router.post('/', sendDirectMessage);
router.get('/:userId', getDirectMessages);

module.exports = router;
