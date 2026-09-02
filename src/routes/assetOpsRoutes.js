const express = require('express');
const router = express.Router();
const AssetOpsController = require('../controllers/assetOpsController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authenticateToken);

// Only company users can manage asset operations
router.use(authorizeRoles('company_user', 'dashboard_user'));

// Asset Usage
router.get('/usage', AssetOpsController.listUsage);
router.post('/usage', AssetOpsController.createUsage);

// Asset Transfer
router.get('/transfers', AssetOpsController.listTransfers);
router.post('/transfers', AssetOpsController.createTransfer);
router.put('/transfers/:id/status', AssetOpsController.updateTransferStatus);

// Asset Decommission
router.get('/decommissions', AssetOpsController.listDecommissions);
router.post('/decommissions', AssetOpsController.createDecommission);
router.put('/decommissions/:id/status', AssetOpsController.updateDecommissionStatus);

module.exports = router;
