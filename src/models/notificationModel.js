const pool = require('../config/database');

let readColumnCache = null;

async function detectReadColumn() {
    if (readColumnCache) return readColumnCache;

    const result = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'notifications'
           AND column_name IN ('is_read', 'read_status')`
    );

    const columns = result.rows.map((row) => row.column_name);
    readColumnCache = columns.includes('is_read') ? 'is_read' : 'read_status';
    return readColumnCache;
}

class NotificationModel {
    static map(row) {
        const created = row.created_at ? new Date(row.created_at) : new Date();
        const now = new Date();
        const sameDay = created.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const dateLabel = sameDay
            ? 'Today'
            : created.toDateString() === yesterday.toDateString()
              ? 'Yesterday'
              : created.toLocaleDateString();
        const time = created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return {
            id: String(row.id),
            title: row.title,
            description: row.description || '',
            time,
            date: dateLabel,
            read: Boolean(row.is_read ?? row.read_status),
            createdAt: row.created_at,
        };
    }

    static async create({ userId, companyId, audience, title, description }) {
        const readColumn = await detectReadColumn();
        const result = await pool.query(
            `INSERT INTO notifications (user_id, company_id, audience, title, description, ${readColumn})
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [userId || null, companyId || null, audience || 'user', title, description || null, false]
        );
        return result.rows[0];
    }

    static async listForUser(userId, companyId, role) {
        const result = await pool.query(
            `SELECT * FROM notifications
             WHERE (user_id = $1)
                OR (audience = 'admin' AND $2 = 'admin')
                OR (company_id = $3 AND audience = 'company')
             ORDER BY created_at DESC
             LIMIT 100`,
            [userId, role, companyId || null]
        );
        return result.rows;
    }

    static async markRead(id, userId) {
        const readColumn = await detectReadColumn();
        await pool.query(
            `UPDATE notifications SET ${readColumn} = TRUE WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
            [id, userId]
        );
    }

    static async markAllReadForUser(userId, companyId, role) {
        const readColumn = await detectReadColumn();
        await pool.query(
            `UPDATE notifications
             SET ${readColumn} = TRUE
             WHERE COALESCE(${readColumn}, FALSE) = FALSE
               AND (
                    user_id = $1
                    OR (audience = 'admin' AND $2 = 'admin')
                    OR (company_id = $3 AND audience = 'company')
               )`,
            [userId, role, companyId || null]
        );
    }
}

module.exports = NotificationModel;
