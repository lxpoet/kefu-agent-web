import jwt from 'jsonwebtoken';
import { findUserByUsername, verifyPassword, createUser, BizUser } from './db-business.js';

const JWT_SECRET = process.env.JWT_SECRET || 'kefu-agent-bookstore-secret-key-2026';
const JWT_EXPIRES_IN = '7d'; // 7 天过期

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: { user_id: string; username: string };
  error?: string;
}

/**
 * 用户登录
 */
export function login(username: string, password: string): AuthResult {
  const user = findUserByUsername(username);
  if (!user) {
    return { success: false, error: '用户名或密码错误' };
  }
  if (!verifyPassword(user, password)) {
    return { success: false, error: '用户名或密码错误' };
  }
  const token = jwt.sign(
    { userId: user.user_id, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  return {
    success: true,
    token,
    user: { user_id: user.user_id, username: user.username },
  };
}

/**
 * 用户注册
 */
export function register(data: {
  username: string;
  password: string;
  email?: string;
  phone?: string;
}): AuthResult {
  // 检查用户名是否已存在
  const existing = findUserByUsername(data.username);
  if (existing) {
    return { success: false, error: '用户名已存在，请选择其他用户名' };
  }

  // 生成 user_id
  const userId = `U${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  try {
    const user = createUser({
      user_id: userId,
      username: data.username,
      password: data.password,
      email: data.email,
      phone: data.phone,
    });
    // 注册成功后自动登录
    return login(data.username, data.password);
  } catch (error: any) {
    return { success: false, error: error?.message || '注册失败，请稍后重试' };
  }
}

/**
 * 验证 JWT Token（中间件用）
 */
export function verifyToken(token: string): { userId: string; username: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    return decoded;
  } catch {
    return null;
  }
}

/**
 * 从请求中提取并验证 Token
 */
export function authenticateRequest(req: any): { userId: string; username: string } | null {
  // 优先从 cookie 中取 token
  const cookieToken = req.cookies?.token;
  if (cookieToken) {
    return verifyToken(cookieToken);
  }
  // 再从 Authorization header 取（兼容前端 fetch 带 header 的方式）
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return verifyToken(token);
  }
  return null;
}
