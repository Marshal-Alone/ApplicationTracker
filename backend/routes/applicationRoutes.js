const express = require('express');
const router = express.Router();
const ApplicationController = require('../controllers/applicationController');
const { authMiddleware } = require('../middleware/auth');

// All application routes are protected by authMiddleware (JWT Bearer or API Key)
router.use(authMiddleware);

router.get('/', ApplicationController.getAll);
router.post('/', ApplicationController.create);
router.post('/sync', ApplicationController.sync);
router.put('/:id', ApplicationController.update);
router.delete('/:id', ApplicationController.delete);

module.exports = router;
