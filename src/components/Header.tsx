import { Button, Tooltip, Tag, Avatar, Popup } from 'tdesign-react';
import {
  RefreshIcon,
  SunnyIcon,
  MoonIcon,
  MenuFoldIcon,
  MenuUnfoldIcon,
  UserCircleIcon,
  LogoutIcon,
} from 'tdesign-icons-react';
import { Bot } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { Model, Session, Agent, Theme, User } from '../types';
import { ICON_MAP } from '../utils/iconMap';

interface HeaderProps {
  isAdminPage: boolean;
  isBookListPage: boolean;
  sidebarOpen: boolean;
  theme: Theme;
  currentSession: Session | undefined;
  currentAgent: Agent | undefined;
  models: Model[];
  user: User | null;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onRefreshModels: () => void;
  onLogout: () => void;
}

export function Header({
  isAdminPage,
  isBookListPage,
  sidebarOpen,
  theme,
  currentSession,
  currentAgent,
  models,
  user,
  onToggleSidebar,
  onToggleTheme,
  onRefreshModels,
  onLogout,
}: HeaderProps) {
  const formatModelName = (modelId: string) => {
    const model = models.find(m => m.modelId === modelId);
    const name = model?.name || modelId;
    return name
      .replace(/^(Claude|GPT|Gemini|Kimi|DeepSeek|Qwen|GLM)\s*/i, '')
      .replace(/-/g, ' ')
      .trim() || name;
  };

  return (
    <header
      className="h-14 flex justify-between items-center px-4 flex-shrink-0"
      style={{
        backgroundColor: 'var(--td-bg-color-page)',
        borderBottom: '1px solid var(--td-border-level-1-color)',
      }}
    >
      {/* 左侧：折叠按钮 + 标题 */}
      <div className="flex items-center gap-3">
        <Button
          variant="text"
          shape="circle"
          icon={sidebarOpen ? <MenuFoldIcon /> : <MenuUnfoldIcon />}
          onClick={onToggleSidebar}
        />
        {currentAgent && (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: currentAgent.color || 'var(--td-brand-color)' }}
          >
            {(() => {
              const Icon = ICON_MAP[currentAgent.icon || 'Bot'] || Bot;
              return <Icon size={14} color="white" />;
            })()}
          </div>
        )}
        <h1
          className="text-base font-semibold"
          style={{ color: 'var(--td-text-color-primary)' }}
        >
          {isAdminPage
            ? '管理后台'
            : isBookListPage
            ? '我的书单'
            : (currentSession?.title || APP_CONFIG.name + '助手')}
        </h1>
        {!isAdminPage && currentSession && (
          <Tag size="small" variant="outline">
            {formatModelName(currentSession.model)}
          </Tag>
        )}
      </div>

      {/* 右侧：用户信息 + 操作按钮 */}
      <div className="flex items-center gap-2">
        {/* 用户信息 */}
        {user && (
          <Popup
            trigger="hover"
            placement="bottom-right"
            content={
              <div className="p-2 text-sm">
                <div className="font-medium">{user.username}</div>
                {user.email && <div className="text-gray-400 text-xs mt-1">{user.email}</div>}
                <div
                  className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 cursor-pointer text-red-500 hover:text-red-600"
                  onClick={onLogout}
                >
                  退出登录
                </div>
              </div>
            }
          >
            <div className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <Avatar size="small" shape="circle" icon={<UserCircleIcon />} />
              <span className="text-sm" style={{ color: 'var(--td-text-color-primary)' }}>
                {user.username}
              </span>
            </div>
          </Popup>
        )}

        <Tooltip content={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}>
          <Button
            variant="outline"
            shape="circle"
            icon={theme === 'light' ? <MoonIcon /> : <SunnyIcon />}
            onClick={onToggleTheme}
          />
        </Tooltip>

        {!isAdminPage && (
          <Tooltip content="刷新模型列表">
            <Button
              variant="outline"
              shape="circle"
              icon={<RefreshIcon />}
              onClick={onRefreshModels}
            />
          </Tooltip>
        )}

        {user && (
          <Tooltip content="退出登录">
            <Button
              variant="outline"
              shape="circle"
              icon={<LogoutIcon />}
              onClick={onLogout}
            />
          </Tooltip>
        )}
      </div>
    </header>
  );
}
