import { Router } from 'express';
import {
  getAllContacts, getContactById, createContact, updateContact, deleteContact, bulkDeleteContacts, getOverdueContacts
} from '../controllers/contactController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = Router();
router.use(authenticateToken);

router.get('/', getAllContacts);
router.get('/overdue', getOverdueContacts);
router.get('/:id', getContactById);
router.post('/', validate('createContact'), createContact);
router.post('/bulk-delete', bulkDeleteContacts);
router.put('/:id', validate('updateContact'), updateContact);
router.delete('/:id', deleteContact);

export default router;
