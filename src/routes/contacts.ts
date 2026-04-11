import express from 'express';
import multer from 'multer';
import ContactController from '../controllers/ContactController';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// All routes protected by authenticateToken (applied at router level in routes/index.ts)

router.get('/',              ContactController.list);
router.get('/tags',          ContactController.getTags);
router.post('/',             ContactController.create);
router.post('/import/csv',   upload.single('file'), ContactController.importCSV);
router.get('/:id',           ContactController.getOne);
router.put('/:id',           ContactController.update);
router.delete('/:id',        ContactController.remove);
router.post('/:id/block',    ContactController.block);
router.post('/:id/unblock',  ContactController.unblock);
router.patch('/:id/tags',    ContactController.updateTags);

export default router;
