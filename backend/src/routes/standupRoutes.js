const express = require('express');
const router = express.Router();
const standupController = require('../controllers/standupController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', standupController.createStandup);
router.get('/my', standupController.getMyStandups);
router.get('/today', standupController.getTodayStandup);
router.get('/weekly', standupController.getWeeklyStandups);
router.get('/daily', standupController.getDailyStandups);
router.get('/available-weeks', standupController.getAvailableWeeks);

module.exports = router;
