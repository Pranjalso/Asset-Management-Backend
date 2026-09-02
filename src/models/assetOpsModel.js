const pool = require('../config/database');
const { formatDate } = require('../utils/helpers');

class AssetOpsModel {
    static mapAsset(row) {
        if (!row) return null;
        return {
            id: String(row.id),
            assetName: row.asset_name,
            assetCategory: row.category_name || '',
            categoryId: row.category_id ? String(row.category_id) : '',
            assetCompanyName: row.asset_company_name || '',
            vendorName: row.vendor_name || '',
            assetQuantity: row.quantity ?? 0,
            assetShelfLife: row.shelf_life || '',
            invoiceNo: row.invoice_no || '',
            invoiceDate: formatDate(row.invoice_date),
            acquisitionCost: row.acquisition_cost ?? 0,
            acquisitionDate: formatDate(row.acquisition_date),
            assetDescription: row.description || '',
            assetImage: row.image_url || '',
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    static async listAssets(companyId, { pageSize, offset, categoryId, status, search } = {}) {
        const params = [companyId];
        const where = ['a.company_id = $1'];
        if (status) {
            params.push(status);
            where.push(`a.status = $${params.length}`);
        } else {
            where.push(`a.status <> 'recycled'`);
        }
        if (categoryId) {
            params.push(categoryId);
            where.push(`(a.category_id::text = $${params.length} OR c.category_name ILIKE $${params.length})`);
        }
        if (search) {
            params.push(`%${search}%`);
            where.push(`(a.asset_name ILIKE $${params.length} OR a.vendor_name ILIKE $${params.length})`);
        }
        const clause = where.join(' AND ');
        const count = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM company_assets a
             LEFT JOIN asset_categories c ON c.id = a.category_id
             WHERE ${clause}`,
            params
        );
        params.push(pageSize || 50, offset || 0);
        const result = await pool.query(
            `SELECT a.*, c.category_name
             FROM company_assets a
             LEFT JOIN asset_categories c ON c.id = a.category_id
             WHERE ${clause}
             ORDER BY a.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        return { rows: result.rows, total: count.rows[0].total };
    }

    static async findAsset(companyId, id) {
        const result = await pool.query(
            `SELECT a.*, c.category_name
             FROM company_assets a
             LEFT JOIN asset_categories c ON c.id = a.category_id
             WHERE a.id = $1 AND a.company_id = $2`,
            [id, companyId]
        );
        return result.rows[0];
    }

    static async findAssetByName(companyId, name) {
        const result = await pool.query(
            `SELECT a.*, c.category_name
             FROM company_assets a
             LEFT JOIN asset_categories c ON c.id = a.category_id
             WHERE a.company_id = $1 AND LOWER(a.asset_name) = LOWER($2)
             ORDER BY a.id DESC LIMIT 1`,
            [companyId, name]
        );
        return result.rows[0];
    }

    static async createAsset(companyId, data) {
        const result = await pool.query(
            `INSERT INTO company_assets (
                company_id, category_id, asset_name, asset_company_name, vendor_name, quantity,
                shelf_life, invoice_no, invoice_date, acquisition_cost, acquisition_date,
                description, image_url, status
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active')
             RETURNING *`,
            [
                companyId,
                data.category_id || null,
                data.asset_name,
                data.asset_company_name || null,
                data.vendor_name || null,
                data.quantity || 1,
                data.shelf_life || null,
                data.invoice_no || null,
                data.invoice_date || null,
                data.acquisition_cost || 0,
                data.acquisition_date || null,
                data.description || null,
                data.image_url || null,
            ]
        );
        return this.findAsset(companyId, result.rows[0].id);
    }

    static async updateAsset(companyId, id, data) {
        await pool.query(
            `UPDATE company_assets SET
                category_id = COALESCE($3, category_id),
                asset_name = COALESCE($4, asset_name),
                asset_company_name = COALESCE($5, asset_company_name),
                vendor_name = COALESCE($6, vendor_name),
                quantity = COALESCE($7, quantity),
                shelf_life = COALESCE($8, shelf_life),
                invoice_no = COALESCE($9, invoice_no),
                invoice_date = COALESCE($10, invoice_date),
                acquisition_cost = COALESCE($11, acquisition_cost),
                acquisition_date = COALESCE($12, acquisition_date),
                description = COALESCE($13, description),
                image_url = COALESCE($14, image_url),
                status = COALESCE($15, status),
                current_branch_id = COALESCE($16, current_branch_id),
                current_department_id = COALESCE($17, current_department_id),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND company_id = $2`,
            [
                id,
                companyId,
                data.category_id ?? null,
                data.asset_name ?? null,
                data.asset_company_name ?? null,
                data.vendor_name ?? null,
                data.quantity ?? null,
                data.shelf_life ?? null,
                data.invoice_no ?? null,
                data.invoice_date ?? null,
                data.acquisition_cost ?? null,
                data.acquisition_date ?? null,
                data.description ?? null,
                data.image_url ?? null,
                data.status ?? null,
                data.current_branch_id ?? null,
                data.current_department_id ?? null,
            ]
        );
        return this.findAsset(companyId, id);
    }

    static async recycleAsset(companyId, id, reason) {
        const result = await pool.query(
            `UPDATE company_assets SET status = 'recycled', recycle_reason = $3, recycled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND company_id = $2 RETURNING *`,
            [id, companyId, reason || null]
        );
        return result.rows[0];
    }

    static async restoreAsset(companyId, id) {
        const result = await pool.query(
            `UPDATE company_assets SET status = 'active', recycle_reason = NULL, recycled_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND company_id = $2 RETURNING *`,
            [id, companyId]
        );
        return result.rows[0];
    }

    static async deleteAsset(companyId, id) {
        const result = await pool.query(
            'DELETE FROM company_assets WHERE id = $1 AND company_id = $2 RETURNING *',
            [id, companyId]
        );
        return result.rows[0];
    }

    static async stats(companyId) {
        const result = await pool.query(
            `SELECT
                COUNT(*) FILTER (WHERE status = 'active')::int AS total,
                COUNT(*) FILTER (WHERE status = 'sold')::int AS sold,
                COUNT(*) FILTER (WHERE status = 'scraped')::int AS scraped
             FROM company_assets
             WHERE company_id = $1 AND status <> 'recycled'`,
            [companyId]
        );
        const row = result.rows[0];
        return { total: row.total || 0, sold: row.sold || 0, scraped: row.scraped || 0 };
    }

    static async deptUsage(companyId) {
        const result = await pool.query(
            `SELECT d.id, d.department_name,
                    COUNT(a.id) FILTER (WHERE a.status = 'active')::int AS asset_count
             FROM departments d
             LEFT JOIN company_assets a ON a.current_department_id = d.id AND a.company_id = d.company_id
             WHERE d.company_id = $1
             GROUP BY d.id
             ORDER BY asset_count DESC, d.department_name`,
            [companyId]
        );
        return result.rows.map((row) => ({
            id: String(row.id),
            departmentName: row.department_name,
            assetCount: row.asset_count,
        }));
    }

    static async branchUsage(companyId) {
        const result = await pool.query(
            `SELECT b.id, b.name AS branch_name,
                    COUNT(a.id) FILTER (WHERE a.status = 'active')::int AS asset_count
             FROM branches b
             LEFT JOIN company_assets a ON a.current_branch_id = b.id AND a.company_id = b.company_id
             WHERE b.company_id = $1
             GROUP BY b.id
             ORDER BY asset_count DESC, b.name`,
            [companyId]
        );
        return result.rows.map((row) => ({
            id: String(row.id),
            branchName: row.branch_name,
            assetCount: row.asset_count,
        }));
    }

    static async usageChart(companyId) {
        const depts = await pool.query(
            `SELECT COALESCE(department_name, 'Unassigned') AS name, COALESCE(SUM(usage_cost),0)::float AS cost
             FROM asset_usages WHERE company_id = $1
             GROUP BY department_name ORDER BY cost DESC LIMIT 8`,
            [companyId]
        );
        const branches = await pool.query(
            `SELECT COALESCE(to_label, 'Unassigned') AS name, COALESCE(SUM(transfer_cost),0)::float AS cost
             FROM asset_transfers WHERE company_id = $1 AND transfer_type = 'branch'
             GROUP BY to_label ORDER BY cost DESC LIMIT 8`,
            [companyId]
        );
        return { departments: depts.rows, branches: branches.rows };
    }

    static async createUsage(companyId, data) {
        const result = await pool.query(
            `INSERT INTO asset_usages (company_id, asset_id, asset_name, employee_name, department_id, department_name, usage_cost, usage_date)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [
                companyId,
                data.asset_id || null,
                data.asset_name,
                data.employee_name || null,
                data.department_id || null,
                data.department_name || null,
                data.usage_cost || 0,
                data.usage_date || null,
            ]
        );
        if (data.asset_id && data.department_id) {
            await pool.query(
                `UPDATE company_assets SET current_department_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND company_id = $3`,
                [data.asset_id, data.department_id, companyId]
            );
        }
        return result.rows[0];
    }

    static async listUsages(companyId, { pageSize, offset } = {}) {
        const count = await pool.query('SELECT COUNT(*)::int AS total FROM asset_usages WHERE company_id = $1', [companyId]);
        const result = await pool.query(
            `SELECT * FROM asset_usages WHERE company_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
            [companyId, pageSize || 50, offset || 0]
        );
        return { rows: result.rows, total: count.rows[0].total };
    }

    static async createTransfer(companyId, data) {
        const result = await pool.query(
            `INSERT INTO asset_transfers (
                company_id, asset_id, transfer_type, asset_name, employee_name,
                from_branch_id, to_branch_id, from_department_id, to_department_id,
                from_label, to_label, transfer_cost, transfer_date, status
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'completed')
             RETURNING *`,
            [
                companyId,
                data.asset_id || null,
                data.transfer_type,
                data.asset_name,
                data.employee_name || null,
                data.from_branch_id || null,
                data.to_branch_id || null,
                data.from_department_id || null,
                data.to_department_id || null,
                data.from_label || null,
                data.to_label || null,
                data.transfer_cost || 0,
                data.transfer_date || null,
            ]
        );
        if (data.asset_id) {
            await pool.query(
                `UPDATE company_assets SET
                    current_branch_id = COALESCE($2, current_branch_id),
                    current_department_id = COALESCE($3, current_department_id),
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND company_id = $4`,
                [data.asset_id, data.to_branch_id || null, data.to_department_id || null, companyId]
            );
        }
        return result.rows[0];
    }

    static async listTransfers(companyId, type, { pageSize, offset } = {}) {
        const params = [companyId];
        let extra = '';
        if (type) {
            params.push(type);
            extra = ` AND transfer_type = $2`;
        }
        const count = await pool.query(
            `SELECT COUNT(*)::int AS total FROM asset_transfers WHERE company_id = $1${extra}`,
            params
        );
        params.push(pageSize || 50, offset || 0);
        const result = await pool.query(
            `SELECT * FROM asset_transfers WHERE company_id = $1${extra} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        return { rows: result.rows, total: count.rows[0].total };
    }

    static async createSale(companyId, data) {
        const result = await pool.query(
            `INSERT INTO asset_sales (company_id, asset_id, asset_name, customer_name, invoice_no, invoice_date, sold_cost, condition)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [
                companyId,
                data.asset_id || null,
                data.asset_name,
                data.customer_name || null,
                data.invoice_no || null,
                data.invoice_date || null,
                data.sold_cost || 0,
                data.condition || null,
            ]
        );
        if (data.asset_id) {
            await pool.query(
                `UPDATE company_assets SET status = 'sold', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND company_id = $2`,
                [data.asset_id, companyId]
            );
        }
        return result.rows[0];
    }

    static async listSales(companyId, { pageSize, offset } = {}) {
        const count = await pool.query('SELECT COUNT(*)::int AS total FROM asset_sales WHERE company_id = $1', [companyId]);
        const result = await pool.query(
            `SELECT * FROM asset_sales WHERE company_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
            [companyId, pageSize || 50, offset || 0]
        );
        return { rows: result.rows, total: count.rows[0].total };
    }

    static async createScrape(companyId, data) {
        const result = await pool.query(
            `INSERT INTO asset_scrapes (company_id, asset_id, asset_name, vendor_name, condition)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [companyId, data.asset_id || null, data.asset_name, data.vendor_name || null, data.condition || null]
        );
        if (data.asset_id) {
            await pool.query(
                `UPDATE company_assets SET status = 'scraped', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND company_id = $2`,
                [data.asset_id, companyId]
            );
        }
        return result.rows[0];
    }

    static async listScrapes(companyId, { pageSize, offset } = {}) {
        const count = await pool.query('SELECT COUNT(*)::int AS total FROM asset_scrapes WHERE company_id = $1', [companyId]);
        const result = await pool.query(
            `SELECT * FROM asset_scrapes WHERE company_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
            [companyId, pageSize || 50, offset || 0]
        );
        return { rows: result.rows, total: count.rows[0].total };
    }
}

module.exports = AssetOpsModel;
