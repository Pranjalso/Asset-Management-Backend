const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

router.use(authenticateToken);

// Admin dashboard
router.get('/admin/stats', authorizeRoles('admin'), DashboardController.adminStats);

// Company dashboard
router.get('/stats', authorizeRoles('company_user', 'dashboard_user'), DashboardController.stats);
router.get('/usage', authorizeRoles('company_user', 'dashboard_user'), DashboardController.usage);
router.get('/notifications', DashboardController.notifications);
router.post('/notifications/read', DashboardController.markNotificationsRead);

module.exports = router;
