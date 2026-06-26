import jwt from 'jsonwebtoken';
import { findUserByUsername, verifyPassword, createUser } from './db-business.js';
var JWT_SECRET = process.env.JWT_SECRET || 'kefu-agent-bookstore-secret-key-2026';
var JWT_EXPIRES_IN = '7d'; // 7 天过期
/**
 * 用户登录
 */
export function login(username, password) {
    var user = findUserByUsername(username);
    if (!user) {
        return { success: false, error: '用户名或密码错误' };
    }
    if (!verifyPassword(user, password)) {
        return { success: false, error: '用户名或密码错误' };
    }
    var token = jwt.sign({ userId: user.user_id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return {
        success: true,
        token: token,
        user: { user_id: user.user_id, username: user.username },
    };
}
/**
 * 用户注册
 */
export function register(data) {
    // 检查用户名是否已存在
    var existing = findUserByUsername(data.username);
    if (existing) {
        return { success: false, error: '用户名已存在，请选择其他用户名' };
    }
    // 生成 user_id
    var userId = "U".concat(Date.now().toString(36).toUpperCase()).concat(Math.random().toString(36).slice(2, 5).toUpperCase());
    try {
        var user = createUser({
            user_id: userId,
            username: data.username,
            password: data.password,
            email: data.email,
            phone: data.phone,
        });
        // 注册成功后自动登录
        return login(data.username, data.password);
    }
    catch (error) {
        return { success: false, error: (error === null || error === void 0 ? void 0 : error.message) || '注册失败，请稍后重试' };
    }
}
/**
 * 验证 JWT Token（中间件用）
 */
export function verifyToken(token) {
    try {
        var decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    }
    catch (_a) {
        return null;
    }
}
/**
 * 从请求中提取并验证 Token
 */
export function authenticateRequest(req) {
    var _a, _b;
    // 优先从 cookie 中取 token
    var cookieToken = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token;
    if (cookieToken) {
        return verifyToken(cookieToken);
    }
    // 再从 Authorization header 取（兼容前端 fetch 带 header 的方式）
    var authHeader = (_b = req.headers) === null || _b === void 0 ? void 0 : _b.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        var token = authHeader.slice(7);
        return verifyToken(token);
    }
    return null;
}
