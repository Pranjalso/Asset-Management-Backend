const express = require('express');
const router = express.Router();
const EmployeeController = require('../controllers/employeeController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Employee Management - Admin only
router.get('/', authenticateToken, authorizeRoles('admin'), EmployeeController.list);
router.get('/:id', authenticateToken, authorizeRoles('admin'), EmployeeController.getById);
router.post('/', authenticateToken, authorizeRoles('admin'), EmployeeController.create);
router.put('/:id', authenticateToken, authorizeRoles('admin'), EmployeeController.update);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), EmployeeController.delete);
router.post('/:id/recycle', authenticateToken, authorizeRoles('admin'), EmployeeController.recycle);
router.post('/:id/recover', authenticateToken, authorizeRoles('admin'), EmployeeController.recover);

module.exports = router;
