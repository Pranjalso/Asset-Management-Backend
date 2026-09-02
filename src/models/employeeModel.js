const pool = require('../config/database');
const bcrypt = require('bcryptjs');

function mapEmployee(row, companyName) {
    if (!row) return null;
    return {
        id: String(row.id),
        companyId: String(row.company_id),
        companyName: companyName || row.company_name || '',
        employeeName: row.employee_name,
        mobileNo: row.mobile_no || '',
        designation: row.designation || '',
        email: row.email,
        password: '••••••••',
        status: row.status,
        recycleReason: row.recycle_reason || '',
    };
}

class EmployeeModel {
    static map(row, companyName) {
        return mapEmployee(row, companyName);
    }

    static async findById(id) {
        const result = await pool.query(
            `SELECT e.*, c.company_name
             FROM employees e
             JOIN companies c ON c.id = e.company_id
             WHERE e.id = $1`,
            [id]
        );
        return result.rows[0];
    }

    static async list({ status, pageSize, offset, companyId }) {
        const where = [];
        const params = [];
        if (status) {
            params.push(status);
            where.push(`e.status = $${params.length}`);
        }
        if (companyId) {
            params.push(companyId);
            where.push(`e.company_id = $${params.length}`);
        }
        const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const count = await pool.query(
            `SELECT COUNT(*)::int AS total FROM employees e ${clause}`,
            params
        );
        params.push(pageSize, offset);
        const result = await pool.query(
            `SELECT e.*, c.company_name
             FROM employees e
             JOIN companies c ON c.id = e.company_id
             ${clause}
             ORDER BY e.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        return { rows: result.rows, total: count.rows[0].total };
    }

    static async create(data) {
        const password_hash = data.password ? await bcrypt.hash(data.password, 10) : null;
        const result = await pool.query(
            `INSERT INTO employees (company_id, employee_name, mobile_no, designation, email, password_hash, status)
             VALUES ($1,$2,$3,$4,$5,$6,'active')
             RETURNING *`,
            [data.company_id, data.employee_name, data.mobile_no || null, data.designation || null, data.email.toLowerCase(), password_hash]
        );
        return result.rows[0];
    }

    static async update(id, data) {
        const existing = await this.findById(id);
        if (!existing) return null;
        let password_hash = existing.password_hash;
        if (data.password && data.password !== '••••••••') {
            password_hash = await bcrypt.hash(data.password, 10);
        }
        const result = await pool.query(
            `UPDATE employees SET
                employee_name = COALESCE($2, employee_name),
                mobile_no = COALESCE($3, mobile_no),
                designation = COALESCE($4, designation),
                email = COALESCE($5, email),
                password_hash = $6,
                company_id = COALESCE($7, company_id),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [
                id,
                data.employee_name ?? null,
                data.mobile_no ?? null,
                data.designation ?? null,
                data.email ? data.email.toLowerCase() : null,
                password_hash,
                data.company_id ?? null,
            ]
        );
        return result.rows[0];
    }

    static async recycle(id, reason) {
        const result = await pool.query(
            `UPDATE employees SET status = 'recycled', recycle_reason = $2, recycled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [id, reason || null]
        );
        return result.rows[0];
    }

    static async recover(id) {
        const result = await pool.query(
            `UPDATE employees SET status = 'active', recycle_reason = NULL, recycled_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0];
    }

    static async remove(id) {
        const result = await pool.query('DELETE FROM employees WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }
}

module.exports = EmployeeModel;
