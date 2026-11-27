const express = require('express');
const router = express.Router();
const InterviewController = require('../controllers/interviewController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', InterviewController.getAll);
router.post('/', InterviewController.create);
router.post('/sync', InterviewController.sync);
router.put('/:id', InterviewController.update);
router.delete('/:id', InterviewController.delete);

module.exports = router;
