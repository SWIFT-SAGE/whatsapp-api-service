import express from 'express';
import CampaignController from '../controllers/CampaignController';

const router = express.Router();

// All routes protected by authenticateToken (applied at router level in routes/index.ts)

router.post('/',            CampaignController.create);
router.get('/',             CampaignController.list);
router.get('/:id',          CampaignController.getOne);
router.post('/:id/start',   CampaignController.start);
router.post('/:id/pause',   CampaignController.pause);
router.post('/:id/cancel',  CampaignController.cancel);
router.delete('/:id',       CampaignController.remove);

export default router;
