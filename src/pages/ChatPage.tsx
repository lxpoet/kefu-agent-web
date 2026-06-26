import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Model, Session, PermissionMode, CustomAgent, PermissionRequest, RefundOrderItem, BookRecommendItem } from '../types';
import { NewChatView } from '../components/NewChatView';
import { ChatMessages } from '../components/ChatMessages';
import { ChatInput } from '../components/ChatInput';
import { TransferToHuman } from '../components/TransferToHuman';
import { Tag, MessagePlugin } from 'tdesign-react';

const intentLabelMap: Record<string, string> = {
  refund: '退款申请',
  order: '订单查询',
  tech_support: '技术支持',
  transfer_human: '转人工',
  general: '一般咨询',
};
const intentColorMap: Record<string, 'primary' | 'warning' | 'danger' | 'success' | 'default'> = {
  refund: 'danger',
  order: 'primary',
  tech_support: 'warning',
  transfer_human: 'danger',
  general: 'default',
};

interface ChatPageProps {
  currentSession: Session | undefined;
  models: Model[];
  selectedModel: string;
  agents: CustomAgent[];
  isLoading: boolean;
  inputValue: string;
  permissionRequest: PermissionRequest | null;
  permissionMode: PermissionMode;
  refundOrderList?: RefundOrderItem[] | null;
  onRefundCardClose?: () => void;
  bookRecommendList?: BookRecommendItem[] | null;
  onBookRecommendClose?: () => void;
  hasBook?: (bookId: string) => boolean;
  onAddBook?: (book: BookRecommendItem) => void;
  onSendMessage: (message: string, newChatOptions?: NewChatOptions, onNavigate?: (path: string) => void) => void;
  onStop: () => void;
  onInputChange: (value: string) => void;
  onModelChange: (modelId: string) => void;
  onPermissionAllow: () => void;
  onPermissionDeny: () => void;
  onPermissionModeChange: (mode: PermissionMode) => void;
}

interface NewChatOptions {
  agentId: string;
  cwd: string;
  permissionMode: PermissionMode;
}

export function ChatPage({
  currentSession,
  models,
  selectedModel,
  agents,
  isLoading,
  inputValue,
  permissionRequest,
  permissionMode,
  onSendMessage,
  onStop,
  onInputChange,
  onModelChange,
  onPermissionAllow,
  onPermissionDeny,
  onPermissionModeChange,
  refundOrderList,
  onRefundCardClose,
  bookRecommendList,
  onBookRecommendClose,
  hasBook,
  onAddBook,
}: ChatPageProps) {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [newChatAgentId, setNewChatAgentId] = useState('default');
  const [newChatCwd, setNewChatCwd] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferred, setTransferred] = useState(false);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  // 检测是否有转人工标记
  useEffect(() => {
    if (!currentSession || isLoading || transferred) return;
    const msgs = currentSession.messages;
    if (!msgs || msgs.length === 0) return;
    const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant');
    if (lastAssistant && (lastAssistant.content.includes('[转人工]') || lastAssistant.content.includes('【转人工】'))) {
      setShowTransfer(true);
    }
  }, [currentSession?.messages, isLoading, transferred]);

  // 当对话结束时（AI回复完毕且有多轮消息），提示满意度评价 - 已禁用
  // 客服智能体不需要用户侧满意度评价功能

  const handleSend = useCallback((message: string) => {
    if (!currentSession) {
      onSendMessage(message, { agentId: newChatAgentId, cwd: newChatCwd, permissionMode }, (path) => {
        setNewChatAgentId('default');
        setNewChatCwd('');
        navigate(path);
      });
    } else {
      onSendMessage(message);
    }
  }, [currentSession, newChatAgentId, newChatCwd, permissionMode, onSendMessage, navigate]);

  const handleTransferConfirm = () => {
    setShowTransfer(false);
    setTransferred(true);
    MessagePlugin.success('已转接人工客服，预计等待 3-5 分钟，请保持页面开启');
  };

  const showNewChatView = !currentSession || currentSession.messages.length === 0;
  const sessionAny = currentSession as any;
  const currentIntent = sessionAny?.intent;

  return (
    <>
      {/* 对话意图标签栏 */}
      {currentSession && currentIntent && currentIntent !== 'general' && (
        <div
          className="px-6 py-2 border-b flex items-center gap-2"
          style={{ borderColor: 'var(--td-component-border)', background: 'var(--td-bg-color-container)' }}
        >
          <span className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>识别意图：</span>
          <Tag theme={intentColorMap[currentIntent] || 'default'} variant="light" size="small">
            {intentLabelMap[currentIntent] || currentIntent}
          </Tag>
          {transferred && (
            <Tag theme="warning" variant="light" size="small">已转人工 · 等待接入</Tag>
          )}
          {sessionAny?.satisfaction && (
            <Tag theme="success" variant="light" size="small">
              {'⭐'.repeat(sessionAny.satisfaction)} 已评价
            </Tag>
          )}
        </div>
      )}

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        {showNewChatView ? (
          <NewChatView
            agents={agents}
            models={models}
            selectedModel={selectedModel}
            newChatAgentId={newChatAgentId}
            newChatCwd={newChatCwd}
            newChatPermissionMode={permissionMode}
            onSelectModel={onModelChange}
            onSelectAgent={setNewChatAgentId}
            onSetCwd={setNewChatCwd}
            onSetPermissionMode={onPermissionModeChange}
            onSend={handleSend}
          />
        ) : (
          <ChatMessages
            messages={currentSession!.messages}
            models={models}
            messagesEndRef={messagesEndRef}
            permissionRequest={permissionRequest}
            onPermissionAllow={onPermissionAllow}
            onPermissionDeny={onPermissionDeny}
            refundOrderList={refundOrderList}
            onRefundCardClose={onRefundCardClose}
            bookRecommendList={bookRecommendList}
            onBookRecommendClose={onBookRecommendClose}
            hasBook={hasBook}
            onAddBook={onAddBook}
          />
        )}
      </div>

      {/* 转人工提示 */}
      {showTransfer && !transferred && (
        <TransferToHuman
          sessionId={currentSession?.id || ''}
          onTransfer={handleTransferConfirm}
          onDismiss={() => setShowTransfer(false)}
        />
      )}

      {/* 输入区域 */}
      <ChatInput
        inputValue={inputValue}
        selectedModel={selectedModel}
        models={models}
        isLoading={isLoading}
        permissionMode={permissionMode}
        onSend={handleSend}
        onStop={onStop}
        onChange={onInputChange}
        onModelChange={onModelChange}
        onPermissionModeChange={onPermissionModeChange}
      />
    </>
  );
}
