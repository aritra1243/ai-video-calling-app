const express = require('express');
const router = express.Router();
const {
  getDirectMessages,
  sendDirectMessage,
} = require('../controllers/directMessageController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/direct')
  .post(sendDirectMessage);

router.route('/direct/:userId')
  .get(getDirectMessages);

module.exports = router;
