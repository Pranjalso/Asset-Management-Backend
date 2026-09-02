const bcrypt = require('bcrypt');
const pool = require('./config/database');

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    console.log('🗑️  Dropping existing tables...');
    const tables = [
      'asset_decommission', 'asset_transfers', 'asset_usage', 'company_assets',
      'asset_categories', 'employees', 'branches', 'departments', 'companies', 'users',
      'notifications', 'blacklisted_tokens', 'refresh_tokens'
    ];

    for (const table of tables) {
      try {
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`✅ Dropped table: ${table}`);
      } catch (e) {
        console.log(`⚠️  Could not drop ${table}, skipping...`);
      }
    }

    console.log('🔧 Creating database tables...');

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
        google_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        audience VARCHAR(50) DEFAULT 'user',
        title VARCHAR(255) NOT NULL,
        description TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS company_assets (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS asset_decommission (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        asset_id INTEGER REFERENCES company_assets(id) ON DELETE CASCADE,
        decommission_type VARCHAR(50),
        decommission_date DATE,
        reason TEXT,
        sale_price DECIMAL(10,2),
        scrap_value DECIMAL(10,2),
        customer_name VARCHAR(255),
        invoice_no VARCHAR(255),
        invoice_number VARCHAR(255),
        invoice_date DATE,
        vendor_name VARCHAR(255),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database tables created/verified');

    console.log('👤 Creating admin user...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, phone, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      ['admin', 'admin@assetmanagement.com', adminPassword, 'admin', '+919999999999', 'active']
    );
    const adminId = adminResult.rows[0].id;
    console.log(`✅ Admin user created with ID: ${adminId}`);

    const companies = [
      {
        name: 'TechCorp Solutions', gst: '29AABCT1234F1Z5', mobile: '+919876543210', email: 'contact@techcorp.com', uniqueCode: 'TC-2024-001', subscription: 'Premium', subFrom: '2024-01-01', subTo: '2025-12-31', totalUsers: 50
      },
      {
        name: 'Innovatech Industries', gst: '27AAACI5678B1Z2', mobile: '+919876543220', email: 'contact@innovatech.com', uniqueCode: 'II-2024-002', subscription: 'Enterprise', subFrom: '2024-03-01', subTo: '2026-02-28', totalUsers: 120
      },
      {
        name: 'Global Systems Ltd', gst: '24AAACG9012D1Z3', mobile: '+919876543230', email: 'contact@globalsystems.com', uniqueCode: 'GS-2024-003', subscription: 'Standard', subFrom: '2024-02-15', subTo: '2025-02-14', totalUsers: 30
      },
      {
        name: 'Prime Enterprises', gst: '32AAACP3456E1Z4', mobile: '+919876543240', email: 'contact@primeenterprises.com', uniqueCode: 'PE-2024-004', subscription: 'Premium', subFrom: '2024-04-01', subTo: '2025-03-31', totalUsers: 75
      },
      {
        name: 'Metro Business Hub', gst: '07AAACM7890F1Z5', mobile: '+919876543250', email: 'contact@metrobusiness.com', uniqueCode: 'MB-2024-005', subscription: 'Enterprise', subFrom: '2024-01-15', subTo: '2026-01-14', totalUsers: 200
      }
    ];

    const companyUserPassword = await bcrypt.hash('company123', 10);
    const companyIds = [];

    for (let i = 0; i < companies.length; i++) {
      const c = companies[i];
      const userResult = await pool.query(
        `INSERT INTO users (username, email, password_hash, role, phone, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          `company_user_${i + 1}`,
          i === 0 ? 'company@techcorp.com' : `company${i + 1}@${c.name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
          companyUserPassword,
          'dashboard_user',
          c.mobile,
          i === 3 ? 'blocked' : 'active'
        ]
      );
      const userId = userResult.rows[0].id;

      const companyResult = await pool.query(
        `INSERT INTO companies (user_id, company_name, company_gst, mobile_number, company_email, unique_code, subscription_name, subscription_from_date, subscription_to_date, total_user_in_company, status, blocked_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
          userId, c.name, c.gst, c.mobile, c.email, c.uniqueCode, c.subscription, c.subFrom, c.subTo, c.totalUsers,
          i === 3 ? 'blocked' : 'active',
          i === 3 ? 'Payment pending for 3 consecutive months' : null
        ]
      );
      companyIds.push(companyResult.rows[0].id);

      await pool.query(`UPDATE users SET company_id = $1 WHERE id = $2`, [companyResult.rows[0].id, userId]);
      console.log(`✅ Company created: ${c.name}`);
    }

    const baseBranchesData = [
      { name: 'Headquarters', address: '123 Tech Park, Electronic City, Bangalore', pincode: '560001', category: 'Yes, Long term' },
      { name: 'Mumbai Branch', address: '456 Business Hub, BKC, Mumbai', pincode: '400001', category: 'Yes, Short term' },
      { name: 'Delhi Branch', address: '789 Corporate Center, Connaught Place, Delhi', pincode: '110001', category: 'Yes, Long term' },
      { name: 'Chennai Branch', address: '321 Tech Plaza, T Nagar, Chennai', pincode: '600001', category: 'No' },
      { name: 'Hyderabad Branch', address: '88 Hitech City, Madhapur, Hyderabad', pincode: '500081', category: 'Yes, Long term' },
      { name: 'Pune Branch', address: '17 IT Park Road, Hinjewadi, Pune', pincode: '411057', category: 'Yes, Short term' },
      { name: 'Ahmedabad Branch', address: '11 Riverfront Plaza, Ashram Road, Ahmedabad', pincode: '380009', category: 'No' },
      { name: 'Kolkata Branch', address: '24 Sector V, Salt Lake, Kolkata', pincode: '700091', category: 'Yes, Long term' },
      { name: 'Jaipur Branch', address: '9 Corporate Tower, Malviya Nagar, Jaipur', pincode: '302017', category: 'Yes, Short term' },
      { name: 'Kochi Branch', address: '41 Infopark Avenue, Kakkanad, Kochi', pincode: '682042', category: 'No' },
    ];
    const baseDeptsData = [
      { departmentName: 'Engineering', deptManagerName: 'John Smith' },
      { departmentName: 'Marketing', deptManagerName: 'Sarah Johnson' },
      { departmentName: 'Finance', deptManagerName: 'Mike Wilson' },
      { departmentName: 'Operations', deptManagerName: 'David Lee' },
      { departmentName: 'Human Resources', deptManagerName: 'Priya Nair' },
      { departmentName: 'Sales', deptManagerName: 'Arjun Mehta' },
      { departmentName: 'Customer Success', deptManagerName: 'Neha Kapoor' },
      { departmentName: 'Procurement', deptManagerName: 'Vikram Rao' },
      { departmentName: 'Compliance', deptManagerName: 'Asha Verma' },
      { departmentName: 'Research', deptManagerName: 'Rohan Iyer' },
    ];
    const baseCatsData = [
      { categoryName: 'Electronics', categoryCode: 'ELC-001' },
      { categoryName: 'Furniture', categoryCode: 'FRN-001' },
      { categoryName: 'Vehicles', categoryCode: 'VHC-001' },
      { categoryName: 'IT Equipment', categoryCode: 'ITE-001' },
      { categoryName: 'Office Supplies', categoryCode: 'OFS-001' },
      { categoryName: 'Machinery', categoryCode: 'MAC-001' },
      { categoryName: 'Networking', categoryCode: 'NET-001' },
      { categoryName: 'Security Systems', categoryCode: 'SEC-001' },
      { categoryName: 'Lab Equipment', categoryCode: 'LAB-001' },
      { categoryName: 'Mobile Devices', categoryCode: 'MOB-001' },
    ];

    const branchIdsByCompany = {};
    const deptIdsByCompany = {};
    const categoryIdsByCompany = {};
    const employeeIdsByCompany = {};
    const assetIdsByCompany = {};
    const branchCount = baseBranchesData.length;
    const deptCount = baseDeptsData.length;
    const categoryCount = baseCatsData.length;

    for (let i = 0; i < companyIds.length; i++) {
      const companyId = companyIds[i];
      const companyName = companies[i].name;

      console.log(`🏢 Creating branches for ${companyName}...`);
      const branchIds = [];
      for (const branch of baseBranchesData) {
        const r = await pool.query(
          `INSERT INTO branches (company_id, name, address, pincode, category, status)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [companyId, branch.name, branch.address, branch.pincode, branch.category, i === 3 ? 'blocked' : 'active']
        );
        branchIds.push(r.rows[0].id);
      }
      branchIdsByCompany[companyId] = branchIds;

      console.log(`🏢 Creating departments for ${companyName}...`);
      const deptIds = [];
      for (const d of baseDeptsData) {
        const r = await pool.query(
          `INSERT INTO departments (company_id, department_name, dept_manager_name)
           VALUES ($1, $2, $3) RETURNING id`,
          [companyId, d.departmentName, d.deptManagerName]
        );
        deptIds.push(r.rows[0].id);
      }
      deptIdsByCompany[companyId] = deptIds;

      console.log(`📦 Creating asset categories for ${companyName}...`);
      const categoryIds = [];
      for (const c of baseCatsData) {
        const r = await pool.query(
          `INSERT INTO asset_categories (company_id, category_name, category_code)
           VALUES ($1, $2, $3) RETURNING id`,
          [companyId, c.categoryName, `${c.categoryCode}-${i + 1}`]
        );
        categoryIds.push(r.rows[0].id);
      }
      categoryIdsByCompany[companyId] = categoryIds;
    }

    console.log('👥 Creating employees for all companies...');
    const employeePassword = await bcrypt.hash('employee123', 10);
    for (let companyIndex = 0; companyIndex < companyIds.length; companyIndex++) {
      const companyId = companyIds[companyIndex];
      const domain = companies[companyIndex].name.toLowerCase().replace(/[^a-z]/g, '');
      const companyPrefix = companies[companyIndex].name.split(' ')[0];
      const employeesTemplate = [
        { name: companyIndex === 0 ? 'Rajesh Kumar' : `${companyPrefix} Engineer`, mobile: `+91987654${String(321 + companyIndex).padStart(4, '0')}`, desg: 'Senior Developer', email: companyIndex === 0 ? 'rajesh@techcorp.com' : `engineer${companyIndex + 1}@${domain}.com`, status: 'active' },
        { name: `${companyPrefix} Ops Lead`, mobile: `+91987654${String(421 + companyIndex).padStart(4, '0')}`, desg: 'Operations Lead', email: `ops${companyIndex + 1}@${domain}.com`, status: 'active' },
        { name: `${companyPrefix} Finance Analyst`, mobile: `+91987654${String(521 + companyIndex).padStart(4, '0')}`, desg: 'Finance Analyst', email: `finance${companyIndex + 1}@${domain}.com`, status: 'active' },
        { name: `${companyPrefix} HR Partner`, mobile: `+91987654${String(621 + companyIndex).padStart(4, '0')}`, desg: 'HR Partner', email: `hr${companyIndex + 1}@${domain}.com`, status: 'active' },
        { name: `${companyPrefix} Sales Manager`, mobile: `+91987654${String(721 + companyIndex).padStart(4, '0')}`, desg: 'Sales Manager', email: `sales${companyIndex + 1}@${domain}.com`, status: 'active' },
        { name: `${companyPrefix} Support Specialist`, mobile: `+91987654${String(821 + companyIndex).padStart(4, '0')}`, desg: 'Support Specialist', email: `support${companyIndex + 1}@${domain}.com`, status: 'active' },
        { name: `${companyPrefix} Procurement Officer`, mobile: `+91987654${String(921 + companyIndex).padStart(4, '0')}`, desg: 'Procurement Officer', email: `procurement${companyIndex + 1}@${domain}.com`, status: 'active' },
        { name: `${companyPrefix} Research Associate`, mobile: `+91987654${String(1021 + companyIndex).padStart(4, '0')}`, desg: 'Research Associate', email: `research${companyIndex + 1}@${domain}.com`, status: 'active' },
        { name: `${companyPrefix} Compliance Officer`, mobile: `+91987654${String(1121 + companyIndex).padStart(4, '0')}`, desg: 'Compliance Officer', email: `compliance${companyIndex + 1}@${domain}.com`, status: 'active' },
        { name: `${companyPrefix} Admin Executive`, mobile: `+91987654${String(1221 + companyIndex).padStart(4, '0')}`, desg: 'Admin Executive', email: `admin${companyIndex + 1}@${domain}.com`, status: 'active' }
      ];

      if (companyIndex === 0) {
        employeesTemplate.push(
          { name: 'Suresh Menon', mobile: '+919876543219', desg: 'IT Support Specialist', email: 'suresh@techcorp.com', status: 'recycled', recycleReason: 'Resigned from company', recycledAt: new Date() },
          { name: 'Kavita Joshi', mobile: '+919876543201', desg: 'QA Engineer', email: 'kavita@techcorp.com', status: 'recycled', recycleReason: 'Performance issues', recycledAt: new Date() }
        );
      }

      const employeeIds = [];
      for (const e of employeesTemplate) {
        const r = await pool.query(
          `INSERT INTO employees (company_id, employee_name, mobile_no, designation, email, password_hash, status, recycle_reason, recycled_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [companyId, e.name, e.mobile, e.desg, e.email, employeePassword, e.status, e.recycleReason || null, e.recycledAt || null]
        );
        employeeIds.push(r.rows[0].id);
      }
      employeeIdsByCompany[companyId] = employeeIds;
    }

    console.log('💻 Creating assets for all companies...');
    const baseAssetsData = [
      { name: 'MacBook Pro 16"', desc: 'High-performance laptop for software development', catIdx: 0, branchIdx: 0, deptIdx: 0, pd: '2024-01-15', pp: 2499.00, status: 'active', vendor: 'Apple Inc.', qty: 15, shelf: '365 Days', invoiceNo: 'INV-APL-2024-001', invoiceDate: '2024-01-15', company: 'Apple Enterprise' },
      { name: 'Dell XPS 15', desc: 'Premium laptop for design team', catIdx: 0, branchIdx: 1, deptIdx: 1, pd: '2024-02-10', pp: 1899.00, status: 'active', vendor: 'Dell Technologies', qty: 10, shelf: '365 Days', invoiceNo: 'INV-DEL-2024-012', invoiceDate: '2024-02-10', company: 'Dell India' },
      { name: 'Herman Miller Aeron Chair', desc: 'Ergonomic office chair for engineers and analysts', catIdx: 1, branchIdx: 2, deptIdx: 0, pd: '2024-01-20', pp: 1200.00, status: 'active', vendor: 'Herman Miller', qty: 50, shelf: '1095 Days', invoiceNo: 'INV-HM-2024-003', invoiceDate: '2024-01-20', company: 'Herman Miller Asia' },
      { name: 'HP LaserJet Printer', desc: 'High-speed office printer for admin teams', catIdx: 3, branchIdx: 3, deptIdx: 3, pd: '2024-02-15', pp: 450.00, status: 'active', vendor: 'HP Inc.', qty: 20, shelf: '730 Days', invoiceNo: 'INV-HP-2024-005', invoiceDate: '2024-02-15', company: 'HP India' },
      { name: 'Cisco Catalyst Switch', desc: 'Managed switch for office networking racks', catIdx: 6, branchIdx: 4, deptIdx: 7, pd: '2024-03-05', pp: 999.00, status: 'active', vendor: 'Cisco', qty: 8, shelf: '1460 Days', invoiceNo: 'INV-CIS-2024-004', invoiceDate: '2024-03-05', company: 'Cisco Systems' },
      { name: 'Samsung Galaxy Tab', desc: 'Tablet devices for sales demos and field teams', catIdx: 9, branchIdx: 5, deptIdx: 5, pd: '2024-03-18', pp: 650.00, status: 'active', vendor: 'Samsung', qty: 12, shelf: '730 Days', invoiceNo: 'INV-SAM-2024-011', invoiceDate: '2024-03-18', company: 'Samsung Business' },
      { name: 'Biometric Access Panel', desc: 'Access control hardware for secure office entry', catIdx: 7, branchIdx: 6, deptIdx: 8, pd: '2024-03-28', pp: 850.00, status: 'active', vendor: 'Honeywell', qty: 6, shelf: '1825 Days', invoiceNo: 'INV-BIO-2024-007', invoiceDate: '2024-03-28', company: 'Honeywell Secure' },
      { name: 'Research Microscope', desc: 'Lab microscope used by product research teams', catIdx: 8, branchIdx: 7, deptIdx: 9, pd: '2024-04-01', pp: 2200.00, status: 'active', vendor: 'Olympus', qty: 4, shelf: '1825 Days', invoiceNo: 'INV-LAB-2024-006', invoiceDate: '2024-04-01', company: 'Olympus Labs' },
      { name: 'Toyota Innova Fleet Car', desc: 'Company pool vehicle for branch visits and logistics', catIdx: 2, branchIdx: 8, deptIdx: 3, pd: '2024-04-08', pp: 32000.00, status: 'active', vendor: 'Toyota', qty: 2, shelf: '2190 Days', invoiceNo: 'INV-VEH-2024-002', invoiceDate: '2024-04-08', company: 'Toyota Corporate' },
      { name: 'Standing Workstation Desk', desc: 'Height-adjustable desk for hybrid collaboration zones', catIdx: 1, branchIdx: 9, deptIdx: 4, pd: '2024-04-12', pp: 780.00, status: 'active', vendor: 'Featherlite', qty: 14, shelf: '1460 Days', invoiceNo: 'INV-DSK-2024-015', invoiceDate: '2024-04-12', company: 'Featherlite India' },
      { name: 'Recycled Laptop (Recycle Bin)', desc: 'Test item for recycle bin feature', catIdx: 0, branchIdx: 0, deptIdx: 0, pd: '2023-01-01', pp: 1000.00, status: 'recycled', vendor: 'Test Vendor', qty: 1, shelf: '365 Days', invoiceNo: 'INV-REC-001', invoiceDate: '2023-01-01', company: 'Test', recycleReason: 'Replaced during hardware refresh cycle', recycledAt: new Date() },
      { name: 'Old Company Laptop (Sold)', desc: 'Sold asset for reporting after full depreciation', catIdx: 0, branchIdx: 1, deptIdx: 5, pd: '2020-01-01', pp: 1200.00, status: 'sold', vendor: 'Dell', qty: 1, shelf: '365 Days', invoiceNo: 'INV-OLD-001', invoiceDate: '2020-01-01', company: 'Dell Old' },
      { name: 'Broken Printer (Scrapped)', desc: 'Scrapped asset for reporting due to repeated failures', catIdx: 3, branchIdx: 2, deptIdx: 3, pd: '2021-06-01', pp: 300.00, status: 'scraped', vendor: 'HP', qty: 1, shelf: '365 Days', invoiceNo: 'INV-OLD-002', invoiceDate: '2021-06-01', company: 'HP Old' }
    ];

    for (let companyIndex = 0; companyIndex < companyIds.length; companyIndex++) {
      const companyId = companyIds[companyIndex];
      const branchIds = branchIdsByCompany[companyId];
      const deptIds = deptIdsByCompany[companyId];
      const categoryIds = categoryIdsByCompany[companyId];
      const companyName = companies[companyIndex].name;
      const assetIds = [];

      for (let assetIndex = 0; assetIndex < baseAssetsData.length; assetIndex++) {
        const a = baseAssetsData[assetIndex];
        const r = await pool.query(
          `INSERT INTO company_assets (
            company_id, category_id, asset_name, asset_company_name, vendor_name, quantity,
            shelf_life, invoice_no, invoice_date, acquisition_cost, acquisition_date,
            description, image_url, status, recycle_reason, recycled_at, current_branch_id, current_department_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
          [
            companyId,
            categoryIds[a.catIdx % categoryCount],
            `${companyName.split(' ')[0]} ${a.name}`,
            a.company,
            a.vendor,
            a.qty,
            a.shelf,
            `${a.invoiceNo}-${companyIndex + 1}`,
            a.invoiceDate,
            a.pp,
            a.pd,
            a.desc,
            null,
            a.status,
            a.recycleReason || null,
            a.recycledAt || null,
            branchIds[a.branchIdx % branchCount],
            deptIds[a.deptIdx % deptCount]
          ]
        );
        assetIds.push(r.rows[0].id);
      }
      assetIdsByCompany[companyId] = assetIds;
    }

    console.log('📊 Creating asset usage records for all companies...');
    for (let companyIndex = 0; companyIndex < companyIds.length; companyIndex++) {
      const companyId = companyIds[companyIndex];
      const assetIds = assetIdsByCompany[companyId];
      const employeeIds = employeeIdsByCompany[companyId];
      const deptIds = deptIdsByCompany[companyId];
      const deptNames = baseDeptsData;
      const companyShort = companies[companyIndex].name.split(' ')[0];

      const usageRecords = [
        { assetIdx: 0, empIdx: 0, deptIdx: 0, empName: companyIndex === 0 ? 'Rajesh Kumar' : `${companyShort} Engineer`, deptName: deptNames[0].departmentName, cost: 150, date: '2024-04-10', type: 'assigned', notes: 'Assigned for development work' },
        { assetIdx: 1, empIdx: 1, deptIdx: 1, empName: `${companyShort} Ops Lead`, deptName: deptNames[1].departmentName, cost: 120, date: '2024-04-12', type: 'assigned', notes: 'Assigned for team operations' },
        { assetIdx: 2, empIdx: 2, deptIdx: 2, empName: `${companyShort} Finance Analyst`, deptName: deptNames[2].departmentName, cost: 90, date: '2024-04-15', type: 'maintenance', notes: 'Furniture assigned to finance workspace' },
        { assetIdx: 3, empIdx: 9, deptIdx: 3, empName: `${companyShort} Admin Executive`, deptName: deptNames[3].departmentName, cost: 60, date: '2024-04-17', type: 'assigned', notes: 'Printer moved into operations support area' },
        { assetIdx: 4, empIdx: 6, deptIdx: 7, empName: `${companyShort} Procurement Officer`, deptName: deptNames[7].departmentName, cost: 140, date: '2024-04-19', type: 'maintenance', notes: 'Network switch configured after branch expansion' },
        { assetIdx: 5, empIdx: 4, deptIdx: 5, empName: `${companyShort} Sales Manager`, deptName: deptNames[5].departmentName, cost: 85, date: '2024-04-21', type: 'assigned', notes: 'Tablet assigned for field demo schedule' },
        { assetIdx: 6, empIdx: 8, deptIdx: 8, empName: `${companyShort} Compliance Officer`, deptName: deptNames[8].departmentName, cost: 70, date: '2024-04-23', type: 'inspection', notes: 'Security panel inspected and logged' },
        { assetIdx: 7, empIdx: 7, deptIdx: 9, empName: `${companyShort} Research Associate`, deptName: deptNames[9].departmentName, cost: 180, date: '2024-04-25', type: 'assigned', notes: 'Microscope allocated to research team' },
        { assetIdx: 8, empIdx: 1, deptIdx: 3, empName: `${companyShort} Ops Lead`, deptName: deptNames[3].departmentName, cost: 220, date: '2024-04-27', type: 'field-use', notes: 'Vehicle booked for inter-branch logistics' },
        { assetIdx: 9, empIdx: 3, deptIdx: 4, empName: `${companyShort} HR Partner`, deptName: deptNames[4].departmentName, cost: 55, date: '2024-04-29', type: 'assigned', notes: 'Desk setup completed for HR onboarding bay' }
      ];

      for (const u of usageRecords) {
        await pool.query(
          `INSERT INTO asset_usage (
            company_id, asset_id, employee_id, department_id, employee_name, department_name,
            usage_cost, usage_date, usage_type, notes
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [companyId, assetIds[u.assetIdx], employeeIds[u.empIdx], deptIds[u.deptIdx], u.empName, u.deptName, u.cost, u.date, u.type, u.notes]
        );
      }
    }

    console.log('🔄 Creating asset transfer records for all companies...');
    for (let companyIndex = 0; companyIndex < companyIds.length; companyIndex++) {
      const companyId = companyIds[companyIndex];
      const assetIds = assetIdsByCompany[companyId];
      const branchIds = branchIdsByCompany[companyId];
      const deptIds = deptIdsByCompany[companyId];

      const transferRecords = [
        { assetIdx: 1, fromB: 1, toB: 2, fromD: 1, toD: 1, empName: 'Sales Transfer', cost: 250, date: '2024-04-28', type: 'branch', notes: 'Moved across branch', status: 'completed' },
        { assetIdx: 2, fromB: 2, toB: 2, fromD: 0, toD: 1, empName: 'Department Transfer', cost: 0, date: '2024-05-02', type: 'department', notes: 'Reassigned internally', status: 'completed' },
        { assetIdx: 3, fromB: 3, toB: 4, fromD: 3, toD: 3, empName: 'Printer Relocation', cost: 95, date: '2024-05-04', type: 'branch', notes: 'Printer moved to support branch', status: 'completed' },
        { assetIdx: 4, fromB: 4, toB: 5, fromD: 7, toD: 7, empName: 'Network Transfer', cost: 175, date: '2024-05-06', type: 'branch', notes: 'Switch installed in newly operational branch', status: 'completed' },
        { assetIdx: 5, fromB: 5, toB: 5, fromD: 5, toD: 6, empName: 'Demo Device Reassignment', cost: 20, date: '2024-05-08', type: 'department', notes: 'Tablet reassigned from sales to customer success', status: 'completed' },
        { assetIdx: 6, fromB: 6, toB: 7, fromD: 8, toD: 8, empName: 'Security Rollout', cost: 140, date: '2024-05-10', type: 'branch', notes: 'Security hardware moved during compliance rollout', status: 'completed' },
        { assetIdx: 7, fromB: 7, toB: 7, fromD: 9, toD: 0, empName: 'Research Share', cost: 35, date: '2024-05-12', type: 'department', notes: 'Lab equipment shared with engineering team', status: 'completed' },
        { assetIdx: 8, fromB: 8, toB: 9, fromD: 3, toD: 3, empName: 'Fleet Transfer', cost: 310, date: '2024-05-14', type: 'branch', notes: 'Vehicle reassigned for west-coast visits', status: 'completed' },
        { assetIdx: 9, fromB: 9, toB: 0, fromD: 4, toD: 4, empName: 'Workspace Expansion', cost: 45, date: '2024-05-16', type: 'branch', notes: 'Desk moved for expanded HR seating', status: 'completed' },
        { assetIdx: 0, fromB: 0, toB: 0, fromD: 0, toD: 9, empName: 'Prototype Loan', cost: 15, date: '2024-05-18', type: 'department', notes: 'Development laptop temporarily reassigned to research', status: 'completed' }
      ];

      for (const t of transferRecords) {
        await pool.query(
          `INSERT INTO asset_transfers (
            company_id, asset_id, from_branch_id, to_branch_id, from_department_id, to_department_id,
            employee_name, transfer_cost, transfer_date, transfer_type, notes, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [companyId, assetIds[t.assetIdx], branchIds[t.fromB], branchIds[t.toB], deptIds[t.fromD], deptIds[t.toD], t.empName, t.cost, t.date, t.type, t.notes, t.status]
        );
      }
    }

    console.log('🗑️  Creating asset decommission records for all companies...');
    for (let companyIndex = 0; companyIndex < companyIds.length; companyIndex++) {
      const companyId = companyIds[companyIndex];
      const assetIds = assetIdsByCompany[companyId];
      const companyShort = companies[companyIndex].name.split(' ')[0];
      const decomRecords = [
        { assetIdx: 10, type: 'sale', date: '2024-04-30', reason: 'Sold at depreciated value after refresh cycle', salePrice: 450, scrapValue: null, customer: `${companyShort} Buyer`, vendor: null, invoiceNo: `INV-SALE-2024-00${companyIndex + 1}`, invoiceDate: '2024-04-30', status: 'completed' },
        { assetIdx: 11, type: 'scrape', date: '2024-05-03', reason: 'Beyond economical repair', salePrice: null, scrapValue: 25, customer: null, vendor: 'Local Scrap Dealers', invoiceNo: `INV-SCR-2024-00${companyIndex + 1}`, invoiceDate: '2024-05-03', status: 'completed' },
        { assetIdx: 10, type: 'sale', date: '2024-05-09', reason: 'Disposed after lease closure', salePrice: 430, scrapValue: null, customer: `${companyShort} Resale Partner`, vendor: null, invoiceNo: `INV-SALE-2024-10${companyIndex + 1}`, invoiceDate: '2024-05-09', status: 'completed' },
        { assetIdx: 11, type: 'scrape', date: '2024-05-15', reason: 'Spare parts salvaged and unit scrapped', salePrice: null, scrapValue: 35, customer: null, vendor: 'Eco Scrap Services', invoiceNo: `INV-SCR-2024-10${companyIndex + 1}`, invoiceDate: '2024-05-15', status: 'completed' },
        { assetIdx: 10, type: 'sale', date: '2024-05-22', reason: 'Legacy stock sold to certified refurbisher', salePrice: 410, scrapValue: null, customer: `${companyShort} Refurbisher`, vendor: null, invoiceNo: `INV-SALE-2024-20${companyIndex + 1}`, invoiceDate: '2024-05-22', status: 'completed' },
        { assetIdx: 11, type: 'scrape', date: '2024-05-28', reason: 'Final scrap disposal entry for audit closure', salePrice: null, scrapValue: 30, customer: null, vendor: 'Green Waste Processors', invoiceNo: `INV-SCR-2024-20${companyIndex + 1}`, invoiceDate: '2024-05-28', status: 'completed' },
        { assetIdx: 10, type: 'sale', date: '2024-06-04', reason: 'Asset sold to internal partner office', salePrice: 390, scrapValue: null, customer: `${companyShort} Partner Office`, vendor: null, invoiceNo: `INV-SALE-2024-30${companyIndex + 1}`, invoiceDate: '2024-06-04', status: 'completed' },
        { assetIdx: 11, type: 'scrape', date: '2024-06-09', reason: 'Disposed following failed service inspection', salePrice: null, scrapValue: 20, customer: null, vendor: 'Metro Scrap Buyers', invoiceNo: `INV-SCR-2024-30${companyIndex + 1}`, invoiceDate: '2024-06-09', status: 'completed' },
        { assetIdx: 10, type: 'sale', date: '2024-06-16', reason: 'Liquidated as part of space optimization', salePrice: 375, scrapValue: null, customer: `${companyShort} Asset Outlet`, vendor: null, invoiceNo: `INV-SALE-2024-40${companyIndex + 1}`, invoiceDate: '2024-06-16', status: 'completed' },
        { assetIdx: 11, type: 'scrape', date: '2024-06-21', reason: 'Scrapped after corrosion and print-head failure', salePrice: null, scrapValue: 18, customer: null, vendor: 'Regional Scrap Mart', invoiceNo: `INV-SCR-2024-40${companyIndex + 1}`, invoiceDate: '2024-06-21', status: 'completed' }
      ];

      for (const d of decomRecords) {
        await pool.query(
          `INSERT INTO asset_decommission (
            company_id, asset_id, decommission_type, decommission_date, reason,
            sale_price, scrap_value, customer_name, vendor_name, invoice_no, invoice_number, invoice_date, notes, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [companyId, assetIds[d.assetIdx], d.type, d.date, d.reason, d.salePrice, d.scrapValue, d.customer, d.vendor, d.invoiceNo, d.invoiceNo, d.invoiceDate, d.reason, d.status]
        );
      }
    }

    console.log('🔔 Creating notifications...');
    const notifications = [
      { userId: adminId, companyId: null, audience: 'admin', title: 'Welcome to Asset Management', description: 'Your admin account is now active. Start by adding companies.' },
      ...companyIds.flatMap((companyId, index) => {
        const companyName = companies[index].name;
        return [
          { userId: null, companyId, audience: 'company', title: 'Welcome to your Company Dashboard', description: `Manage branches, departments, assets and transfers for ${companyName} from here.` },
          { userId: null, companyId, audience: 'company', title: 'Subscription Reminder', description: `${companyName} subscription is active. Review renewal dates and plan usage regularly.` },
          { userId: null, companyId, audience: 'company', title: 'Asset Transfer Completed', description: `Recent transfer activity was recorded for ${companyName}.` },
          { userId: null, companyId, audience: 'company', title: 'Recycle Bin Ready', description: 'Recycled assets can now be restored or permanently deleted from the company recycle bin.' },
          { userId: null, companyId, audience: 'company', title: 'Quarterly Audit Scheduled', description: `${companyName} asset audit is scheduled for the current quarter.` },
          { userId: null, companyId, audience: 'company', title: 'Department Allocation Updated', description: 'Recent asset usage entries changed department allocations for multiple items.' },
          { userId: null, companyId, audience: 'company', title: 'Branch Expansion Update', description: 'Additional branch inventory has been registered for operational readiness.' },
          { userId: null, companyId, audience: 'company', title: 'Maintenance Review Due', description: 'High-value equipment is due for preventive maintenance review.' },
          { userId: null, companyId, audience: 'company', title: 'Decommission Log Ready', description: 'Sale and scrap entries are available for compliance review.' },
          { userId: null, companyId, audience: 'company', title: 'Employee Assignment Synced', description: 'Assigned assets have been synced with the latest employee ownership records.' },
        ];
      }),
      { userId: null, companyId: companyIds[3], audience: 'admin', title: 'Company Blocked', description: 'Prime Enterprises was blocked due to payment pending.' }
    ];
    for (const n of notifications) {
      await pool.query(
        `INSERT INTO notifications (user_id, company_id, audience, title, description, is_read)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [n.userId, n.companyId, n.audience, n.title, n.description, false]
      );
    }

    const totalEmployees = Object.values(employeeIdsByCompany).reduce((sum, ids) => sum + ids.length, 0);
    const totalAssets = Object.values(assetIdsByCompany).reduce((sum, ids) => sum + ids.length, 0);
    const totalUsage = companyIds.length * 10;
    const totalTransfers = companyIds.length * 10;
    const totalDecom = companyIds.length * 10;

    console.log('\n\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔑 Admin Login:');
    console.log('   Email: admin@assetmanagement.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('🔑 Company Dashboard Login (TechCorp - Active):');
    console.log('   Email: company@techcorp.com');
    console.log('   Password: company123');
    console.log('');
    console.log('🔑 Company Dashboard Login (Prime Enterprises - Blocked):');
    console.log('   Email: company4@primeenterprises.com');
    console.log('   Password: company123');
    console.log('');
    console.log('🔑 Employee Login (Rajesh - Active):');
    console.log('   Email: rajesh@techcorp.com');
    console.log('   Password: employee123');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('📊 Data Summary:');
    console.log('  • 5 Companies (4 Active, 1 Blocked)');
    console.log(`  • ${baseBranchesData.length * companyIds.length} Branches (across all companies)`);
    console.log(`  • ${baseDeptsData.length * companyIds.length} Departments (across all companies)`);
    console.log(`  • ${baseCatsData.length * companyIds.length} Asset Categories (across all companies)`);
    console.log(`  • ${totalAssets} Company Assets (including active, sold, scraped, recycled)`);
    console.log(`  • ${totalEmployees} Employees`);
    console.log(`  • ${totalUsage} Asset Usage records`);
    console.log(`  • ${totalTransfers} Asset Transfer records`);
    console.log(`  • ${totalDecom} Asset Decommission records`);
    console.log(`  • ${notifications.length} Notifications`);
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedDatabase()
  .then(() => {
    console.log('🎉 Seeding process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding process failed:', error);
    process.exit(1);
  });
