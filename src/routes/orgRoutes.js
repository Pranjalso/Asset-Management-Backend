const express = require('express');
const router = express.Router();
const OrgController = require('../controllers/orgController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Branch Management
router.get('/branches', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.listBranches);
router.get('/branches/recycled', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.listRecycledBranches);
router.post('/branches', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.createBranch);
router.put('/branches/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.updateBranch);
router.delete('/branches/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.deleteBranch);
router.post('/branches/:id/restore', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.restoreBranch);
router.delete('/branches/:id/permanent', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.hardDeleteBranch);

// Department Management
router.get('/departments', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.listDepartments);
router.get('/departments/recycled', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.listRecycledDepartments);
router.post('/departments', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.createDepartment);
router.put('/departments/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.updateDepartment);
router.delete('/departments/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.deleteDepartment);
router.post('/departments/:id/restore', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.restoreDepartment);
router.delete('/departments/:id/permanent', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.hardDeleteDepartment);

// Asset Categories
router.get('/categories', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.listCategories);
router.get('/categories/recycled', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.listRecycledCategories);
router.post('/categories', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.createCategory);
router.put('/categories/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.updateCategory);
router.delete('/categories/:id', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.deleteCategory);
router.post('/categories/:id/restore', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.restoreCategory);
router.delete('/categories/:id/permanent', authenticateToken, authorizeRoles('company_user', 'dashboard_user'), OrgController.hardDeleteCategory);

module.exports = router;
