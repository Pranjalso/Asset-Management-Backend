const pool = require('../config/database');
const { formatDate, toStr } = require('../utils/helpers');

function mapCompany(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        userId: row.user_id ? String(row.user_id) : null,
        companyName: row.company_name,
        companyGST: row.company_gst || '',
        mobileNumber: row.mobile_number || '',
        companyEmail: row.company_email,
        uniqueCode: row.unique_code,
        subscriptionName: row.subscription_name || '',
        subscriptionFromDate: formatDate(row.subscription_from_date),
        subscriptionToDate: formatDate(row.subscription_to_date),
        totalUserInCompany: row.total_user_in_company ?? 0,
        status: row.status,
        blockedReason: row.blocked_reason || '',
        createdAt: row.created_at,
    };
}

class CompanyModel {
    static map(row) {
        return mapCompany(row);
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM companies WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async findByUserId(userId) {
        const result = await pool.query('SELECT * FROM companies WHERE user_id = $1', [userId]);
        return result.rows[0];
    }

    static async findByEmail(email) {
        const result = await pool.query(
            'SELECT * FROM companies WHERE LOWER(company_email) = LOWER($1)',
            [email]
        );
        return result.rows[0];
    }

    static async findByUniqueCode(code) {
        const result = await pool.query('SELECT * FROM companies WHERE unique_code = $1', [code]);
        return result.rows[0];
    }

    static async list({ status, page, pageSize, offset, search }) {
        const where = [];
        const params = [];
        if (status) {
            params.push(status);
            where.push(`status = $${params.length}`);
        }
        if (search) {
            params.push(`%${search}%`);
            where.push(`(company_name ILIKE $${params.length} OR company_email ILIKE $${params.length} OR unique_code ILIKE $${params.length})`);
        }
        const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const count = await pool.query(`SELECT COUNT(*)::int AS total FROM companies ${clause}`, params);
        params.push(pageSize, offset);
        const result = await pool.query(
            `SELECT * FROM companies ${clause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        return { rows: result.rows, total: count.rows[0].total };
    }

    static async create(data) {
        const result = await pool.query(
            `INSERT INTO companies (
                user_id, company_name, company_gst, mobile_number, company_email, unique_code,
                subscription_name, subscription_from_date, subscription_to_date, total_user_in_company, status
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING *`,
            [
                data.user_id,
                data.company_name,
                data.company_gst || null,
                data.mobile_number || null,
                data.company_email,
                data.unique_code,
                data.subscription_name || null,
                data.subscription_from_date || null,
                data.subscription_to_date || null,
                data.total_user_in_company || 0,
                data.status || 'active',
            ]
        );
        return result.rows[0];
    }

    static async update(id, data) {
        const result = await pool.query(
            `UPDATE companies SET
                company_name = COALESCE($2, company_name),
                company_gst = COALESCE($3, company_gst),
                mobile_number = COALESCE($4, mobile_number),
                company_email = COALESCE($5, company_email),
                unique_code = COALESCE($6, unique_code),
                subscription_name = COALESCE($7, subscription_name),
                subscription_from_date = COALESCE($8, subscription_from_date),
                subscription_to_date = COALESCE($9, subscription_to_date),
                total_user_in_company = COALESCE($10, total_user_in_company),
                status = COALESCE($11, status),
                blocked_reason = CASE WHEN $12 = '__UNSET__' THEN blocked_reason ELSE $12 END,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [
                id,
                data.company_name ?? null,
                data.company_gst ?? null,
                data.mobile_number ?? null,
                data.company_email ?? null,
                data.unique_code ?? null,
                data.subscription_name ?? null,
                data.subscription_from_date ?? null,
                data.subscription_to_date ?? null,
                data.total_user_in_company ?? null,
                data.status ?? null,
                data.blocked_reason === undefined ? '__UNSET__' : data.blocked_reason,
            ]
        );
        return result.rows[0];
    }

    static async remove(id) {
        const result = await pool.query('DELETE FROM companies WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }
}

module.exports = CompanyModel;
