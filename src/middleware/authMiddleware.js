const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const CompanyModel = require('../models/companyModel');
const RefreshTokenModel = require('../models/refreshTokenModel');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || `${JWT_SECRET}_refresh`;
const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const ACCESS_COOKIE_NAME = 'admin_access_token';
const DASHBOARD_ACCESS_COOKIE_NAME = 'dashboard_access_token';
const ADMIN_REFRESH_COOKIE_NAME = 'admin_refresh_token';
const DASHBOARD_REFRESH_COOKIE_NAME = 'dashboard_refresh_token';

const tokenBlacklist = new Set();

function getCookie(req, key) {
    return req.cookies?.[key] || null;
}

function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }

    return getCookie(req, ACCESS_COOKIE_NAME) || getCookie(req, DASHBOARD_ACCESS_COOKIE_NAME) || null;
}

function buildCookieOptions(maxAgeMs) {
    return {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: 'lax',
        path: '/',
        maxAge: maxAgeMs,
    };
}

function parseDurationToMs(value) {
    if (typeof value === 'number') return value * 1000;
    const str = String(value).trim();
    const match = str.match(/^(\d+)(ms|s|m|h|d)?$/i);
    if (!match) return 7 * 24 * 60 * 60 * 1000;

    const amount = Number(match[1]);
    const unit = (match[2] || 's').toLowerCase();
    const multipliers = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };

    return amount * multipliers[unit];
}

function getCookieNamesForRole(role) {
    const isDashboard = role === 'company_user' || role === 'dashboard_user';
    return {
        access: isDashboard ? DASHBOARD_ACCESS_COOKIE_NAME : ACCESS_COOKIE_NAME,
        refresh: isDashboard ? DASHBOARD_REFRESH_COOKIE_NAME : ADMIN_REFRESH_COOKIE_NAME,
    };
}

function generateAccessToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            username: user.username,
            type: 'access',
        },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
}

function generateRefreshToken(user) {
    return jwt.sign(
        {
            id: user.id,
            role: user.role,
            type: 'refresh',
        },
        JWT_REFRESH_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
}

function invalidateToken(token) {
    if (token) {
        tokenBlacklist.add(token);
    }
}

async function setAuthCookies(res, user) {
    const names = getCookieNamesForRole(user.role);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshExpiresAt = new Date(Date.now() + parseDurationToMs(REFRESH_TOKEN_EXPIRY));

    await RefreshTokenModel.store({
        userId: user.id,
        token: refreshToken,
        role: user.role,
        expiresAt: refreshExpiresAt,
    });

    res.cookie(names.access, accessToken, buildCookieOptions(parseDurationToMs(ACCESS_TOKEN_EXPIRY)));
    res.cookie(names.refresh, refreshToken, buildCookieOptions(parseDurationToMs(REFRESH_TOKEN_EXPIRY)));

    return { accessToken, refreshToken, cookieNames: names };
}

function clearCookiePair(res, names) {
    res.clearCookie(names.access, { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'lax', path: '/' });
    res.clearCookie(names.refresh, { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'lax', path: '/' });
}

function clearAuthCookies(res, role) {
    clearCookiePair(res, getCookieNamesForRole(role));
}

async function attachCompanyId(user) {
    if (user.role === 'company_user' || user.role === 'dashboard_user') {
        if (user.company_id) return user.company_id;
        const company = await CompanyModel.findByUserId(user.id);
        return company?.id || null;
    }
    return null;
}

async function authenticateToken(req, res, next) {
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
    }

    if (tokenBlacklist.has(token)) {
        return res.status(401).json({ success: false, error: 'Session invalidated. Please log in again.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await UserModel.findById(decoded.id);

        if (!user) {
            console.warn('[auth] Authenticated token references missing user', {
                path: req.originalUrl,
                userId: decoded.id,
                role: decoded.role,
                email: decoded.email || null,
                hasAdminAccessCookie: Boolean(getCookie(req, ACCESS_COOKIE_NAME)),
                hasDashboardAccessCookie: Boolean(getCookie(req, DASHBOARD_ACCESS_COOKIE_NAME)),
                hasAdminRefreshCookie: Boolean(getCookie(req, ADMIN_REFRESH_COOKIE_NAME)),
                hasDashboardRefreshCookie: Boolean(getCookie(req, DASHBOARD_REFRESH_COOKIE_NAME)),
            });

            clearCookiePair(res, getCookieNamesForRole(decoded.role || 'dashboard_user'));
            return res.status(401).json({ success: false, error: 'User not found.' });
        }

        if (user.status && user.status !== 'active') {
            return res.status(403).json({ success: false, error: 'Your account is not active.' });
        }

        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            username: user.username,
        };

        const companyId = await attachCompanyId(user);
        if (companyId) {
            req.user.companyId = companyId;
        } else if (user.role === 'company_user' || user.role === 'dashboard_user') {
            console.warn('[auth] Company-scoped user authenticated without company link', {
                path: req.originalUrl,
                userId: user.id,
                role: user.role,
                email: user.email,
                companyId: user.company_id || null,
            });
        }

        req.token = token;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
        }

        console.warn('[auth] Failed to verify access token', {
            path: req.originalUrl,
            reason: error.message,
            hasAdminAccessCookie: Boolean(getCookie(req, ACCESS_COOKIE_NAME)),
            hasDashboardAccessCookie: Boolean(getCookie(req, DASHBOARD_ACCESS_COOKIE_NAME)),
        });

        return res.status(403).json({ success: false, error: 'Invalid session token.' });
    }
}

function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ success: false, error: 'Access denied. No role assigned.' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`
            });
        }

        next();
    };
}

async function revokeRefreshToken(token) {
    await RefreshTokenModel.revoke(token);
}

async function refreshSession(req, res) {
    const adminRefreshToken = getCookie(req, ADMIN_REFRESH_COOKIE_NAME);
    const dashboardRefreshToken = getCookie(req, DASHBOARD_REFRESH_COOKIE_NAME);
    const refreshToken = adminRefreshToken || dashboardRefreshToken;
    const cookieNames = dashboardRefreshToken
        ? getCookieNamesForRole('dashboard_user')
        : getCookieNamesForRole('admin');

    if (!refreshToken) {
        clearCookiePair(res, getCookieNamesForRole('admin'));
        clearCookiePair(res, getCookieNamesForRole('dashboard_user'));
        return res.status(401).json({ success: false, error: 'Refresh token missing.' });
    }

    try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        if (decoded?.type !== 'refresh') {
            clearCookiePair(res, cookieNames);
            return res.status(401).json({ success: false, error: 'Invalid refresh token.' });
        }

        const stored = await RefreshTokenModel.findValid(refreshToken);
        if (!stored || Number(stored.user_id) !== Number(decoded.id)) {
            await RefreshTokenModel.revoke(refreshToken);
            clearCookiePair(res, cookieNames);
            return res.status(401).json({ success: false, error: 'Refresh token expired or revoked.' });
        }

        const user = await UserModel.findById(decoded.id);
        if (!user) {
            await RefreshTokenModel.revoke(refreshToken);
            clearCookiePair(res, cookieNames);
            return res.status(401).json({ success: false, error: 'User not found.' });
        }

        if (user.status && user.status !== 'active') {
            await RefreshTokenModel.revoke(refreshToken);
            clearCookiePair(res, getCookieNamesForRole(user.role));
            return res.status(403).json({ success: false, error: 'Your account is not active.' });
        }

        await RefreshTokenModel.revoke(refreshToken);
        const { accessToken } = await setAuthCookies(res, user);

        return res.json({
            success: true,
            message: 'Session refreshed successfully.',
            data: {
                accessToken,
                user: {
                    id: user.id.toString(),
                    name: user.username,
                    email: user.email,
                    role: user.role,
                    avatarUrl: user.avatar_url || null,
                    companyId: user.company_id ? String(user.company_id) : null,
                }
            }
        });
    } catch {
        clearCookiePair(res, cookieNames);
        return res.status(401).json({ success: false, error: 'Invalid refresh token.' });
    }
}

module.exports = {
    ACCESS_COOKIE_NAME,
    DASHBOARD_ACCESS_COOKIE_NAME,
    ADMIN_REFRESH_COOKIE_NAME,
    DASHBOARD_REFRESH_COOKIE_NAME,
    authenticateToken,
    authorizeRoles,
    invalidateToken,
    extractToken,
    setAuthCookies,
    clearAuthCookies,
    refreshSession,
    revokeRefreshToken,
};
