const express = require('express');
const router = express.Router();
const CompanyController = require('../controllers/companyController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Company Management - Admin only
router.get('/', authenticateToken, authorizeRoles('admin'), CompanyController.list);
router.get('/:id', authenticateToken, authorizeRoles('admin'), CompanyController.getById);
router.post('/', authenticateToken, authorizeRoles('admin'), CompanyController.create);
router.put('/:id', authenticateToken, authorizeRoles('admin'), CompanyController.update);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), CompanyController.delete);
router.post('/:id/block', authenticateToken, authorizeRoles('admin'), CompanyController.block);
router.post('/:id/unblock', authenticateToken, authorizeRoles('admin'), CompanyController.unblock);

module.exports = router;
