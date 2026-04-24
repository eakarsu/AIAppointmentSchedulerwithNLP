import { Router } from 'express';
import {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  createFromNaturalLanguage,
  getUpcoming,
  bulkDeleteAppointments,
  bulkUpdateAppointments
} from '../controllers/appointmentController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getAllAppointments);
router.get('/upcoming', getUpcoming);
router.get('/:id', getAppointmentById);
router.post('/', createAppointment);
router.post('/nlp', createFromNaturalLanguage);
router.post('/bulk-delete', bulkDeleteAppointments);
router.put('/bulk-update', bulkUpdateAppointments);
router.put('/:id', updateAppointment);
router.delete('/:id', deleteAppointment);

export default router;
