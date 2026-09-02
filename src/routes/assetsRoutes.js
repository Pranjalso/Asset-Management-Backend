const express = require('express');
const router = express.Router();
const AssetsController = require('../controllers/assetsController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Asset Management - Company users only
router.get('/stats/summary', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), AssetsController.statsSummary);
router.get('/recycled/list', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), AssetsController.listRecycled);

router.get('/', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), AssetsController.list);
router.get('/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), AssetsController.getById);
router.post('/', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), AssetsController.create);
router.put('/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), AssetsController.update);
router.put('/:id/recycle', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), AssetsController.recycle);
router.put('/:id/restore', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), AssetsController.restore);
router.delete('/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), AssetsController.delete);

module.exports = router;
