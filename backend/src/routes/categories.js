import { Router } from 'express';
import {
  getAllCategories, getCategoryById, createCategory, updateCategory, deleteCategory, bulkDeleteCategories
} from '../controllers/categoryController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/', getAllCategories);
router.get('/:id', getCategoryById);
router.post('/', createCategory);
router.post('/bulk-delete', bulkDeleteCategories);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;
