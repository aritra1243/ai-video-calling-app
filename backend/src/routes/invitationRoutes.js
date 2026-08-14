const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/invitationController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', invitationController.createInvitation);
router.get('/', invitationController.getMyInvitations);
router.patch('/:id/rsvp', invitationController.rsvpInvitation);

module.exports = router;
