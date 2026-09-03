const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const RefreshTokenModel = require('../models/refreshTokenModel');

async function addColumnIfMissing(table, column, definition) {
    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = '${table}' AND column_name = '${column}'
            ) THEN
                ALTER TABLE ${table} ADD COLUMN ${column} ${definition};
            END IF;
        END $$;
    `);
}

async function migrate() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'user',
            phone VARCHAR(50),
            avatar_url TEXT,
            company_id INTEGER,
            status VARCHAR(30) DEFAULT 'active',
            google_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await addColumnIfMissing('users', 'phone', 'VARCHAR(50)');
    await addColumnIfMissing('users', 'avatar_url', 'TEXT');
    await addColumnIfMissing('users', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing('users', 'company_id', 'INTEGER');
    await addColumnIfMissing('users', 'status', "VARCHAR(30) DEFAULT 'active'");
    await addColumnIfMissing('users', 'google_id', 'VARCHAR(255)');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS companies (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            company_name VARCHAR(255) NOT NULL,
            company_gst VARCHAR(100),
            mobile_number VARCHAR(50),
            company_email VARCHAR(255) NOT NULL,
            unique_code VARCHAR(100) UNIQUE NOT NULL,
            subscription_name VARCHAR(150),
            subscription_from_date DATE,
            subscription_to_date DATE,
            total_user_in_company INTEGER DEFAULT 0,
            status VARCHAR(30) DEFAULT 'active',
            blocked_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS employees (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            employee_name VARCHAR(255) NOT NULL,
            mobile_no VARCHAR(50),
            designation VARCHAR(150),
            email VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255),
            status VARCHAR(30) DEFAULT 'active',
            recycle_reason TEXT,
            recycled_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS branches (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            address TEXT,
            pincode VARCHAR(20),
            category VARCHAR(100),
            status VARCHAR(30) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS departments (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            department_name VARCHAR(255) NOT NULL,
            dept_manager_name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS asset_categories (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            category_name VARCHAR(255) NOT NULL,
            category_code VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS company_assets (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            category_id INTEGER REFERENCES asset_categories(id) ON DELETE SET NULL,
            asset_name VARCHAR(255) NOT NULL,
            asset_company_name VARCHAR(255),
            vendor_name VARCHAR(255),
            quantity INTEGER DEFAULT 1,
            shelf_life VARCHAR(100),
            invoice_no VARCHAR(100),
            invoice_date DATE,
            acquisition_cost DECIMAL(14,2),
            acquisition_date DATE,
            description TEXT,
            image_url TEXT,
            status VARCHAR(50) DEFAULT 'active',
            recycle_reason TEXT,
            recycled_at TIMESTAMP,
            current_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
            current_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await addColumnIfMissing('company_assets', 'vendor_name', 'VARCHAR(255)');
    await addColumnIfMissing('company_assets', 'quantity', 'INTEGER DEFAULT 1');
    await addColumnIfMissing('company_assets', 'shelf_life', 'VARCHAR(100)');
    await addColumnIfMissing('company_assets', 'invoice_no', 'VARCHAR(100)');
    await addColumnIfMissing('company_assets', 'invoice_date', 'DATE');
    await addColumnIfMissing('company_assets', 'asset_company_name', 'VARCHAR(255)');
    await addColumnIfMissing('company_assets', 'recycle_reason', 'TEXT');
    await addColumnIfMissing('company_assets', 'recycled_at', 'TIMESTAMP');
    await addColumnIfMissing('company_assets', 'current_branch_id', 'INTEGER');
    await addColumnIfMissing('company_assets', 'current_department_id', 'INTEGER');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS asset_usage (
            id SERIAL PRIMARY KEY,
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
            asset_id INTEGER REFERENCES company_assets(id) ON DELETE CASCADE,
            employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
            department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
            employee_name VARCHAR(255),
            department_name VARCHAR(255),
            usage_cost NUMERIC(14,2) DEFAULT 0,
            usage_date DATE,
            usage_type VARCHAR(50),
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await addColumnIfMissing('asset_usage', 'employee_name', 'VARCHAR(255)');
    await addColumnIfMissing('asset_usage', 'department_id', 'INTEGER');
    await addColumnIfMissing('asset_usage', 'department_name', 'VARCHAR(255)');
    await addColumnIfMissing('asset_usage', 'usage_cost', 'NUMERIC(14,2) DEFAULT 0');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS asset_transfers (
            id SERIAL PRIMARY KEY,
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
            asset_id INTEGER REFERENCES company_assets(id) ON DELETE CASCADE,
            from_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
            to_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
            from_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
            to_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
            employee_name VARCHAR(255),
            transfer_cost NUMERIC(14,2) DEFAULT 0,
            transfer_date DATE,
            transfer_type VARCHAR(50),
            notes TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await addColumnIfMissing('asset_transfers', 'employee_name', 'VARCHAR(255)');
    await addColumnIfMissing('asset_transfers', 'transfer_cost', 'NUMERIC(14,2) DEFAULT 0');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS asset_decommission (
            id SERIAL PRIMARY KEY,
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
            asset_id INTEGER REFERENCES company_assets(id) ON DELETE CASCADE,
            decommission_type VARCHAR(50),
            decommission_date DATE,
            reason TEXT,
            sale_price DECIMAL(14,2),
            scrap_value DECIMAL(14,2),
            customer_name VARCHAR(255),
            vendor_name VARCHAR(255),
            invoice_no VARCHAR(100),
            invoice_number VARCHAR(100),
            invoice_date DATE,
            notes TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await addColumnIfMissing('asset_decommission', 'customer_name', 'VARCHAR(255)');
    await addColumnIfMissing('asset_decommission', 'vendor_name', 'VARCHAR(255)');
    await addColumnIfMissing('asset_decommission', 'invoice_no', 'VARCHAR(100)');
    await addColumnIfMissing('asset_decommission', 'invoice_number', 'VARCHAR(100)');
    await addColumnIfMissing('asset_decommission', 'invoice_date', 'DATE');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
            audience VARCHAR(30) DEFAULT 'user',
            title VARCHAR(255) NOT NULL,
            description TEXT,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'notifications' AND column_name = 'read_status'
            ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'notifications' AND column_name = 'is_read'
            ) THEN
                ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
                UPDATE notifications SET is_read = COALESCE(read_status, FALSE);
            END IF;
        END $$;
    `);

    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'asset_categories' AND column_name = 'status'
            ) THEN
                ALTER TABLE asset_categories ADD COLUMN status VARCHAR(30) DEFAULT 'active';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'branches' AND column_name = 'recycled_at'
            ) THEN
                ALTER TABLE branches ADD COLUMN recycled_at TIMESTAMP;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'departments' AND column_name = 'status'
            ) THEN
                ALTER TABLE departments ADD COLUMN status VARCHAR(30) DEFAULT 'active';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'departments' AND column_name = 'recycled_at'
            ) THEN
                ALTER TABLE departments ADD COLUMN recycled_at TIMESTAMP;
            END IF;
        END $$;
    `);

    await RefreshTokenModel.createTable();

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@assetmanagement.com').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const existingAdmin = await pool.query(
        `SELECT id FROM users WHERE LOWER(email) = $1 OR role = 'admin' LIMIT 1`,
        [adminEmail]
    );
    if (existingAdmin.rows.length === 0) {
        const hash = await bcrypt.hash(adminPassword, 10);
        await pool.query(
            `INSERT INTO users (username, email, password_hash, role, status)
             VALUES ($1, $2, $3, 'admin', 'active')`,
            ['admin', adminEmail, hash]
        );
        console.log(`Seeded admin account: ${adminEmail}`);
    }
}

module.exports = migrate;
