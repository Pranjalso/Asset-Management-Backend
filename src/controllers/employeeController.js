const EmployeeModel = require('../models/employeeModel');
const CompanyModel = require('../models/companyModel');

class EmployeeController {
    static async list(req, res, next) {
        try {
            const { status, page = 1, pageSize = 10, companyId } = req.query;
            const offset = (page - 1) * pageSize;
            const result = await EmployeeModel.list({
                status,
                pageSize: parseInt(pageSize),
                offset,
                companyId: companyId ? parseInt(companyId) : null
            });
            res.json({
                success: true,
                data: result.rows.map(row => EmployeeModel.map(row, row.company_name)),
                total: result.total,
                page: parseInt(page),
                pageSize: parseInt(pageSize)
            });
        } catch (error) {
            next(error);
        }
    }

    static async getById(req, res, next) {
        try {
            const employee = await EmployeeModel.findById(req.params.id);
            if (!employee) {
                return res.status(404).json({
                    success: false,
                    error: 'Employee not found'
                });
            }
            res.json({
                success: true,
                data: EmployeeModel.map(employee, employee.company_name)
            });
        } catch (error) {
            next(error);
        }
    }

    static async create(req, res, next) {
        try {
            const {
                company_id,
                employee_name,
                mobile_no,
                designation,
                email,
                password
            } = req.body;

            // Validate required fields
            if (!company_id || !employee_name || !email) {
                return res.status(400).json({
                    success: false,
                    error: 'Company ID, employee name, and email are required'
                });
            }

            // Check if company exists
            const company = await CompanyModel.findById(company_id);
            if (!company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            const employee = await EmployeeModel.create({
                company_id,
                employee_name,
                mobile_no,
                designation,
                email,
                password
            });

            res.status(201).json({
                success: true,
                data: EmployeeModel.map(employee, company.company_name),
                message: 'Employee created successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async update(req, res, next) {
        try {
            const { id } = req.params;
            const {
                company_id,
                employee_name,
                mobile_no,
                designation,
                email,
                password
            } = req.body;

            const existing = await EmployeeModel.findById(id);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: 'Employee not found'
                });
            }

            // Check if company exists if being changed
            if (company_id && company_id !== existing.company_id) {
                const company = await CompanyModel.findById(company_id);
                if (!company) {
                    return res.status(404).json({
                        success: false,
                        error: 'Company not found'
                    });
                }
            }

            const employee = await EmployeeModel.update(id, {
                company_id,
                employee_name,
                mobile_no,
                designation,
                email,
                password
            });

            const companyName = employee.company_id ? 
                (await CompanyModel.findById(employee.company_id))?.company_name : 
                existing.company_name;

            res.json({
                success: true,
                data: EmployeeModel.map(employee, companyName),
                message: 'Employee updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async delete(req, res, next) {
        try {
            const { id } = req.params;
            const employee = await EmployeeModel.remove(id);
            if (!employee) {
                return res.status(404).json({
                    success: false,
                    error: 'Employee not found'
                });
            }
            res.json({
                success: true,
                message: 'Employee deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async recycle(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Recycle reason is required'
                });
            }

            const employee = await EmployeeModel.recycle(id, reason);
            if (!employee) {
                return res.status(404).json({
                    success: false,
                    error: 'Employee not found'
                });
            }

            const company = await CompanyModel.findById(employee.company_id);

            res.json({
                success: true,
                data: EmployeeModel.map(employee, company?.company_name),
                message: 'Employee recycled successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async recover(req, res, next) {
        try {
            const { id } = req.params;
            const employee = await EmployeeModel.recover(id);
            if (!employee) {
                return res.status(404).json({
                    success: false,
                    error: 'Employee not found'
                });
            }

            const company = await CompanyModel.findById(employee.company_id);

            res.json({
                success: true,
                data: EmployeeModel.map(employee, company?.company_name),
                message: 'Employee recovered successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = EmployeeController;
