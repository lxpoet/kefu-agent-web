import { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from 'react';

const API_BASE = ''; // 同域代理，相对路径
const TOKEN_KEY = 'kefu_auth_token';

export interface AuthUser {
  user_id: string;
  username: string;
  email?: string;
  phone?: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends ReturnType<typeof useAuthLogic> {}

/** 获取存储的 token */
export function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

/** 存储 token */
function storeToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

/** 清除 token */
function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

/** 构造带 Auth header 的请求头 */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * 认证核心逻辑（纯函数，不依赖 Context）
 * 从原 useAuth() 提取出来，供 AuthProvider 内部使用
 */
function useAuthLogic() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const checkAuth = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setState({ user: null, loading: false, error: null });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.authenticated) {
        setState({ user: data.user, loading: false, error: null });
      } else {
        clearToken();
        setState({ user: null, loading: false, error: null });
      }
    } catch (err: any) {
      // 网络错误时保留 token，但标记 loading 完成
      setState({ user: null, loading: false, error: err?.message || null });
    }
  }, []);

  // 启动时检查登录态
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (username: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '登录失败');
      }
      if (data.token) storeToken(data.token);
      setState({ user: data.user, loading: false, error: null });
      return { success: true, user: data.user };
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
      return { success: false, error: err.message };
    }
  }, []);

  const register = useCallback(async (username: string, password: string, email?: string, phone?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '注册失败');
      }
      if (data.token) storeToken(data.token);
      setState({ user: data.user, loading: false, error: null });
      return { success: true, user: data.user };
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
      return { success: false, error: err.message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const token = getStoredToken();
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
    } finally {
      clearToken();
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  return {
    user: state.user,
    isAuthenticated: !!state.user,
    loading: state.loading,
    error: state.error,
    login,
    register,
    logout,
    checkAuth,
    getToken: getStoredToken,
    authHeaders,
  };
}

// ============ Context & Provider ============

const AuthContext = createContext<AuthContextValue | null>(null);

/** Auth Provider：包裹在 App 最外层，全局共享 auth 状态 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const authLogic = useAuthLogic();
  return (
    <AuthContext.Provider value={authLogic}>
      {children}
    </AuthContext.Provider>
  );
}

/** 消费 Auth Context 的 Hook */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider. Wrap your App with <AuthProvider>.');
  }
  return ctx;
}
