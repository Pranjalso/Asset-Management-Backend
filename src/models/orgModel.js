const pool = require('../config/database');
const { formatDate, toStr } = require('../utils/helpers');

class OrgModel {
    static mapBranch(row) {
        if (!row) return null;
        return {
            id: String(row.id),
            name: row.name,
            address: row.address || '',
            category: row.category || '',
            pincode: row.pincode || '',
            status: row.status,
        };
    }

    static mapDepartment(row) {
        if (!row) return null;
        return {
            id: String(row.id),
            departmentName: row.department_name,
            deptManagerName: row.dept_manager_name || '',
        };
    }

    static mapCategory(row) {
        if (!row) return null;
        return {
            id: String(row.id),
            categoryName: row.category_name,
            categoryCode: row.category_code || '',
        };
    }

    static async listBranches(companyId, { pageSize, offset, status } = {}) {
        const params = [companyId];
        let extra = ' AND (status IS NULL OR status != \'recycled\')';
        if (status) {
            params.push(status);
            extra += ` AND status = $${params.length}`;
        }
        const count = await pool.query(
            `SELECT COUNT(*)::int AS total FROM branches WHERE company_id = $1${extra}`,
            params
        );
        const limit = pageSize || 100;
        const off = offset || 0;
        params.push(limit, off);
        const result = await pool.query(
            `SELECT * FROM branches WHERE company_id = $1${extra} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        return { rows: result.rows, total: count.rows[0].total };
    }

    static async createBranch(companyId, data) {
        const result = await pool.query(
            `INSERT INTO branches (company_id, name, address, pincode, category, status)
             VALUES ($1,$2,$3,$4,$5,'active') RETURNING *`,
            [companyId, data.name, data.address || null, data.pincode || null, data.category || null]
        );
        return result.rows[0];
    }

    static async updateBranch(companyId, id, data) {
        const result = await pool.query(
            `UPDATE branches SET
                name = COALESCE($3, name),
                address = COALESCE($4, address),
                pincode = COALESCE($5, pincode),
                category = COALESCE($6, category),
                status = COALESCE($7, status),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND company_id = $2
             RETURNING *`,
            [id, companyId, data.name ?? null, data.address ?? null, data.pincode ?? null, data.category ?? null, data.status ?? null]
        );
        return result.rows[0];
    }

    static async deleteBranch(companyId, id) {
        const result = await pool.query(
            `UPDATE branches SET status = 'recycled', recycled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND company_id = $2 RETURNING *`,
            [id, companyId]
        );
        return result.rows[0];
    }

    static async listRecycledBranches(companyId, { pageSize, offset } = {}) {
        const count = await pool.query(
            `SELECT COUNT(*)::int AS total FROM branches WHERE company_id = $1 AND status = 'recycled'`,
            [companyId]
        );
        const limit = pageSize || 100;
        const off = offset || 0;
        const result = await pool.query(
            `SELECT * FROM branches WHERE company_id = $1 AND status = 'recycled' ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,
            [companyId, limit, off]
        );
        return { rows: result.rows, total: count.rows[0].total };
    }

    static async restoreBranch(companyId, id) {
        const result = await pool.query(
            `UPDATE branches SET status = 'active', recycled_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND company_id = $2 RETURNING *`,
            [id, companyId]
        );
        return result.rows[0];
    }

    static async hardDeleteBranch(companyId, id) {
        const result = await pool.query(
            'DELETE FROM branches WHERE id = $1 AND company_id = $2 RETURNING *',
            [id, companyId]
        );
        return result.rows[0];
    }

    static async listDepartments(companyId, { pageSize, offset } = {}) {
        const count = await pool.query(
            `SELECT COUNT(*)::int AS total FROM departments WHERE company_id = $1 AND (status IS NULL OR status != 'recycled')`,
            [companyId]
        );
        const result = await pool.query(
            `SELECT * FROM departments WHERE company_id = $1 AND (status IS NULL OR status != 'recycled') ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
            [companyId, pageSize || 100, offset || 0]
        );
        return { rows: result.rows, total: count.rows[0].total };
    }

    static async createDepartment(companyId, data) {
        const result = await pool.query(
            `INSERT INTO departments (company_id, department_name, dept_manager_name)
             VALUES ($1,$2,$3) RETURNING *`,
            [companyId, data.department_name, data.dept_manager_name || null]
        );
        return result.rows[0];
    }

    static async updateDepartment(companyId, id, data) {
        const result = await pool.query(
            `UPDATE departments SET
                department_name = COALESCE($3, department_name),
                dept_manager_name = COALESCE($4, dept_manager_name),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND company_id = $2
             RETURNING *`,
            [id, companyId, data.department_name ?? null, data.dept_manager_name ?? null]
        );
        return result.rows[0];
    }

    static async deleteDepartment(companyId, id) {
        const result = await pool.query(
            `UPDATE departments SET status = 'recycled', recycled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND company_id = $2 RETURNING *`,
            [id, companyId]
        );
        return result.rows[0];
    }

    static async listRecycledDepartments(companyId, { pageSize, offset } = {}) {
        const count = await pool.query(
            `SELECT COUNT(*)::int AS total FROM departments WHERE company_id = $1 AND status = 'recycled'`,
            [companyId]
        );
        const limit = pageSize || 100;
        const off = offset || 0;
        const result = await pool.query(
            `SELECT * FROM departments WHERE company_id = $1 AND status = 'recycled' ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,
            [companyId, limit, off]
        );
        return { rows: result.rows, total: count.rows[0].total };
    }

    static async restoreDepartment(companyId, id) {
        const result = await pool.query(
            `UPDATE departments SET status = 'active', recycled_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND company_id = $2 RETURNING *`,
            [id, companyId]
        );
        return result.rows[0];
    }

    static async hardDeleteDepartment(companyId, id) {
        const result = await pool.query(
            'DELETE FROM departments WHERE id = $1 AND company_id = $2 RETURNING *',
            [id, companyId]
        );
        return result.rows[0];
    }

    static async listCategories(companyId, { pageSize, offset } = {}) {
        const count = await pool.query(
            `SELECT COUNT(*)::int AS total FROM asset_categories WHERE company_id = $1 AND (status IS NULL OR status != 'recycled')`,
            [companyId]
        );
        const result = await pool.query(
            `SELECT * FROM asset_categories WHERE company_id = $1 AND (status IS NULL OR status != 'recycled') ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
            [companyId, pageSize || 100, offset || 0]
        );
        return { rows: result.rows, total: count.rows[0].total };
    }

    static async createCategory(companyId, data) {
        const result = await pool.query(
            `INSERT INTO asset_categories (company_id, category_name, category_code)
             VALUES ($1,$2,$3) RETURNING *`,
            [companyId, data.category_name, data.category_code || null]
        );
        return result.rows[0];
    }

    static async updateCategory(companyId, id, data) {
        const result = await pool.query(
            `UPDATE asset_categories SET
                category_name = COALESCE($3, category_name),
                category_code = COALESCE($4, category_code),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND company_id = $2
             RETURNING *`,
            [id, companyId, data.category_name ?? null, data.category_code ?? null]
        );
        return result.rows[0];
    }

    static async deleteCategory(companyId, id) {
        // Soft delete — moves to recycle bin
        const result = await pool.query(
            `UPDATE asset_categories SET status = 'recycled', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND company_id = $2 RETURNING *`,
            [id, companyId]
        );
        return result.rows[0];
    }

    static async listRecycledCategories(companyId, { pageSize, offset } = {}) {
        const count = await pool.query(
            `SELECT COUNT(*)::int AS total FROM asset_categories WHERE company_id = $1 AND status = 'recycled'`,
            [companyId]
        );
        const result = await pool.query(
            `SELECT * FROM asset_categories WHERE company_id = $1 AND status = 'recycled' ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,
            [companyId, pageSize || 100, offset || 0]
        );
        return { rows: result.rows, total: count.rows[0].total };
    }

    static async restoreCategory(companyId, id) {
        const result = await pool.query(
            `UPDATE asset_categories SET status = 'active', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND company_id = $2 RETURNING *`,
            [id, companyId]
        );
        return result.rows[0];
    }

    static async hardDeleteCategory(companyId, id) {
        const result = await pool.query(
            'DELETE FROM asset_categories WHERE id = $1 AND company_id = $2 RETURNING *',
            [id, companyId]
        );
        return result.rows[0];
    }
}

module.exports = OrgModel;
