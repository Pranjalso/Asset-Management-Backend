const { Pool } = require('pg');
require('dotenv').config({ path: '/Users/pranjalsoni/Desktop/Asstes/asset_backend/.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  const res = await pool.query(`SELECT id, category_name FROM asset_categories LIMIT 1`);
  if (res.rows.length > 0) {
    const defaultCat = res.rows[0].id;
    await pool.query(`UPDATE company_assets SET category_id = $1 WHERE category_id IS NULL`, [defaultCat]);
    console.log("Fixed missing categories!");
  } else {
    console.log("No categories found to assign.");
  }
  process.exit(0);
}

fix();
