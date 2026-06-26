import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Button, MessagePlugin, Link } from 'tdesign-react';
import { UserIcon, LockOnIcon, MailIcon, CallIcon } from 'tdesign-icons-react';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      MessagePlugin.warning('请输入用户名和密码');
      return;
    }
    if (mode === 'register' && password.length < 6) {
      MessagePlugin.warning('密码长度不能少于6位');
      return;
    }

    setLoading(true);
    try {
      const result = mode === 'login'
        ? await login(username.trim(), password)
        : await register(username.trim(), password, email.trim() || undefined, phone.trim() || undefined);

      if (result.success) {
        MessagePlugin.success(mode === 'login' ? '登录成功！' : '注册成功！');
        navigate('/');
      } else {
        MessagePlugin.error(result.error || '操作失败');
      }
    } finally {
      setLoading(false);
    }
  };

  // 支持回车键提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-md">

        {/* Logo / 标题 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500 flex items-center justify-center text-white text-3xl shadow-lg">
            📚
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            图书商城智能客服
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            {mode === 'login' ? '登录后体验完整客服功能' : '注册新账号'}
          </p>
        </div>

        {/* 表单卡片 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="space-y-4" onKeyDown={handleKeyDown}>
            <div>
              <label htmlFor="login-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">用户名</label>
              <Input
                id="login-username"
                name="username"
                prefixIcon={<UserIcon />}
                value={username}
                onChange={v => setUsername(v as string)}
                placeholder="请输入用户名"
                size="large"
                clearable
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">密码</label>
              <Input
                id="login-password"
                name="password"
                type="password"
                prefixIcon={<LockOnIcon />}
                value={password}
                onChange={v => setPassword(v as string)}
                placeholder="请输入密码（注册时至少6位）"
                size="large"
                clearable
              />
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">邮箱（可选）</label>
                  <Input
                    id="register-email"
                    name="email"
                    prefixIcon={<MailIcon />}
                    value={email}
                    onChange={v => setEmail(v as string)}
                    placeholder="请输入邮箱"
                    size="large"
                    clearable
                  />
                </div>

                <div>
                  <label htmlFor="register-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">手机号（可选）</label>
                  <Input
                    id="register-phone"
                    name="phone"
                    prefixIcon={<CallIcon />}
                    value={phone}
                    onChange={v => setPhone(v as string)}
                    placeholder="请输入手机号"
                    size="large"
                    clearable
                  />
                </div>
              </>
            )}

            <Button
              theme="primary"
              size="large"
              loading={loading}
              block
              onClick={handleSubmit}
              style={{ marginTop: '8px' }}
            >
              {mode === 'login' ? '登录' : '注册'}
            </Button>
          </div>

          <div className="text-center mt-4">
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              {mode === 'login' ? '还没有账号？' : '已有账号？'}
            </span>
            <Link
              theme="primary"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setUsername('');
                setPassword('');
                setEmail('');
                setPhone('');
              }}
              className="ml-1"
            >
              {mode === 'login' ? '立即注册' : '去登录'}
            </Link>
          </div>

          {mode === 'login' && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-sm text-blue-700 dark:text-blue-300">
              💡 测试账号：<code>alice</code> / <code>password123</code>（或 bob / carol / david / eve）
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

