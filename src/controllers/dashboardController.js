const pool = require('../config/database');
const NotificationModel = require('../models/notificationModel');

function requireCompany(req, res) {
    if (!req.user?.companyId) {
        res.status(400).json({
            success: false,
            error: 'This account is not linked to a company. Contact an administrator.',
        });
        return null;
    }
    return req.user.companyId;
}

class DashboardController {
    static async adminStats(req, res, next) {
        try {
            const companies = await pool.query(
                `SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                    COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked
                 FROM companies`
            );
            const employees = await pool.query(
                `SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                    COUNT(*) FILTER (WHERE status = 'recycled')::int AS recycled
                 FROM employees`
            );
            const assets = await pool.query(
                `SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                    COUNT(*) FILTER (WHERE status = 'sold')::int AS sold,
                    COUNT(*) FILTER (WHERE status = 'scraped')::int AS scraped,
                    COALESCE(SUM(purchase_price),0)::float AS totalValue
                 FROM assets WHERE status <> 'recycled'`
            );
            const recentCompanies = await pool.query(
                `SELECT id, company_name, company_email, status, created_at
                 FROM companies ORDER BY created_at DESC LIMIT 5`
            );
            res.json({
                success: true,
                data: {
                    companies: companies.rows[0],
                    employees: employees.rows[0],
                    assets: assets.rows[0],
                    recentCompanies: recentCompanies.rows.map(c => ({
                        id: String(c.id),
                        companyName: c.company_name,
                        companyEmail: c.company_email,
                        status: c.status,
                        createdAt: c.created_at,
                    })),
                }
            });
        } catch (error) {
            next(error);
        }
    }

    static async stats(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;
            const counts = await pool.query(
                `SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                    COUNT(*) FILTER (WHERE status = 'sold')::int AS sold,
                    COUNT(*) FILTER (WHERE status = 'scraped')::int AS scraped,
                    COUNT(*) FILTER (WHERE status = 'recycled')::int AS recycled,
                    COALESCE(SUM(CASE WHEN status <> 'recycled' THEN acquisition_cost END),0)::float AS totalValue
                 FROM company_assets
                 WHERE company_id = $1`,
                [companyId]
            );
            const depts = await pool.query(
                `SELECT d.id, d.department_name,
                        COUNT(a.id) FILTER (WHERE a.status = 'active')::int AS assetCount,
                        COALESCE(SUM(CASE WHEN a.status = 'active' THEN a.acquisition_cost END),0)::float AS totalValue
                 FROM departments d
                 LEFT JOIN company_assets a ON a.current_department_id = d.id AND a.company_id = d.company_id
                 WHERE d.company_id = $1
                 GROUP BY d.id ORDER BY assetCount DESC, d.department_name`,
                [companyId]
            );
            const branches = await pool.query(
                `SELECT b.id, b.name AS branchName,
                        COUNT(a.id) FILTER (WHERE a.status = 'active')::int AS assetCount,
                        COALESCE(SUM(CASE WHEN a.status = 'active' THEN a.acquisition_cost END),0)::float AS totalValue
                 FROM branches b
                 LEFT JOIN company_assets a ON a.current_branch_id = b.id AND a.company_id = b.company_id
                 WHERE b.company_id = $1
                 GROUP BY b.id ORDER BY assetCount DESC, b.name`,
                [companyId]
            );
            res.json({
                success: true,
                data: {
                    counts: counts.rows[0],
                    departments: depts.rows.map((row) => ({
                        id: String(row.id),
                        departmentName: row.department_name,
                        assetCount: row.assetcount || 0,
                        totalValue: row.totalvalue || 0,
                    })),
                    branches: branches.rows.map((row) => ({
                        id: String(row.id),
                        branchName: row.branchname,
                        assetCount: row.assetcount || 0,
                        totalValue: row.totalvalue || 0,
                    })),
                }
            });
        } catch (error) {
            next(error);
        }
    }

    static async usage(req, res, next) {
        try {
            const companyId = requireCompany(req, res);
            if (!companyId) return;

            const depts = await pool.query(
                `SELECT d.id, d.department_name,
                        COUNT(a.id) FILTER (WHERE a.status = 'active')::int AS asset_count
                 FROM departments d
                 LEFT JOIN company_assets a ON a.current_department_id = d.id AND a.company_id = d.company_id
                 WHERE d.company_id = $1
                 GROUP BY d.id
                 ORDER BY asset_count DESC, d.department_name`,
                [companyId]
            );
            const branches = await pool.query(
                `SELECT b.id, b.name AS branch_name,
                        COUNT(a.id) FILTER (WHERE a.status = 'active')::int AS asset_count
                 FROM branches b
                 LEFT JOIN company_assets a ON a.current_branch_id = b.id AND a.company_id = b.company_id
                 WHERE b.company_id = $1
                 GROUP BY b.id
                 ORDER BY asset_count DESC, b.name`,
                [companyId]
            );
            const deptCosts = await pool.query(
                `SELECT COALESCE(department_name, 'Unassigned') AS name, COALESCE(SUM(usage_cost),0)::float AS cost
                 FROM asset_usage WHERE company_id = $1 GROUP BY department_name ORDER BY cost DESC LIMIT 8`,
                [companyId]
            );
            const branchCosts = await pool.query(
                `SELECT COALESCE(b.name, 'Unassigned') AS name, COALESCE(SUM(t.transfer_cost),0)::float AS cost
                 FROM asset_transfers t
                 LEFT JOIN branches b ON b.id = t.to_branch_id
                 WHERE t.company_id = $1 AND t.transfer_type = 'branch'
                 GROUP BY b.name ORDER BY cost DESC LIMIT 8`,
                [companyId]
            );

            res.json({
                success: true,
                data: {
                    departments: depts.rows.map((row) => ({
                        id: String(row.id),
                        departmentName: row.department_name,
                        assetCount: row.asset_count,
                    })),
                    branches: branches.rows.map((row) => ({
                        id: String(row.id),
                        branchName: row.branch_name,
                        assetCount: row.asset_count,
                    })),
                    departmentCosts: deptCosts.rows,
                    branchCosts: branchCosts.rows,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    static async notifications(req, res, next) {
        try {
            const rows = await NotificationModel.listForUser(
                req.user.id,
                req.user.companyId || null,
                req.user.role
            );
            const items = rows.map(NotificationModel.map);
            const groupsMap = new Map();
            for (const item of items) {
                if (!groupsMap.has(item.date)) groupsMap.set(item.date, []);
                groupsMap.get(item.date).push(item);
            }
            const groups = Array.from(groupsMap.entries()).map(([label, groupItems]) => ({
                label,
                items: groupItems,
            }));
            res.json({ success: true, data: { items, groups } });
        } catch (error) {
            next(error);
        }
    }

    static async markNotificationsRead(req, res, next) {
        try {
            await NotificationModel.markAllReadForUser(
                req.user.id,
                req.user.companyId || null,
                req.user.role
            );

            const rows = await NotificationModel.listForUser(
                req.user.id,
                req.user.companyId || null,
                req.user.role
            );
            const items = rows.map(NotificationModel.map);
            const groupsMap = new Map();
            for (const item of items) {
                if (!groupsMap.has(item.date)) groupsMap.set(item.date, []);
                groupsMap.get(item.date).push(item);
            }
            const groups = Array.from(groupsMap.entries()).map(([label, groupItems]) => ({
                label,
                items: groupItems,
            }));

            res.json({ success: true, message: 'Notifications marked as read.', data: { items, groups } });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = DashboardController;
