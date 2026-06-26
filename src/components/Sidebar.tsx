import { Button, Tooltip, Tag } from 'tdesign-react';
import { AddIcon, DeleteIcon, ChartBarIcon, CartIcon } from 'tdesign-icons-react';
import { Bot } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { APP_CONFIG } from '../config';
import { Session, Agent } from '../types';
import { ICON_MAP } from '../utils/iconMap';

// 意图标签颜色映射
const intentColorMap: Record<string, 'primary' | 'warning' | 'danger' | 'success' | 'default'> = {
  refund: 'danger',
  order: 'primary',
  tech_support: 'warning',
  transfer_human: 'danger',
  general: 'default',
};
const intentLabelMap: Record<string, string> = {
  refund: '退款',
  order: '订单',
  tech_support: '技术',
  transfer_human: '转人工',
  general: '咨询',
};

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  sidebarOpen: boolean;
  agents: Agent[];
  getAgent: (id: string) => Agent | undefined;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  bookListCount?: number;
}

export function Sidebar({
  sessions,
  currentSessionId,
  sidebarOpen,
  agents,
  getAgent,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  bookListCount = 0,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');
  const isBookListPage = location.pathname === '/book-list';
  return (
    <aside 
      className="flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden"
      style={{ 
        width: sidebarOpen ? 260 : 0,
        backgroundColor: 'var(--td-bg-color-container)'
      }}
    >
      {/* Logo */}
      <div className="h-14 px-4 flex items-center flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--td-brand-color)' }}
          >
            <span className="text-white text-sm font-bold">{APP_CONFIG.nameInitial}</span>
          </div>
          <span 
            className="text-lg font-semibold"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            {APP_CONFIG.name}
          </span>
        </div>
      </div>

      {/* 新对话按钮 */}
      <div className="p-3">
        <Button 
          icon={<AddIcon />}
          onClick={onNewChat}
          block
          variant="outline"
        >
          新对话
        </Button>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.map(session => {
          const sessionAgent = session.agentId ? getAgent(session.agentId) : getAgent('default');
          const AgentIcon = ICON_MAP[sessionAgent?.icon || 'Bot'] || Bot;
          return (
            <div 
              key={session.id}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-200 group"
              style={{
                backgroundColor: session.id === currentSessionId
                  ? 'var(--td-brand-color-light)' 
                  : 'transparent',
                color: session.id === currentSessionId
                  ? 'var(--td-brand-color)' 
                  : 'var(--td-text-color-secondary)'
              }}
              onClick={() => onSelectSession(session.id)}
              onMouseEnter={(e) => {
                if (session.id !== currentSessionId) {
                  e.currentTarget.style.backgroundColor = 'var(--td-bg-color-component-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (session.id !== currentSessionId) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div 
                className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center"
                style={{ backgroundColor: sessionAgent?.color || 'var(--td-brand-color)' }}
              >
                <AgentIcon size={12} color="white" />
              </div>
              <span className="flex-1 truncate text-sm">{session.title}</span>
              {(session as any).intent && (session as any).intent !== 'general' && (
                <Tag
                  size="small"
                  theme={intentColorMap[(session as any).intent] || 'default'}
                  variant="light"
                  style={{ fontSize: 10, padding: '0 4px', flexShrink: 0 }}
                >
                  {intentLabelMap[(session as any).intent] || (session as any).intent}
                </Tag>
              )}
              <Tooltip content="删除会话">
                <Button
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  variant="text"
                  shape="circle"
                  size="medium"
                  icon={<DeleteIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                />
              </Tooltip>
            </div>
          );
        })}
      </div>
      
      {/* 底部按钮 */}
      <div 
        className="p-3 border-t flex-shrink-0 space-y-2"
        style={{ borderColor: 'var(--td-component-border)' }}
      >
        <Button
          icon={<CartIcon />}
          onClick={() => navigate('/book-list')}
          block
          variant={isBookListPage ? 'outline' : 'text'}
          theme={isBookListPage ? 'primary' : 'default'}
        >
          我的书单
          {bookListCount > 0 && (
            <span
              className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: 'var(--td-brand-color)',
                color: '#fff',
                lineHeight: 1,
              }}
            >
              {bookListCount}
            </span>
          )}
        </Button>
        <Button
          icon={<ChartBarIcon />}
          onClick={() => navigate('/admin')}
          block
          variant={isAdminPage ? 'outline' : 'text'}
          theme={isAdminPage ? 'primary' : 'default'}
        >
          管理后台
        </Button>
      </div>
    </aside>
  );
}
