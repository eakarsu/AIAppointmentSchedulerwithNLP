import { Router } from 'express';
import {
  login, register, getProfile, getDemoCredentials,
  forgotPassword, resetPassword, changePassword, logout, verifyEmail
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = Router();

router.post('/login', validate('login'), login);
router.post('/register', validate('register'), register);
router.get('/me', authenticateToken, getProfile);
router.get('/profile', authenticateToken, getProfile);
router.get('/demo-credentials', getDemoCredentials);
router.post('/forgot-password', validate('forgotPassword'), forgotPassword);
router.post('/reset-password', validate('resetPassword'), resetPassword);
router.put('/change-password', authenticateToken, validate('changePassword'), changePassword);
router.post('/logout', authenticateToken, logout);
router.get('/verify-email/:token', verifyEmail);

export default router;
