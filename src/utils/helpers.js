function parsePage(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
    return { page, pageSize, offset: (page - 1) * pageSize };
}

function parseDate(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'lorem') return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const match = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (match) {
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        return `${match[3]}-${month}-${day}`;
    }
    return null;
}

function formatDate(value) {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
}

function toStr(value) {
    if (value === null || value === undefined) return '';
    return String(value);
}

function slugUsername(name, email) {
    const base = (name || email || 'user')
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9_.-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 40) || 'user';
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${base}_${suffix}`;
}

function ok(res, data, extra = {}, status = 200) {
    return res.status(status).json({ success: true, ...extra, data });
}

function created(res, data, message = 'Created successfully') {
    return res.status(201).json({ success: true, message, data });
}

function fail(res, status, error) {
    return res.status(status).json({ success: false, error });
}

function paginated(res, rows, total, page, pageSize) {
    return res.json({
        success: true,
        data: rows,
        total,
        page,
        pageSize,
    });
}

module.exports = {
    parsePage,
    parseDate,
    formatDate,
    toStr,
    slugUsername,
    ok,
    created,
    fail,
    paginated,
};
