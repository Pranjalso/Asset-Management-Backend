const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class UserModel {
    static async findByEmailOrUsername(email, username) {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );
        return result.rows;
    }

    static async findByEmail(email) {
        const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        return result.rows[0];
    }

    static async findByEmailAndRole(email, role) {
        const result = await pool.query(
            'SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND role = $2',
            [email, role]
        );
        return result.rows[0];
    }

    static async findById(id) {
        const result = await pool.query(
            `SELECT id, username, email, role, phone, avatar_url, company_id, status, google_id, created_at
             FROM users WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    }

    static async findByIdWithPassword(id) {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async create(userData) {
        const { username, email, password, role, avatar_url, phone, company_id, google_id, status } = userData;
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, role, avatar_url, phone, company_id, google_id, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, username, email, role, phone, avatar_url, company_id, status, google_id, created_at`,
            [
                username,
                email.toLowerCase(),
                password_hash,
                role || 'user',
                avatar_url || null,
                phone || null,
                company_id || null,
                google_id || null,
                status || 'active',
            ]
        );
        return result.rows[0];
    }

    static async update(id, fields) {
        const allowed = ['username', 'email', 'phone', 'avatar_url', 'company_id', 'status', 'google_id', 'role'];
        const entries = Object.entries(fields).filter(([k]) => allowed.includes(k));
        if (entries.length === 0) return this.findById(id);

        const sets = entries.map(([key], idx) => `${key} = $${idx + 2}`).join(', ');
        const values = [id, ...entries.map(([, v]) => v)];

        try {
            const result = await pool.query(
                `UPDATE users SET ${sets}, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                 RETURNING id, username, email, role, phone, avatar_url, company_id, status, google_id, created_at`,
                values
            );
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') {
                if (error.constraint === 'users_username_key') {
                    throw new Error('Username is already taken by another account.');
                }
                if (error.constraint === 'users_email_key') {
                    throw new Error('Email is already in use by another account.');
                }
                throw new Error('A record with this information already exists.');
            }
            throw error;
        }
    }

    static async updatePassword(id, newPassword) {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);
        const result = await pool.query(
            `UPDATE users SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`,
            [id, password_hash]
        );
        return result.rows[0];
    }

    static async verifyPassword(id, currentPassword) {
        const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [id]);
        if (!result.rows[0]) return false;
        return bcrypt.compare(currentPassword, result.rows[0].password_hash);
    }
}

module.exports = UserModel;
