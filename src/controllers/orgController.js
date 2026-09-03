const OrgModel = require('../models/orgModel');

function requireCompany(req, res) {
    if (!req.user?.companyId) {
        res.status(400).json({
            success: false,
            error: 'This account is not linked to a company. Contact an administrator.',
        });
        return null;
    }
    return req.user.companyId;
}

class OrgController {
    static async listBranches(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { status, page = 1, pageSize = 20 } = req.query;
            const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * (parseInt(pageSize, 10) || 20);
            
            const result = await OrgModel.listBranches(companyId, {
                pageSize: parseInt(pageSize),
                offset,
                status
            });
            
            res.json({
                success: true,
                data: result.rows.map(OrgModel.mapBranch),
                total: result.total,
                page: parseInt(page),
                pageSize: parseInt(pageSize)
            });
        } catch (error) {
            next(error);
        }
    }

    static async createBranch(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { name, address, pincode, category } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Branch name is required'
                });
            }

            const branch = await OrgModel.createBranch(companyId, {
                name,
                address,
                pincode,
                category
            });

            res.status(201).json({
                success: true,
                data: OrgModel.mapBranch(branch),
                message: 'Branch created successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateBranch(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { id } = req.params;
            const { name, address, pincode, category, status } = req.body;

            const branch = await OrgModel.updateBranch(companyId, id, {
                name,
                address,
                pincode,
                category,
                status
            });

            if (!branch) {
                return res.status(404).json({
                    success: false,
                    error: 'Branch not found'
                });
            }

            res.json({
                success: true,
                data: OrgModel.mapBranch(branch),
                message: 'Branch updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async deleteBranch(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { id } = req.params;
            
            const branch = await OrgModel.deleteBranch(companyId, id);
            if (!branch) {
                return res.status(404).json({
                    success: false,
                    error: 'Branch not found'
                });
            }

            res.json({
                success: true,
                message: 'Branch deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async listRecycledBranches(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { page = 1, pageSize = 20 } = req.query;
            const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * (parseInt(pageSize, 10) || 20);
            
            const result = await OrgModel.listRecycledBranches(companyId, {
                pageSize: parseInt(pageSize),
                offset
            });
            
            res.json({
                success: true,
                data: result.rows.map(OrgModel.mapBranch),
                total: result.total,
                page: parseInt(page),
                pageSize: parseInt(pageSize)
            });
        } catch (error) {
            next(error);
        }
    }

    static async restoreBranch(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { id } = req.params;
            
            const branch = await OrgModel.restoreBranch(companyId, id);
            if (!branch) {
                return res.status(404).json({ success: false, error: 'Recycled branch not found' });
            }

            res.json({
                success: true,
                message: 'Branch restored successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async hardDeleteBranch(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { id } = req.params;
            
            const branch = await OrgModel.hardDeleteBranch(companyId, id);
            if (!branch) {
                return res.status(404).json({ success: false, error: 'Recycled branch not found' });
            }

            res.json({
                success: true,
                message: 'Branch permanently deleted'
            });
        } catch (error) {
            next(error);
        }
    }

    // Department Management
    static async listDepartments(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { page = 1, pageSize = 20 } = req.query;
            const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * (parseInt(pageSize, 10) || 20);
            
            const result = await OrgModel.listDepartments(companyId, {
                pageSize: parseInt(pageSize),
                offset
            });
            
            res.json({
                success: true,
                data: result.rows.map(OrgModel.mapDepartment),
                total: result.total,
                page: parseInt(page),
                pageSize: parseInt(pageSize)
            });
        } catch (error) {
            next(error);
        }
    }

    static async createDepartment(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { department_name, dept_manager_name, departmentName, deptManagerName } = req.body;
            const deptName = department_name || departmentName;
            const managerName = dept_manager_name || deptManagerName;

            if (!deptName) {
                return res.status(400).json({
                    success: false,
                    error: 'Department name is required'
                });
            }

            const department = await OrgModel.createDepartment(companyId, {
                department_name: deptName,
                dept_manager_name: managerName
            });

            res.status(201).json({
                success: true,
                data: OrgModel.mapDepartment(department),
                message: 'Department created successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateDepartment(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { id } = req.params;
            const { department_name, dept_manager_name, departmentName, deptManagerName } = req.body;

            const department = await OrgModel.updateDepartment(companyId, id, {
                department_name: department_name || departmentName,
                dept_manager_name: dept_manager_name || deptManagerName
            });

            if (!department) {
                return res.status(404).json({
                    success: false,
                    error: 'Department not found'
                });
            }

            res.json({
                success: true,
                data: OrgModel.mapDepartment(department),
                message: 'Department updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async deleteDepartment(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { id } = req.params;
            
            const department = await OrgModel.deleteDepartment(companyId, id);
            if (!department) {
                return res.status(404).json({
                    success: false,
                    error: 'Department not found'
                });
            }

            res.json({
                success: true,
                message: 'Department deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async listRecycledDepartments(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { page = 1, pageSize = 20 } = req.query;
            const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * (parseInt(pageSize, 10) || 20);
            
            const result = await OrgModel.listRecycledDepartments(companyId, {
                pageSize: parseInt(pageSize),
                offset
            });
            
            res.json({
                success: true,
                data: result.rows.map(OrgModel.mapDepartment),
                total: result.total,
                page: parseInt(page),
                pageSize: parseInt(pageSize)
            });
        } catch (error) {
            next(error);
        }
    }

    static async restoreDepartment(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { id } = req.params;
            
            const department = await OrgModel.restoreDepartment(companyId, id);
            if (!department) {
                return res.status(404).json({ success: false, error: 'Recycled department not found' });
            }

            res.json({
                success: true,
                message: 'Department restored successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async hardDeleteDepartment(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { id } = req.params;
            
            const department = await OrgModel.hardDeleteDepartment(companyId, id);
            if (!department) {
                return res.status(404).json({ success: false, error: 'Recycled department not found' });
            }

            res.json({
                success: true,
                message: 'Department permanently deleted'
            });
        } catch (error) {
            next(error);
        }
    }

    // Asset Categories
    static async listCategories(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { page = 1, pageSize = 20 } = req.query;
            const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * (parseInt(pageSize, 10) || 20);
            
            const result = await OrgModel.listCategories(companyId, {
                pageSize: parseInt(pageSize),
                offset
            });
            
            res.json({
                success: true,
                data: result.rows.map(OrgModel.mapCategory),
                total: result.total,
                page: parseInt(page),
                pageSize: parseInt(pageSize)
            });
        } catch (error) {
            next(error);
        }
    }

    static async createCategory(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { category_name, category_code, categoryName, categoryCode } = req.body;
            const catName = category_name || categoryName;
            const catCode = category_code || categoryCode;

            if (!catName) {
                return res.status(400).json({
                    success: false,
                    error: 'Category name is required'
                });
            }

            const category = await OrgModel.createCategory(companyId, {
                category_name: catName,
                category_code: catCode
            });

            res.status(201).json({
                success: true,
                data: OrgModel.mapCategory(category),
                message: 'Category created successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateCategory(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { id } = req.params;
            const { category_name, category_code, categoryName, categoryCode } = req.body;

            const category = await OrgModel.updateCategory(companyId, id, {
                category_name: category_name || categoryName,
                category_code: category_code || categoryCode
            });

            if (!category) {
                return res.status(404).json({
                    success: false,
                    error: 'Category not found'
                });
            }

            res.json({
                success: true,
                data: OrgModel.mapCategory(category),
                message: 'Category updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async deleteCategory(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { id } = req.params;
            
            const category = await OrgModel.deleteCategory(companyId, id);
            if (!category) {
                return res.status(404).json({
                    success: false,
                    error: 'Category not found'
                });
            }

            res.json({
                success: true,
                message: 'Category moved to recycle bin'
            });
        } catch (error) {
            next(error);
        }
    }

    static async listRecycledCategories(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { page = 1, pageSize = 50 } = req.query;
            const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * (parseInt(pageSize, 10) || 50);

            const result = await OrgModel.listRecycledCategories(companyId, {
                pageSize: parseInt(pageSize),
                offset
            });

            res.json({
                success: true,
                data: result.rows.map(OrgModel.mapCategory),
                total: result.total,
                page: parseInt(page),
                pageSize: parseInt(pageSize)
            });
        } catch (error) {
            next(error);
        }
    }

    static async restoreCategory(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { id } = req.params;

            const category = await OrgModel.restoreCategory(companyId, id);
            if (!category) {
                return res.status(404).json({ success: false, error: 'Category not found' });
            }

            res.json({ success: true, data: OrgModel.mapCategory(category), message: 'Category restored successfully' });
        } catch (error) {
            next(error);
        }
    }

    static async hardDeleteCategory(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { id } = req.params;

            const category = await OrgModel.hardDeleteCategory(companyId, id);
            if (!category) {
                return res.status(404).json({ success: false, error: 'Category not found' });
            }

            res.json({ success: true, message: 'Category permanently deleted' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = OrgController;
