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

function formatDate(val) {
    if (!val) return null;
    try {
        return new Date(val).toISOString().split('T')[0]; // YYYY-MM-DD
    } catch {
        return String(val);
    }
}

function mapAsset(row) {
    const cost = row.acquisition_cost ?? row.purchase_price ?? null;
    const date = row.acquisition_date ?? row.purchase_date ?? null;
    return {
        id: String(row.id),
        name: row.asset_name,
        assetName: row.asset_name,
        description: row.description || '',
        assetDescription: row.description || '',
        categoryId: row.category_id ? String(row.category_id) : null,
        categoryName: row.category_name || '',
        assetCategory: row.category_name || '',
        branchId: row.current_branch_id ? String(row.current_branch_id) : null,
        branchName: row.branch_name || '',
        departmentId: row.current_department_id ? String(row.current_department_id) : null,
        departmentName: row.department_name || '',
        serialNumber: row.serial_number || '',
        purchaseDate: formatDate(row.purchase_date),
        purchasePrice: row.purchase_price,
        currentValue: row.current_value,
        status: row.status,
        recycleReason: row.recycle_reason || '',
        recycledAt: row.recycled_at || null,
        condition: row.condition || '',
        location: row.location || '',
        imageUrl: row.image_url || '',
        assetImage: row.image_url || '',
        vendorName: row.vendor_name || '',
        assetQuantity: row.quantity ?? 1,
        quantity: row.quantity ?? 1,
        assetShelfLife: row.shelf_life || '',
        invoiceNo: row.invoice_no || '',
        invoiceDate: formatDate(row.invoice_date),
        assetCompanyName: row.asset_company_name || '',
        acquisitionCost: cost,
        acquisitionDate: formatDate(date),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

const ASSET_SELECT = `
    SELECT a.*, c.category_name, b.name as branch_name, d.department_name
    FROM company_assets a
    LEFT JOIN asset_categories c ON a.category_id = c.id
    LEFT JOIN branches b ON a.current_branch_id = b.id
    LEFT JOIN departments d ON a.current_department_id = d.id
`;

class AssetsController {
    static async statsSummary(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const counts = await pool.query(
                `SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                    COUNT(*) FILTER (WHERE status = 'sold')::int AS sold,
                    COUNT(*) FILTER (WHERE status = 'scraped')::int AS scraped,
                    COUNT(*) FILTER (WHERE status = 'recycled')::int AS recycled,
                    COALESCE(SUM(CASE WHEN status <> 'recycled' THEN acquisition_cost END),0)::float AS totalValue
                 FROM company_assets WHERE company_id = $1`,
                [companyId]
            );
            const depts = await pool.query(
                `SELECT d.id, d.department_name,
                        COUNT(a.id) FILTER (WHERE a.status = 'active')::int AS assetCount,
                        COALESCE(SUM(CASE WHEN a.status = 'active' THEN a.acquisition_cost END),0)::float AS totalValue
                 FROM departments d
                 LEFT JOIN company_assets a ON a.current_department_id = d.id AND a.company_id = d.company_id
                 WHERE d.company_id = $1
                 GROUP BY d.id ORDER BY assetCount DESC, d.department_name`,
                [companyId]
            );
            const branches = await pool.query(
                `SELECT b.id, b.name AS branchName,
                        COUNT(a.id) FILTER (WHERE a.status = 'active')::int AS assetCount,
                        COALESCE(SUM(CASE WHEN a.status = 'active' THEN a.acquisition_cost END),0)::float AS totalValue
                 FROM branches b
                 LEFT JOIN company_assets a ON a.current_branch_id = b.id AND a.company_id = b.company_id
                 WHERE b.company_id = $1
                 GROUP BY b.id ORDER BY assetCount DESC, b.name`,
                [companyId]
            );
            res.json({
                success: true,
                data: {
                    counts: counts.rows[0],
                    departments: depts.rows.map(r => ({
                        id: String(r.id),
                        departmentName: r.department_name,
                        assetCount: r.assetcount || 0,
                        totalValue: r.totalvalue || 0,
                    })),
                    branches: branches.rows.map(r => ({
                        id: String(r.id),
                        branchName: r.branchname,
                        assetCount: r.assetcount || 0,
                        totalValue: r.totalvalue || 0,
                    })),
                }
            });
        } catch (error) {
            next(error);
        }
    }

    static async list(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;

            const { status, category, page = 1, pageSize = 20, search } = req.query;
            const limit = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
            const currentPage = Math.max(1, parseInt(page, 10) || 1);
            const offset = (currentPage - 1) * limit;

            const where = ['a.company_id = $1'];
            const params = [companyId];

            if (status) {
                params.push(status);
                where.push(`a.status = $${params.length}`);
            } else {
                where.push(`a.status <> 'recycled'`);
            }
            if (category) {
                params.push(category);
                where.push(`(a.category_id::text = $${params.length} OR c.category_name ILIKE $${params.length})`);
            }
            if (search) {
                params.push(`%${search}%`);
                where.push(`(a.asset_name ILIKE $${params.length} OR COALESCE(a.description,'') ILIKE $${params.length} OR COALESCE(a.vendor_name,'') ILIKE $${params.length})`);
            }

            const clause = where.join(' AND ');
            const countResult = await pool.query(
                `SELECT COUNT(*)::int AS total FROM company_assets a
                 LEFT JOIN asset_categories c ON a.category_id = c.id
                 WHERE ${clause}`,
                params
            );

            params.push(limit, offset);
            const result = await pool.query(
                `${ASSET_SELECT} WHERE ${clause} ORDER BY a.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );

            res.json({
                success: true,
                data: result.rows.map(mapAsset),
                total: countResult.rows[0].total,
                page: currentPage,
                pageSize: limit,
            });
        } catch (error) {
            next(error);
        }
    }

    static async listRecycled(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const result = await pool.query(
                `${ASSET_SELECT} WHERE a.company_id = $1 AND a.status = 'recycled' ORDER BY a.recycled_at DESC NULLS LAST, a.updated_at DESC`,
                [companyId]
            );
            res.json({ success: true, data: result.rows.map(mapAsset), total: result.rows.length });
        } catch (error) {
            next(error);
        }
    }

    static async getById(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const result = await pool.query(`${ASSET_SELECT} WHERE a.id = $1 AND a.company_id = $2`, [req.params.id, companyId]);
            if (!result.rows[0]) {
                return res.status(404).json({ success: false, error: 'Asset not found' });
            }
            res.json({ success: true, data: mapAsset(result.rows[0]) });
        } catch (error) {
            next(error);
        }
    }

    static async create(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const b = req.body || {};
            const name = b.name || b.assetName;
            if (!name || !String(name).trim()) {
                return res.status(400).json({ success: false, error: 'Asset name is required' });
            }

            let categoryId = b.category_id || b.categoryId || null;
            if (!categoryId && (b.assetCategory || b.categoryName)) {
                const cat = await pool.query(
                    `SELECT id FROM asset_categories WHERE company_id = $1 AND LOWER(category_name) = LOWER($2) LIMIT 1`,
                    [companyId, b.assetCategory || b.categoryName]
                );
                categoryId = cat.rows[0]?.id || null;
            }

            const result = await pool.query(
                `INSERT INTO company_assets (
                    company_id, category_id, asset_name, asset_company_name, vendor_name, quantity,
                    shelf_life, invoice_no, invoice_date, acquisition_cost, acquisition_date,
                    description, image_url, status, current_branch_id, current_department_id
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active',$14,$15)
                RETURNING id`,
                [
                    companyId,
                    categoryId,
                    String(name).trim(),
                    b.asset_company_name || b.assetCompanyName || null,
                    b.vendor_name || b.vendorName || null,
                    parseInt(b.quantity || b.assetQuantity, 10) || 1,
                    b.shelf_life || b.assetShelfLife || null,
                    b.invoice_no || b.invoiceNo || null,
                    parseDate(b.invoice_date || b.invoiceDate) || null,
                    b.purchase_price || b.purchasePrice || b.acquisitionCost || 0,
                    parseDate(b.purchase_date || b.purchaseDate || b.acquisitionDate) || null,
                    b.description || b.assetDescription || null,
                    b.image_url || b.assetImage || null,
                    b.branch_id || b.branchId || null,
                    b.department_id || b.departmentId || null,
                ]
            );

            const created = await pool.query(`${ASSET_SELECT} WHERE a.id = $1`, [result.rows[0].id]);
            res.status(201).json({
                success: true,
                data: mapAsset(created.rows[0]),
                message: 'Asset created successfully',
            });
        } catch (error) {
            next(error);
        }
    }

    static async update(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const b = req.body || {};
            const result = await pool.query(
                `UPDATE company_assets SET
                    asset_name = COALESCE($2, asset_name),
                    description = COALESCE($3, description),
                    category_id = COALESCE($4, category_id),
                    current_branch_id = COALESCE($5, current_branch_id),
                    current_department_id = COALESCE($6, current_department_id),
                    acquisition_date = COALESCE($7, acquisition_date),
                    acquisition_cost = COALESCE($8, acquisition_cost),
                    status = COALESCE($9, status),
                    image_url = COALESCE($10, image_url),
                    vendor_name = COALESCE($11, vendor_name),
                    quantity = COALESCE($12, quantity),
                    shelf_life = COALESCE($13, shelf_life),
                    invoice_no = COALESCE($14, invoice_no),
                    invoice_date = COALESCE($15, invoice_date),
                    asset_company_name = COALESCE($16, asset_company_name),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND company_id = $17
                RETURNING id`,
                [
                    req.params.id,
                    b.name || b.assetName || null,
                    b.description || b.assetDescription || null,
                    b.category_id || b.categoryId || null,
                    b.branch_id || b.branchId || null,
                    b.department_id || b.departmentId || null,
                    parseDate(b.purchase_date || b.purchaseDate || b.acquisitionDate),
                    b.purchase_price || b.purchasePrice || b.acquisitionCost || null,
                    b.status || null,
                    b.image_url || b.assetImage || null,
                    b.vendor_name || b.vendorName || null,
                    b.quantity || b.assetQuantity ? parseInt(b.quantity || b.assetQuantity, 10) : null,
                    b.shelf_life || b.assetShelfLife || null,
                    b.invoice_no || b.invoiceNo || null,
                    parseDate(b.invoice_date || b.invoiceDate),
                    b.asset_company_name || b.assetCompanyName || null,
                    companyId,
                ]
            );
            if (!result.rows[0]) {
                return res.status(404).json({ success: false, error: 'Asset not found' });
            }
            const updated = await pool.query(`${ASSET_SELECT} WHERE a.id = $1`, [result.rows[0].id]);
            res.json({ success: true, data: mapAsset(updated.rows[0]), message: 'Asset updated successfully' });
        } catch (error) {
            next(error);
        }
    }

    static async recycle(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const result = await pool.query(
                `UPDATE company_assets SET status = 'recycled', recycle_reason = $3, recycled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND company_id = $2 RETURNING id`,
                [req.params.id, companyId, req.body?.reason || null]
            );
            if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Asset not found' });
            res.json({ success: true, message: 'Asset moved to recycle bin' });
        } catch (error) {
            next(error);
        }
    }

    static async restore(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const result = await pool.query(
                `UPDATE company_assets SET status = 'active', recycle_reason = NULL, recycled_at = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND company_id = $2 RETURNING id`,
                [req.params.id, companyId]
            );
            if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Asset not found' });
            res.json({ success: true, message: 'Asset restored' });
        } catch (error) {
            next(error);
        }
    }

    static async delete(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const result = await pool.query(
                'DELETE FROM company_assets WHERE id = $1 AND company_id = $2 RETURNING id',
                [req.params.id, companyId]
            );
            if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Asset not found' });
            res.json({ success: true, message: 'Asset deleted permanently' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AssetsController;
