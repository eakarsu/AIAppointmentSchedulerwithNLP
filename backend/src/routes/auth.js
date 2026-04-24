import { Router } from 'express';
import {
  login, register, getProfile, getDemoCredentials,
  forgotPassword, resetPassword, changePassword, logout, verifyEmail
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.get('/profile', authenticateToken, getProfile);
router.get('/demo-credentials', getDemoCredentials);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/change-password', authenticateToken, changePassword);
router.post('/logout', authenticateToken, logout);
router.get('/verify-email/:token', verifyEmail);

export default router;
