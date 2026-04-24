import { Router } from 'express';
import {
  getAllContacts, getContactById, createContact, updateContact, deleteContact, bulkDeleteContacts
} from '../controllers/contactController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/', getAllContacts);
router.get('/:id', getContactById);
router.post('/', createContact);
router.post('/bulk-delete', bulkDeleteContacts);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

export default router;
