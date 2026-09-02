const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { nanoid } = require('nanoid');

const region = process.env.AWS_REGION;
const bucket = process.env.AWS_S3_AVATAR_BUCKET;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const isConfigured = Boolean(region && bucket && accessKeyId && secretAccessKey);

let s3Client = null;
if (isConfigured) {
    s3Client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
    });
}

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);

const MAX_BYTES = 5 * 1024 * 1024;

function extensionFromMime(mime) {
    switch (mime) {
        case 'image/jpeg':
            return 'jpg';
        case 'image/png':
            return 'png';
        case 'image/webp':
            return 'webp';
        case 'image/gif':
            return 'gif';
        default:
            return 'bin';
    }
}

function validateMimeAndSize(mimeType, contentLength) {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        const allowed = Array.from(ALLOWED_MIME_TYPES).join(', ');
        throw new Error(`Unsupported file type "${mimeType}". Allowed: ${allowed}.`);
    }
    if (contentLength && contentLength > MAX_BYTES) {
        throw new Error(`File too large. Max allowed: ${MAX_BYTES / (1024 * 1024)} MB.`);
    }
}

const S3AvatarService = {
    isConfigured,

    ensureConfigured() {
        if (!isConfigured) {
            throw new Error(
                'AWS S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_AVATAR_BUCKET in the backend .env file.'
            );
        }
    },

    async createPresignedUploadUrl({ userId, contentType, contentLength }) {
        this.ensureConfigured();
        validateMimeAndSize(contentType, contentLength);

        const key = `avatars/u_${userId}/${nanoid(14)}.${extensionFromMime(contentType)}`;
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: contentType,
            ContentLength: contentLength ? Number(contentLength) : undefined,
        });
        const url = await getSignedUrl(s3Client, command, { expiresIn: 60 * 10 });
        return { key, uploadUrl: url };
    },

    async createPresignedReadUrl(key) {
        this.ensureConfigured();
        if (!key) return null;
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        return getSignedUrl(s3Client, command, { expiresIn: 60 * 60 * 24 });
    },

    async avatarUrlForStorage(key) {
        return `s3://${bucket}/${key}`;
    },

    isS3Uri(value) {
        return typeof value === 'string' && value.startsWith('s3://');
    },

    extractKeyFromS3Uri(value) {
        if (!this.isS3Uri(value)) return null;
        const prefix = `s3://${bucket}/`;
        if (!value.startsWith(prefix)) return null;
        return value.slice(prefix.length);
    },
};

module.exports = S3AvatarService;
