const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const assetRoutes = require('./routes/assetRoutes');
const companyRoutes = require('./routes/companyRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const orgRoutes = require('./routes/orgRoutes');
const assetsRoutes = require('./routes/assetsRoutes');
const assetOpsRoutes = require('./routes/assetOpsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const errorHandler = require('./middleware/errorHandler');
const { authenticateToken, authorizeRoles } = require('./middleware/authMiddleware');
const pool = require('./config/database');
const migrate = require('./db/migrate');

const app = express();

const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const corsOptions = {
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map(origin => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Authorization'],
    maxAge: 86400
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Test route at root level
app.get('/test', (req, res) => {
  res.json({ success: true, message: 'Server is working' });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Asset Management Backend is running!',
        timestamp: new Date().toISOString()
    });
});

app.get('/test-db', async (req, res, next) => {
    try {
        const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
        res.json({
            success: true,
            message: 'Connected to Neon PostgreSQL!',
            data: {
                time: result.rows[0].current_time,
                version: result.rows[0].pg_version
            }
        });
    } catch (error) {
        error.status = 500;
        error.message = 'Database connection failed';
        next(error);
    }
});

app.get('/setup', async (req, res, next) => {
    try {
        // Users table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        phone VARCHAR(50),
        avatar_url TEXT,
        company_id INTEGER REFERENCES companies(id),
        google_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Companies table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        company_name VARCHAR(255) NOT NULL,
        company_gst VARCHAR(50),
        mobile_number VARCHAR(20),
        company_email VARCHAR(255) UNIQUE NOT NULL,
        unique_code VARCHAR(50) UNIQUE NOT NULL,
        subscription_name VARCHAR(100),
        subscription_from_date DATE,
        subscription_to_date DATE,
        total_user_in_company INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active',
        blocked_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Employees table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        employee_name VARCHAR(255) NOT NULL,
        mobile_no VARCHAR(20),
        designation VARCHAR(100),
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        recycle_reason TEXT,
        recycled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Branches table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        pincode VARCHAR(20),
        category VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Departments table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        department_name VARCHAR(255) NOT NULL,
        dept_manager_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Asset Categories table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS asset_categories (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        category_name VARCHAR(255) NOT NULL,
        category_code VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Assets table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category_id INTEGER REFERENCES asset_categories(id) ON DELETE SET NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
        serial_number VARCHAR(100),
        purchase_date DATE,
        purchase_price DECIMAL(10,2),
        current_value DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'active',
        condition VARCHAR(50),
        location VARCHAR(255),
        image_url TEXT,
        vendor_name VARCHAR(255),
        quantity INTEGER DEFAULT 1,
        shelf_life VARCHAR(50),
        invoice_no VARCHAR(255),
        invoice_date DATE,
        asset_company_name VARCHAR(255),
        recycle_reason TEXT,
        recycled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Asset Usage table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS asset_usage (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
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

        // Asset Transfers table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS asset_transfers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
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

        // Asset Decommission table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS asset_decommission (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
        decommission_type VARCHAR(50),
        decommission_date DATE,
        reason TEXT,
        sale_price DECIMAL(10,2),
        scrap_value DECIMAL(10,2),
        customer_name VARCHAR(255),
        invoice_number VARCHAR(255),
        invoice_date DATE,
        vendor_name VARCHAR(255),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Add missing columns if they don't exist
        await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN
          ALTER TABLE users ADD COLUMN phone VARCHAR(50);
        END IF;
      END $$;
    `);

        await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='avatar_url') THEN
          ALTER TABLE users ADD COLUMN avatar_url TEXT;
        END IF;
      END $$;
    `);

        await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='updated_at') THEN
          ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        END IF;
      END $$;
    `);

        await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='company_id') THEN
          ALTER TABLE users ADD COLUMN company_id INTEGER REFERENCES companies(id);
        END IF;
      END $$;
    `);

        await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='google_id') THEN
          ALTER TABLE users ADD COLUMN google_id VARCHAR(255);
        END IF;
      END $$;
    `);

        await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='status') THEN
          ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'active';
        END IF;
      END $$;
    `);

        res.json({
            success: true,
            message: 'All tables created/updated successfully!'
        });
    } catch (error) {
        next(error);
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard/auth', authRoutes);

// Debug route - before other routes
app.get('/api/dashboard/test', (req, res) => {
  res.json({ success: true, message: 'Route is working' });
});

// Shared dashboard (admin + company)
app.use('/api/dashboard', dashboardRoutes);

// Admin routes
app.use('/api/dashboard/companies', companyRoutes);
app.use('/api/dashboard/employees', employeeRoutes);

// Company dashboard routes
app.use('/api/dashboard/org', orgRoutes);
app.use('/api/dashboard/assets', assetsRoutes);
app.use('/api/dashboard/asset-ops', assetOpsRoutes);

// Legacy assets route (keep for compatibility)
app.use('/api/assets', authenticateToken, assetRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

migrate()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Asset Management Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🗄️  Database: Neon PostgreSQL`);
            console.log(`📦 Assets API: http://localhost:${PORT}/api/assets`);
            console.log(`🔐 Admin Login API: http://localhost:${PORT}/api/auth/login/admin`);
            console.log(`🔐 Company Login API: http://localhost:${PORT}/api/auth/login/company`);
            console.log(`🔒 Protected with JWT authentication`);
        });
    })
    .catch((error) => {
        console.error('❌ Failed to run startup migrations:', error.message);
        process.exit(1);
    });

module.exports = app;