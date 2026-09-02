const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/register', AuthController.register);

router.post('/login', AuthController.login);

router.post('/login/admin', AuthController.loginAdmin);

router.post('/login/company', AuthController.loginCompany);

router.post('/login/company/google', AuthController.loginCompanyWithGoogle);

router.post('/logout', AuthController.logout);
router.post('/refresh', AuthController.refresh);

router.get('/me', authenticateToken, AuthController.getCurrentUser);
router.get('/notifications', authenticateToken, AuthController.notifications);
router.post('/notifications/read', authenticateToken, AuthController.markNotificationsRead);

router.get('/profile', authenticateToken, AuthController.getProfile);
router.put('/profile', authenticateToken, AuthController.updateProfile);
router.post('/profile/change-password', authenticateToken, AuthController.changePassword);
router.post('/profile/avatar/request-upload', authenticateToken, AuthController.requestAvatarUpload);
router.post('/profile/avatar/confirm-upload', authenticateToken, AuthController.confirmAvatarUpload);

module.exports = router;
