export interface AuthResult {
    success: boolean;
    token?: string;
    user?: {
        user_id: string;
        username: string;
    };
    error?: string;
}
/**
 * 用户登录
 */
export declare function login(username: string, password: string): AuthResult;
/**
 * 用户注册
 */
export declare function register(data: {
    username: string;
    password: string;
    email?: string;
    phone?: string;
}): AuthResult;
/**
 * 验证 JWT Token（中间件用）
 */
export declare function verifyToken(token: string): {
    userId: string;
    username: string;
} | null;
/**
 * 从请求中提取并验证 Token
 */
export declare function authenticateRequest(req: any): {
    userId: string;
    username: string;
} | null;
