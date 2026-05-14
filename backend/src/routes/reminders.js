import { Router } from 'express';
import {
  getAllReminders, getReminderById, createReminder, updateReminder, deleteReminder, bulkDeleteReminders, sendDueReminders
} from '../controllers/reminderController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = Router();
router.use(authenticateToken);

router.get('/', getAllReminders);
router.get('/:id', getReminderById);
router.post('/', validate('createReminder'), createReminder);
router.post('/bulk-delete', bulkDeleteReminders);
router.post('/send-due', sendDueReminders);
router.put('/:id', updateReminder);
router.delete('/:id', deleteReminder);

export default router;
