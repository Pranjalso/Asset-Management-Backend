const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const UserModel = require('../models/userModel');
const NotificationModel = require('../models/notificationModel');
const bcrypt = require('bcryptjs');
const S3AvatarService = require('../services/s3AvatarService');
const {
    setAuthCookies,
    clearAuthCookies,
    authenticateToken,
    extractToken,
    invalidateToken,
    revokeRefreshToken,
    refreshSession,
} = require('../middleware/authMiddleware');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const ADMIN_ROLE = 'admin';
const COMPANY_ROLE = 'company_user';
const DASHBOARD_ROLE = 'dashboard_user';

const googleClient = GOOGLE_CLIENT_ID
  ? new OAuth2Client(GOOGLE_CLIENT_ID)
  : null;

async function sanitizeUserResponse(user) {
    let avatarUrl = null;
    if (S3AvatarService.isConfigured && S3AvatarService.isS3Uri(user.avatar_url)) {
        const key = S3AvatarService.extractKeyFromS3Uri(user.avatar_url);
        if (key) avatarUrl = await S3AvatarService.createPresignedReadUrl(key);
    } else {
        avatarUrl = user.avatar_url || null;
    }

    return {
        id: user.id.toString(),
        name: user.username,
        email: user.email,
        role: user.role,
        avatarUrl: avatarUrl,
        companyId: user.company_id ? String(user.company_id) : null,
    };
}

async function sendAuthResponse(res, user, message) {
    await setAuthCookies(res, user);
    const sanitizedUser = await sanitizeUserResponse(user);
    return res.json({
        success: true,
        message,
        user: sanitizedUser,
    });
}

function groupNotifications(rows) {
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
    return { items, groups };
}

class AuthController {
    static async register(req, res, next) {
        try {
            const { username, email, password, role } = req.body;

            if (!username || !email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Username, email and password are required'
                });
            }

            const existingUsers = await UserModel.findByEmailOrUsername(email, username);
            if (existingUsers.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'User with this email or username already exists'
                });
            }

            const user = await UserModel.create({ username, email, password, role });

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: user
            });
        } catch (error) {
            next(error);
        }
    }

    static async loginAdmin(req, res, next) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and password are required'
                });
            }

            const user = await UserModel.findByEmailAndRole(email, ADMIN_ROLE);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid admin credentials'
                });
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid admin credentials'
                });
            }

            return await sendAuthResponse(res, user, 'Admin login successful');
        } catch (error) {
            next(error);
        }
    }

    static async loginCompany(req, res, next) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and password are required'
                });
            }

            let user = await UserModel.findByEmailAndRole(email, COMPANY_ROLE);
            if (!user) {
                user = await UserModel.findByEmailAndRole(email, DASHBOARD_ROLE);
            }

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid company credentials'
                });
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid company credentials'
                });
            }

            const companyId = user.company_id || await attachCompanyId(user);
            console.info('[auth] Company login succeeded', {
                userId: user.id,
                email: user.email,
                role: user.role,
                companyId: companyId || null,
                status: user.status || null,
            });

            return await sendAuthResponse(res, user, 'Company login successful');
        } catch (error) {
            next(error);
        }
    }

    static async login(req, res, next) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and password are required'
                });
            }

            const user = await UserModel.findByEmail(email);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials'
                });
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials'
                });
            }

            return await sendAuthResponse(res, user, 'Login successful');
        } catch (error) {
            next(error);
        }
    }

    static async logout(req, res, next) {
        try {
            const token = extractToken(req);
            const adminRefresh = req.cookies?.admin_refresh_token;
            const dashboardRefresh = req.cookies?.dashboard_refresh_token;

            if (token) {
                invalidateToken(token);
            }
            await revokeRefreshToken(adminRefresh);
            await revokeRefreshToken(dashboardRefresh);

            clearAuthCookies(res, 'admin');
            clearAuthCookies(res, 'company_user');
            clearAuthCookies(res, 'dashboard_user');

            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async refresh(req, res, next) {
        try {
            return await refreshSession(req, res);
        } catch (error) {
            next(error);
        }
    }

    static async getCurrentUser(req, res, next) {
        try {
            const user = await UserModel.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            const sanitizedUser = await sanitizeUserResponse(user);
            res.json({
                success: true,
                data: sanitizedUser
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
            res.json({
                success: true,
                data: groupNotifications(rows)
            });
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

            res.json({
                success: true,
                message: 'Notifications marked as read.',
                data: groupNotifications(rows)
            });
        } catch (error) {
            next(error);
        }
    }

    static async getProfile(req, res, next) {
        try {
            const user = await UserModel.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            let avatarUrl = null;
            if (S3AvatarService.isConfigured && S3AvatarService.isS3Uri(user.avatar_url)) {
                const key = S3AvatarService.extractKeyFromS3Uri(user.avatar_url);
                if (key) avatarUrl = await S3AvatarService.createPresignedReadUrl(key);
            } else {
                avatarUrl = user.avatar_url || null;
            }

            res.json({
                success: true,
                data: {
                    id: user.id.toString(),
                    name: user.username,
                    email: user.email,
                    role: user.role,
                    phone: user.phone || '',
                    avatarUrl,
                    createdAt: user.created_at
                }
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateProfile(req, res, next) {
        try {
            const { name, email, phone, avatarUrl } = req.body || {};

            const fields = {};
            if (typeof name === 'string' && name.trim()) fields.username = name.trim();
            if (typeof email === 'string' && email.trim()) {
                const normalizedEmail = email.trim().toLowerCase();
                const existing = await UserModel.findByEmail(normalizedEmail);
                if (existing && existing.id !== Number(req.user.id)) {
                    return res.status(409).json({
                        success: false,
                        error: 'Email is already in use by another account.'
                    });
                }
                fields.email = normalizedEmail;
            }
            if (typeof phone === 'string') fields.phone = phone.trim() || null;

            if (avatarUrl !== undefined) {
                if (typeof avatarUrl === 'string' && avatarUrl.trim()) {
                    fields.avatar_url = avatarUrl.trim();
                } else {
                    fields.avatar_url = null;
                }
            }

            const updated = await UserModel.update(Number(req.user.id), fields);
            if (!updated) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            let signedAvatarUrl = null;
            if (S3AvatarService.isConfigured && S3AvatarService.isS3Uri(updated.avatar_url)) {
                const key = S3AvatarService.extractKeyFromS3Uri(updated.avatar_url);
                if (key) signedAvatarUrl = await S3AvatarService.createPresignedReadUrl(key);
            } else {
                signedAvatarUrl = updated.avatar_url || null;
            }

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: {
                    id: updated.id.toString(),
                    name: updated.username,
                    email: updated.email,
                    role: updated.role,
                    phone: updated.phone || '',
                    avatarUrl: signedAvatarUrl,
                    createdAt: updated.created_at
                }
            });
        } catch (error) {
            next(error);
        }
    }

    static async changePassword(req, res, next) {
        try {
            const { currentPassword, newPassword } = req.body || {};

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Both currentPassword and newPassword are required.'
                });
            }

            if (typeof newPassword !== 'string' || newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'New password must be at least 6 characters long.'
                });
            }

            const userId = Number(req.user.id);
            const ok = await UserModel.verifyPassword(userId, currentPassword);
            if (!ok) {
                return res.status(401).json({
                    success: false,
                    error: 'Current password is incorrect.'
                });
            }

            await UserModel.updatePassword(userId, newPassword);

            res.json({
                success: true,
                message: 'Password changed successfully.'
            });
        } catch (error) {
            next(error);
        }
    }

    static async requestAvatarUpload(req, res, next) {
        try {
            const { contentType, contentLength } = req.body || {};
            if (!contentType) {
                return res.status(400).json({
                    success: false,
                    error: 'contentType is required.'
                });
            }

            const { key, uploadUrl } = await S3AvatarService.createPresignedUploadUrl({
                userId: req.user.id,
                contentType,
                contentLength: contentLength || undefined,
            });

            res.json({
                success: true,
                data: { key, uploadUrl }
            });
        } catch (error) {
            next(error);
        }
    }

    static async confirmAvatarUpload(req, res, next) {
        try {
            const { key } = req.body || {};
            if (!key || typeof key !== 'string' || !key.startsWith('avatars/')) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid S3 key.'
                });
            }

            const storedUrl = await S3AvatarService.avatarUrlForStorage(key);
            const updated = await UserModel.update(Number(req.user.id), {
                avatar_url: storedUrl,
            });

            const signedAvatarUrl = await S3AvatarService.createPresignedReadUrl(key);

            res.json({
                success: true,
                message: 'Avatar saved.',
                data: {
                    id: updated.id.toString(),
                    name: updated.username,
                    email: updated.email,
                    role: updated.role,
                    phone: updated.phone || '',
                    avatarUrl: signedAvatarUrl,
                    avatarStorage: storedUrl,
                    createdAt: updated.created_at,
                }
            });
        } catch (error) {
            next(error);
        }
    }

    static async loginCompanyWithGoogle(req, res, next) {
        try {
            const { credential } = req.body;

            if (!googleClient) {
                return res.status(501).json({
                    success: false,
                    error: 'Google login is not configured on the server.'
                });
            }

            if (!credential) {
                return res.status(400).json({
                    success: false,
                    error: 'Google credential (idToken) is required.'
                });
            }

            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: GOOGLE_CLIENT_ID
            });

            const payload = ticket.getPayload();
            if (!payload || !payload.email || !payload.email_verified) {
                return res.status(401).json({
                    success: false,
                    error: 'Google account email must be verified.'
                });
            }

            const email = payload.email.toLowerCase();
            const name =
                payload.name ||
                payload.given_name ||
                email.split('@')[0] ||
                'Google User';
            const username = name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 48);
            const googlePicture = payload.picture || null;
            const googleId = payload.sub || null;

            let user = await UserModel.findByEmail(email);

            if (user) {
                if (user.role !== COMPANY_ROLE && user.role !== DASHBOARD_ROLE) {
                    return res.status(403).json({
                        success: false,
                        error: 'This account is not authorized for company login.'
                    });
                }
                if (googlePicture && !user.avatar_url) {
                    await UserModel.update(user.id, { avatar_url: googlePicture });
                    user.avatar_url = googlePicture;
                }
                if (googleId && !user.google_id) {
                    await UserModel.update(user.id, { google_id: googleId });
                    user.google_id = googleId;
                }
            } else {
                const randomPassword = crypto.randomBytes(32).toString('hex');
                user = await UserModel.create({
                    username,
                    email,
                    password: randomPassword,
                    role: COMPANY_ROLE,
                    avatar_url: googlePicture,
                    google_id: googleId
                });

                const CompanyModel = require('../models/companyModel');
                const uniqueCode = `CMP${Date.now().toString(36).toUpperCase()}`;
                const company = await CompanyModel.create({
                    user_id: user.id,
                    company_name: `${name}'s Company`,
                    company_email: email,
                    unique_code: uniqueCode,
                    total_user_in_company: 1,
                    status: 'active'
                });

                await UserModel.update(user.id, { company_id: company.id });
                user.company_id = company.id;
            }

            return await sendAuthResponse(res, user, 'Company Google login successful');
        } catch (error) {
            if (
                error &&
                typeof error === 'object' &&
                'message' in error &&
                typeof error.message === 'string' &&
                (error.message.includes('Wrong number of segments') ||
                    error.message.includes('No pem found') ||
                    error.message.includes('Invalid token signature') ||
                    error.message.toLowerCase().includes('invalid') ||
                    error.message.toLowerCase().includes('expired'))
            ) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired Google login. Please try again.'
                });
            }
            next(error);
        }
    }
}

module.exports = AuthController;
