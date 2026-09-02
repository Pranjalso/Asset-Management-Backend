const express = require('express');
const router = express.Router();
const OrgController = require('../controllers/orgController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Branch Management
router.get('/branches', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.listBranches);
router.post('/branches', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.createBranch);
router.put('/branches/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.updateBranch);
router.delete('/branches/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.deleteBranch);

// Department Management
router.get('/departments', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.listDepartments);
router.post('/departments', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.createDepartment);
router.put('/departments/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.updateDepartment);
router.delete('/departments/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.deleteDepartment);

// Asset Categories
router.get('/categories', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.listCategories);
router.get('/categories/recycled', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.listRecycledCategories);
router.post('/categories', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.createCategory);
router.put('/categories/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.updateCategory);
router.delete('/categories/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.deleteCategory);
router.post('/categories/:id/restore', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.restoreCategory);
router.delete('/categories/:id/permanent', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.hardDeleteCategory);

module.exports = router;
