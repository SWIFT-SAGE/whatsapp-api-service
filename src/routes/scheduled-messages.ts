import express from 'express';
import ScheduledMessageController from '../controllers/ScheduledMessageController';

const router = express.Router();

// All routes protected by authenticateToken (applied at router level in routes/index.ts)

router.post('/',       ScheduledMessageController.create);
router.get('/',        ScheduledMessageController.list);
router.delete('/:id',  ScheduledMessageController.cancel);

export default router;
