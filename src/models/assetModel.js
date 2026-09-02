const pool = require('../config/database');

class AssetModel {
    static async findAll() {
        const result = await pool.query('SELECT * FROM assets ORDER BY id');
        return result.rows;
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM assets WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async create(assetData) {
        const { name, description, category, quantity, price, status } = assetData;
        const result = await pool.query(
            `INSERT INTO assets (name, description, category, quantity, price, status) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [name, description, category, quantity || 1, price, status || 'active']
        );
        return result.rows[0];
    }

    static async update(id, assetData) {
        const { name, description, category, quantity, price, status } = assetData;
        const result = await pool.query(
            `UPDATE assets 
             SET name = $1, description = $2, category = $3,
                 quantity = $4, price = $5, status = $6, updated_at = CURRENT_TIMESTAMP
             WHERE id = $7 RETURNING *`,
            [name, description, category, quantity, price, status, id]
        );
        return result.rows[0];
    }

    static async delete(id) {
        const result = await pool.query('DELETE FROM assets WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }

    static async createMany(assets) {
        // assets should be an array of arrays: [[name, desc, ...], [...]]
        for (const asset of assets) {
            await pool.query(
                `INSERT INTO assets (name, description, category, quantity, price, status) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                asset
            );
        }
    }
}

module.exports = AssetModel;
