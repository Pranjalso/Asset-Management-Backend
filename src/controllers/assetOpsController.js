const pool = require('../config/database');
const { parseDate } = require('../utils/helpers');

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

async function findAsset(companyId, id, name) {
    if (id) {
        const r = await pool.query('SELECT * FROM company_assets WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (r.rows[0]) return r.rows[0];
    }
    if (name) {
        const r = await pool.query(
            `SELECT * FROM company_assets WHERE company_id = $1 AND LOWER(asset_name) = LOWER($2) AND status <> 'recycled' ORDER BY id DESC LIMIT 1`,
            [companyId, name]
        );
        return r.rows[0] || null;
    }
    return null;
}

async function findDept(companyId, id, name) {
    if (id) {
        const r = await pool.query('SELECT * FROM departments WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (r.rows[0]) return r.rows[0];
    }
    if (name) {
        const r = await pool.query(
            `SELECT * FROM departments WHERE company_id = $1 AND LOWER(department_name) = LOWER($2) LIMIT 1`,
            [companyId, name]
        );
        return r.rows[0] || null;
    }
    return null;
}

async function findBranch(companyId, id, name) {
    if (id) {
        const r = await pool.query('SELECT * FROM branches WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (r.rows[0]) return r.rows[0];
    }
    if (name) {
        const r = await pool.query(
            `SELECT * FROM branches WHERE company_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
            [companyId, name]
        );
        return r.rows[0] || null;
    }
    return null;
}

async function findEmployee(companyId, id, name) {
    if (id) {
        const r = await pool.query('SELECT * FROM employees WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (r.rows[0]) return r.rows[0];
    }
    if (name) {
        const r = await pool.query(
            `SELECT * FROM employees WHERE company_id = $1 AND LOWER(employee_name) = LOWER($2) LIMIT 1`,
            [companyId, name]
        );
        return r.rows[0] || null;
    }
    return null;
}

class AssetOpsController {
    static async listUsage(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { assetId, page = 1, pageSize = 20 } = req.query;
            const limit = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
            const currentPage = Math.max(1, parseInt(page, 10) || 1);
            const offset = (currentPage - 1) * limit;
            const params = [companyId];
            let extra = '';
            if (assetId) {
                params.push(assetId);
                extra = ` AND au.asset_id = $${params.length}`;
            }
            const countResult = await pool.query(
                `SELECT COUNT(*)::int AS total FROM asset_usage au WHERE au.company_id = $1${extra}`,
                params
            );
            params.push(limit, offset);
            const result = await pool.query(
                `SELECT au.*, a.asset_name as asset_name, e.employee_name as joined_employee, d.department_name as joined_dept
                 FROM asset_usage au
                 LEFT JOIN company_assets a ON au.asset_id = a.id
                 LEFT JOIN employees e ON au.employee_id = e.id
                 LEFT JOIN departments d ON au.department_id = d.id
                 WHERE au.company_id = $1${extra}
                 ORDER BY au.created_at DESC
                 LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );
            res.json({
                success: true,
                data: result.rows.map((row) => ({
                    id: String(row.id),
                    assetId: row.asset_id ? String(row.asset_id) : null,
                    assetName: row.asset_name || '',
                    employeeId: row.employee_id ? String(row.employee_id) : null,
                    employeeName: row.employee_name || row.joined_employee || '',
                    departmentName: row.department_name || row.joined_dept || '',
                    usageCost: row.usage_cost,
                    usageDate: row.usage_date,
                    usageType: row.usage_type,
                    notes: row.notes || '',
                    createdAt: row.created_at,
                })),
                total: countResult.rows[0].total,
                page: currentPage,
                pageSize: limit,
            });
        } catch (error) {
            next(error);
        }
    }

    static async createUsage(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const b = req.body || {};
            const asset = await findAsset(companyId, b.asset_id || b.assetId, b.asset_name || b.assetName);
            if (!asset) {
                return res.status(400).json({ success: false, error: 'Select a valid asset' });
            }
            const employee = await findEmployee(companyId, b.employee_id || b.employeeId, b.employee_name || b.employeeName);
            const dept = await findDept(companyId, b.department_id || b.departmentId, b.usage_department || b.departmentName || b.usageDepartment);
            if (dept) {
                await pool.query(
                    `UPDATE company_assets SET current_department_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND company_id = $3`,
                    [asset.id, dept.id, companyId]
                );
            }
            const result = await pool.query(
                `INSERT INTO asset_usage (company_id, asset_id, employee_id, department_id, employee_name, department_name, usage_cost, usage_date, usage_type, notes)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
                [
                    companyId,
                    asset.id,
                    employee?.id || null,
                    dept?.id || null,
                    b.employee_name || b.employeeName || employee?.employee_name || null,
                    dept?.department_name || b.usageDepartment || b.departmentName || null,
                    b.usage_cost || b.usageCost || 0,
                    parseDate(b.usage_date || b.usageDate) || new Date().toISOString().slice(0, 10),
                    b.usage_type || b.usageType || 'assigned',
                    b.notes || null,
                ]
            );
            res.status(201).json({
                success: true,
                data: { id: String(result.rows[0].id), ...result.rows[0] },
                message: 'Asset usage recorded successfully',
            });
        } catch (error) {
            next(error);
        }
    }

    static async listTransfers(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { assetId, type, page = 1, pageSize = 20 } = req.query;
            const limit = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
            const currentPage = Math.max(1, parseInt(page, 10) || 1);
            const offset = (currentPage - 1) * limit;
            const params = [companyId];
            const extra = [];
            if (assetId) {
                params.push(assetId);
                extra.push(`at.asset_id = $${params.length}`);
            }
            if (type) {
                params.push(type);
                extra.push(`at.transfer_type = $${params.length}`);
            }
            const clause = extra.length ? ` AND ${extra.join(' AND ')}` : '';
            const countResult = await pool.query(
                `SELECT COUNT(*)::int AS total FROM asset_transfers at WHERE at.company_id = $1${clause}`,
                params
            );
            params.push(limit, offset);
            const result = await pool.query(
                `SELECT at.*, a.asset_name as asset_name,
                        b_from.name as from_branch_name, b_to.name as to_branch_name,
                        d_from.department_name as from_department_name, d_to.department_name as to_department_name
                 FROM asset_transfers at
                 LEFT JOIN company_assets a ON at.asset_id = a.id
                 LEFT JOIN branches b_from ON at.from_branch_id = b_from.id
                 LEFT JOIN branches b_to ON at.to_branch_id = b_to.id
                 LEFT JOIN departments d_from ON at.from_department_id = d_from.id
                 LEFT JOIN departments d_to ON at.to_department_id = d_to.id
                 WHERE at.company_id = $1${clause}
                 ORDER BY at.created_at DESC
                 LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );
            res.json({
                success: true,
                data: result.rows.map((row) => ({
                    id: String(row.id),
                    assetId: row.asset_id ? String(row.asset_id) : null,
                    assetName: row.asset_name || '',
                    fromBranchId: row.from_branch_id ? String(row.from_branch_id) : null,
                    fromBranchName: row.from_branch_name || '',
                    toBranchId: row.to_branch_id ? String(row.to_branch_id) : null,
                    toBranchName: row.to_branch_name || '',
                    fromDepartmentId: row.from_department_id ? String(row.from_department_id) : null,
                    fromDepartmentName: row.from_department_name || '',
                    toDepartmentId: row.to_department_id ? String(row.to_department_id) : null,
                    toDepartmentName: row.to_department_name || '',
                    employeeName: row.employee_name || '',
                    transferCost: row.transfer_cost,
                    transferDate: row.transfer_date,
                    transferType: row.transfer_type,
                    notes: row.notes || '',
                    status: row.status,
                    createdAt: row.created_at,
                })),
                total: countResult.rows[0].total,
                page: currentPage,
                pageSize: limit,
            });
        } catch (error) {
            next(error);
        }
    }

    static async createTransfer(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const b = req.body || {};
            const asset = await findAsset(companyId, b.asset_id || b.assetId, b.asset_name || b.assetName);
            if (!asset) return res.status(400).json({ success: false, error: 'Select a valid asset' });

            const transferType = b.transfer_type || b.transferType || (b.branchName || b.to_branch_id ? 'branch' : 'department');
            const toBranch = await findBranch(companyId, b.to_branch_id, b.branchName || b.toBranch);
            const toDept = await findDept(companyId, b.to_department_id, b.departmentName || b.deptName || b.toDepartment);

            const result = await pool.query(
                `INSERT INTO asset_transfers (
                    company_id, asset_id, from_branch_id, to_branch_id, from_department_id, to_department_id,
                    employee_name, transfer_cost, transfer_date, transfer_type, notes, status
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'completed') RETURNING *`,
                [
                    companyId,
                    asset.id,
                    asset.current_branch_id,
                    toBranch?.id || null,
                    asset.current_department_id,
                    toDept?.id || null,
                    b.employee_name || b.employeeName || null,
                    b.transfer_cost || b.transferCost || 0,
                    parseDate(b.transfer_date || b.transferDate) || new Date().toISOString().slice(0, 10),
                    transferType,
                    b.notes || null,
                ]
            );

            await pool.query(
                `UPDATE company_assets SET
                    current_branch_id = COALESCE($2, current_branch_id),
                    current_department_id = COALESCE($3, current_department_id),
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND company_id = $4`,
                [asset.id, toBranch?.id || null, toDept?.id || null, companyId]
            );

            res.status(201).json({
                success: true,
                data: { id: String(result.rows[0].id), ...result.rows[0] },
                message: 'Asset transfer created successfully',
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateTransferStatus(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const result = await pool.query(
                `UPDATE asset_transfers SET status = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND company_id = $3 RETURNING *`,
                [req.params.id, req.body.status, companyId]
            );
            if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Transfer not found' });
            res.json({ success: true, data: { id: String(result.rows[0].id), ...result.rows[0] } });
        } catch (error) {
            next(error);
        }
    }

    static async listDecommissions(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const { assetId, decommissionType, page = 1, pageSize = 20 } = req.query;
            const limit = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
            const currentPage = Math.max(1, parseInt(page, 10) || 1);
            const offset = (currentPage - 1) * limit;
            const params = [companyId];
            const extra = [];
            if (assetId) {
                params.push(assetId);
                extra.push(`ad.asset_id = $${params.length}`);
            }
            if (decommissionType) {
                params.push(decommissionType);
                extra.push(`ad.decommission_type = $${params.length}`);
            }
            const clause = extra.length ? ` AND ${extra.join(' AND ')}` : '';
            const countResult = await pool.query(
                `SELECT COUNT(*)::int AS total FROM asset_decommission ad WHERE ad.company_id = $1${clause}`,
                params
            );
            params.push(limit, offset);
            const result = await pool.query(
                `SELECT ad.*, a.asset_name as asset_name
                 FROM asset_decommission ad
                 LEFT JOIN company_assets a ON ad.asset_id = a.id
                 WHERE ad.company_id = $1${clause}
                 ORDER BY ad.created_at DESC
                 LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );
            res.json({
                success: true,
                data: result.rows.map((row) => ({
                    id: String(row.id),
                    assetId: row.asset_id ? String(row.asset_id) : null,
                    assetName: row.asset_name || '',
                    decommissionType: row.decommission_type,
                    decommissionDate: row.decommission_date,
                    reason: row.reason || '',
                    salePrice: row.sale_price,
                    scrapValue: row.scrap_value,
                    customerName: row.customer_name || '',
                    vendorName: row.vendor_name || '',
                    invoiceNo: row.invoice_no || row.invoice_number || '',
                    invoiceDate: row.invoice_date,
                    invoiceSoldCost: row.sale_price,
                    condition: row.notes || row.reason || '',
                    notes: row.notes || '',
                    status: row.status,
                    createdAt: row.created_at,
                })),
                total: countResult.rows[0].total,
                page: currentPage,
                pageSize: limit,
            });
        } catch (error) {
            next(error);
        }
    }

    static async createDecommission(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const b = req.body || {};
            const type = b.decommission_type || b.decommissionType || (b.customerName || b.customer_name ? 'sale' : 'scrape');
            const asset = await findAsset(companyId, b.asset_id || b.assetId, b.asset_name || b.assetName);
            if (!asset) return res.status(400).json({ success: false, error: 'Select a valid asset' });

            const result = await pool.query(
                `INSERT INTO asset_decommission (
                    company_id, asset_id, decommission_type, decommission_date, reason,
                    sale_price, scrap_value, customer_name, vendor_name, invoice_no, invoice_date, notes, status
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'completed') RETURNING *`,
                [
                    companyId,
                    asset.id,
                    type,
                    parseDate(b.decommission_date || b.decommissionDate || b.invoiceDate) || new Date().toISOString().slice(0, 10),
                    b.reason || b.condition || null,
                    b.sale_price || b.salePrice || b.invoiceSoldCost || null,
                    b.scrap_value || b.scrapValue || null,
                    b.customer_name || b.customerName || null,
                    b.vendor_name || b.vendorName || null,
                    b.invoice_no || b.invoiceNo || b.invoice_number || b.invoiceNumber || null,
                    parseDate(b.invoice_date || b.invoiceDate),
                    b.notes || b.condition || null,
                ]
            );

            await pool.query(
                `UPDATE company_assets SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND company_id = $3`,
                [asset.id, type === 'sale' ? 'sold' : 'scraped', companyId]
            );

            res.status(201).json({
                success: true,
                data: { id: String(result.rows[0].id), ...result.rows[0] },
                message: 'Asset decommission recorded',
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateDecommissionStatus(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const result = await pool.query(
                `UPDATE asset_decommission SET status = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND company_id = $3 RETURNING *`,
                [req.params.id, req.body.status, companyId]
            );
            if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Decommission record not found' });
            res.json({ success: true, data: { id: String(result.rows[0].id), ...result.rows[0] } });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AssetOpsController;
