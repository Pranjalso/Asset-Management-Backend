const crypto = require('crypto');
const CompanyModel = require('../models/companyModel');
const UserModel = require('../models/userModel');
const NotificationModel = require('../models/notificationModel');
const { parseDate, slugUsername } = require('../utils/helpers');

function pick(body, ...keys) {
    for (const key of keys) {
        if (body[key] !== undefined && body[key] !== null && body[key] !== '') return body[key];
    }
    return undefined;
}

class CompanyController {
    static async list(req, res, next) {
        try {
            const { status, page = 1, pageSize = 20, search } = req.query;
            const currentPage = Math.max(1, parseInt(page, 10) || 1);
            const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
            const offset = (currentPage - 1) * size;
            const result = await CompanyModel.list({
                status,
                page: currentPage,
                pageSize: size,
                offset,
                search,
            });
            res.json({
                success: true,
                data: result.rows.map(CompanyModel.map),
                total: result.total,
                page: currentPage,
                pageSize: size,
            });
        } catch (error) {
            next(error);
        }
    }

    static async getById(req, res, next) {
        try {
            const company = await CompanyModel.findById(req.params.id);
            if (!company) {
                return res.status(404).json({ success: false, error: 'Company not found' });
            }
            res.json({ success: true, data: CompanyModel.map(company) });
        } catch (error) {
            next(error);
        }
    }

    static async create(req, res, next) {
        try {
            const body = req.body || {};
            const company_name = pick(body, 'company_name', 'companyName');
            const company_email = String(pick(body, 'company_email', 'companyEmail', 'companyGmail') || '').toLowerCase();
            const unique_code = pick(body, 'unique_code', 'uniqueCode');
            const password = pick(body, 'password') || unique_code;

            if (!company_name || !company_email || !unique_code) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name, email, and unique code are required',
                });
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company_email)) {
                return res.status(400).json({ success: false, error: 'Enter a valid company email address' });
            }

            if (await CompanyModel.findByUniqueCode(unique_code)) {
                return res.status(409).json({ success: false, error: 'Unique code already exists' });
            }
            if (await CompanyModel.findByEmail(company_email) || await UserModel.findByEmail(company_email)) {
                return res.status(409).json({ success: false, error: 'Company email already exists' });
            }

            const user = await UserModel.create({
                username: slugUsername(company_name, company_email),
                email: company_email,
                password,
                role: 'company_user',
                phone: pick(body, 'mobile_number', 'mobileNumber') || null,
            });

            const company = await CompanyModel.create({
                user_id: user.id,
                company_name,
                company_gst: pick(body, 'company_gst', 'companyGST'),
                mobile_number: pick(body, 'mobile_number', 'mobileNumber'),
                company_email,
                unique_code,
                subscription_name: pick(body, 'subscription_name', 'subscriptionName'),
                subscription_from_date: parseDate(pick(body, 'subscription_from_date', 'subscriptionFromDate')),
                subscription_to_date: parseDate(pick(body, 'subscription_to_date', 'subscriptionToDate')),
                total_user_in_company: parseInt(pick(body, 'total_user_in_company', 'totalUserInCompany'), 10) || 0,
            });

            await UserModel.update(user.id, { company_id: company.id });
            await NotificationModel.create({
                userId: req.user.id,
                audience: 'admin',
                title: 'Company User Created',
                description: `${company_name} was added and can log in at Company Dashboard.`,
            });

            res.status(201).json({
                success: true,
                data: CompanyModel.map(company),
                message: `Company created. Login email: ${company_email}. Initial password: unique code (${unique_code}) unless you set a password.`,
            });
        } catch (error) {
            next(error);
        }
    }

    static async update(req, res, next) {
        try {
            const { id } = req.params;
            const body = req.body || {};
            const existing = await CompanyModel.findById(id);
            if (!existing) {
                return res.status(404).json({ success: false, error: 'Company not found' });
            }

            const unique_code = pick(body, 'unique_code', 'uniqueCode');
            const company_email = pick(body, 'company_email', 'companyEmail', 'companyGmail');

            if (unique_code && unique_code !== existing.unique_code) {
                if (await CompanyModel.findByUniqueCode(unique_code)) {
                    return res.status(409).json({ success: false, error: 'Unique code already exists' });
                }
            }
            if (company_email && company_email.toLowerCase() !== existing.company_email.toLowerCase()) {
                if (await CompanyModel.findByEmail(company_email)) {
                    return res.status(409).json({ success: false, error: 'Company email already exists' });
                }
            }

            const company = await CompanyModel.update(id, {
                company_name: pick(body, 'company_name', 'companyName'),
                company_gst: pick(body, 'company_gst', 'companyGST'),
                mobile_number: pick(body, 'mobile_number', 'mobileNumber'),
                company_email: company_email ? String(company_email).toLowerCase() : undefined,
                unique_code,
                subscription_name: pick(body, 'subscription_name', 'subscriptionName'),
                subscription_from_date: parseDate(pick(body, 'subscription_from_date', 'subscriptionFromDate')),
                subscription_to_date: parseDate(pick(body, 'subscription_to_date', 'subscriptionToDate')),
                total_user_in_company: pick(body, 'total_user_in_company', 'totalUserInCompany'),
                status: body.status,
                blocked_reason: pick(body, 'blocked_reason', 'blockedReason'),
            });

            res.json({ success: true, data: CompanyModel.map(company), message: 'Company updated successfully' });
        } catch (error) {
            next(error);
        }
    }

    static async delete(req, res, next) {
        try {
            const company = await CompanyModel.findById(req.params.id);
            if (!company) {
                return res.status(404).json({ success: false, error: 'Company not found' });
            }
            await CompanyModel.remove(req.params.id);
            if (company.user_id) {
                await UserModel.update(company.user_id, { status: 'inactive' }).catch(() => {});
            }
            res.json({ success: true, message: 'Company deleted successfully' });
        } catch (error) {
            next(error);
        }
    }

    static async block(req, res, next) {
        try {
            const reason = req.body?.blocked_reason || req.body?.reason;
            if (!reason) {
                return res.status(400).json({ success: false, error: 'Blocked reason is required' });
            }
            const existing = await CompanyModel.findById(req.params.id);
            if (!existing) return res.status(404).json({ success: false, error: 'Company not found' });
            const company = await CompanyModel.update(req.params.id, {
                status: 'blocked',
                blocked_reason: reason,
            });
            await NotificationModel.create({
                userId: req.user.id,
                companyId: company.id,
                audience: 'admin',
                title: 'Company Blocked',
                description: `${company.company_name} was blocked: ${reason}`,
            });
            res.json({ success: true, data: CompanyModel.map(company), message: 'Company blocked successfully' });
        } catch (error) {
            next(error);
        }
    }

    static async unblock(req, res, next) {
        try {
            const company = await CompanyModel.update(req.params.id, {
                status: 'active',
                blocked_reason: null,
            });
            if (!company) return res.status(404).json({ success: false, error: 'Company not found' });
            res.json({ success: true, data: CompanyModel.map(company), message: 'Company unblocked successfully' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = CompanyController;
