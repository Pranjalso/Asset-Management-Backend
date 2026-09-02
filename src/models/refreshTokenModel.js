const crypto = require('crypto');
const pool = require('../config/database');

class RefreshTokenModel {
    static async createTable() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash VARCHAR(255) NOT NULL UNIQUE,
                role VARCHAR(50) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                revoked_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)
        `);
    }

    static hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    static async store({ userId, token, role, expiresAt }) {
        const tokenHash = this.hashToken(token);
        await pool.query(
            `INSERT INTO refresh_tokens (user_id, token_hash, role, expires_at)
             VALUES ($1, $2, $3, $4)`,
            [userId, tokenHash, role, expiresAt]
        );
    }

    static async findValid(token) {
        const tokenHash = this.hashToken(token);
        const result = await pool.query(
            `SELECT * FROM refresh_tokens
             WHERE token_hash = $1
               AND revoked_at IS NULL
               AND expires_at > NOW()
             LIMIT 1`,
            [tokenHash]
        );
        return result.rows[0] || null;
    }

    static async revoke(token) {
        if (!token) return;
        const tokenHash = this.hashToken(token);
        await pool.query(
            `UPDATE refresh_tokens
             SET revoked_at = CURRENT_TIMESTAMP
             WHERE token_hash = $1 AND revoked_at IS NULL`,
            [tokenHash]
        );
    }

    static async revokeAllForUser(userId) {
        await pool.query(
            `UPDATE refresh_tokens
             SET revoked_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND revoked_at IS NULL`,
            [userId]
        );
    }

    static async deleteExpired() {
        await pool.query(`DELETE FROM refresh_tokens WHERE expires_at <= NOW() OR revoked_at IS NOT NULL`);
    }
}

module.exports = RefreshTokenModel;
