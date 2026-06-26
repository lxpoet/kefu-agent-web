import { APP_CONFIG } from '../config';
import { Model, Agent, PermissionMode } from '../types';

interface NewChatViewProps {
  agents: Agent[];
  models: Model[];
  selectedModel: string;
  newChatAgentId: string;
  newChatCwd: string;
  newChatPermissionMode: PermissionMode;
  onSelectModel: (modelId: string) => void;
  onSelectAgent: (agentId: string) => void;
  onSetCwd: (cwd: string) => void;
  onSetPermissionMode: (mode: PermissionMode) => void;
  onSend: (message: string) => void;
}

// 常见问题快捷入口
const quickQuestions = [
  { icon: '💰', label: '申请退款', text: '我想申请退款，应该怎么操作？' },
  { icon: '📦', label: '查询订单', text: '我想查询我的订单物流状态' },
  { icon: '🔧', label: '技术问题', text: 'APP无法正常使用，请帮我解决' },
  { icon: '📋', label: '退货政策', text: '请介绍一下退货退款政策' },
  { icon: '🚚', label: '配送时效', text: '下单后一般多久能收到货？' },
  { icon: '👤', label: '人工客服', text: '我想转接人工客服' },
];

export function NewChatView({
  onSetPermissionMode,
  onSend,
}: NewChatViewProps) {
  // 用于发送快捷问题，直接调用 onSend 发送，无需用户再点发送按钮
  const handleQuickQuestion = (text: string) => {
    if (onSend) {
      onSend(text);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full select-none">
      <div className="w-full max-w-lg">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-lg mx-auto"
            style={{
              background: 'linear-gradient(135deg, #0052d9, #1677ff)',
            }}
          >
            <span className="text-4xl">🤖</span>
          </div>
          <h2
            className="text-2xl font-semibold mb-2"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            {APP_CONFIG.name}助手
          </h2>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            {APP_CONFIG.description}
          </p>
        </div>

        {/* 功能说明 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: '🎯', title: '智能意图识别', desc: '自动识别退款/订单/技术支持' },
            { icon: '📚', title: 'FAQ知识库', desc: '覆盖常见问题，秒速解答' },
            { icon: '👨‍💼', title: '人工客服', desc: '复杂问题智能转接' },
          ].map(item => (
            <div
              key={item.title}
              className="text-center p-3 rounded-xl"
              style={{ background: 'var(--td-bg-color-component)' }}
            >
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-xs font-medium mb-0.5" style={{ color: 'var(--td-text-color-primary)' }}>{item.title}</div>
              <div className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>{item.desc}</div>
            </div>
          ))}
        </div>

        {/* 快捷问题 */}
        <div>
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--td-text-color-primary)' }}>
            常见问题快速入口
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickQuestions.map(q => (
              <button
                key={q.label}
                onClick={() => handleQuickQuestion(q.text)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all hover:scale-[1.02]"
                style={{
                  background: 'var(--td-bg-color-component)',
                  border: '1px solid var(--td-component-border)',
                  color: 'var(--td-text-color-primary)',
                }}
              >
                <span className="text-lg">{q.icon}</span>
                <span className="text-sm">{q.label}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--td-text-color-placeholder)' }}>
          输入任何问题，我会尽力帮您解决 ✨
        </p>
      </div>
    </div>
  );
}
