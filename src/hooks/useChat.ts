import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message, ToolCall, PermissionRequest, PermissionMode, Session, CustomAgent, ContentBlock, RefundOrderItem, BookRecommendItem } from '../types';

const STORAGE_KEYS = {
  draftInput: 'draftInput',
};

interface UseChatOptions {
  currentSession: Session | undefined;
  currentSessionId: string | null;
  selectedModel: string;
  getAgent: (id: string) => CustomAgent | undefined;
  addSession: (session: Session) => void;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
  updateSessionMessages: (sessionId: string, updater: (messages: Message[]) => Message[]) => void;
  updateSessionModel: (sessionId: string, modelId: string) => void;
  setCurrentSessionId: (id: string | null) => void;
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
}

interface NewChatOptions {
  agentId: string;
  cwd: string;
  permissionMode: PermissionMode;
}

export function useChat(options: UseChatOptions) {
  const {
    currentSession,
    currentSessionId,
    selectedModel,
    getAgent,
    updateSessionModel,
    setCurrentSessionId,
    setSessions,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.draftInput) || '';
  });
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);
  // key: sessionId，只保存当前会话的退款订单列表，切换会话自动隔离
  const [refundOrderMap, setRefundOrderMap] = useState<Record<string, RefundOrderItem[] | null>>({});
  // key: sessionId，只保存当前会话的书籍推荐列表
  const [bookRecommendMap, setBookRecommendMap] = useState<Record<string, BookRecommendItem[] | null>>({});

  // 保存输入框内容到 localStorage（防抖）
  const saveInput = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  // 发送消息
  const sendMessage = useCallback(async (
    messageContent: string,
    newChatOptions?: NewChatOptions,
    onNavigate?: (path: string) => void
  ) => {
    if (!messageContent.trim() || isLoading) return;

    let sessionId = currentSessionId;
    let currentCwd = currentSession?.cwd;
    let currentAgentId = currentSession?.agentId || 'default';
    let currentPermissionMode = currentSession?.permissionMode || 'default';

    // 如果没有当前会话，使用新对话页面的选项创建新会话
    if (!sessionId && newChatOptions) {
      const selectedAgent = getAgent(newChatOptions.agentId);
      const agentPermissionMode = selectedAgent?.permissionMode || 'default';
      const finalPermissionMode = newChatOptions.permissionMode !== 'default'
        ? newChatOptions.permissionMode
        : agentPermissionMode;

      const newSession: Session = {
        id: uuidv4(),
        title: messageContent.slice(0, 30) + (messageContent.length > 30 ? '...' : ''),
        model: selectedModel,
        agentId: newChatOptions.agentId,
        cwd: newChatOptions.cwd || undefined,
        permissionMode: finalPermissionMode,
        createdAt: new Date(),
        messages: []
      };

      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      sessionId = newSession.id;
      currentCwd = newSession.cwd;
      currentAgentId = newSession.agentId || 'default';
      currentPermissionMode = newSession.permissionMode || 'default';

      updateSessionModel(newSession.id, selectedModel);

      onNavigate?.(`/chat/${newSession.id}`);
    }

    const tempUserMessageId = uuidv4();
    const tempAssistantMessageId = uuidv4();

    const userMessage: Message = {
      id: tempUserMessageId,
      role: 'user',
      content: messageContent,
      timestamp: new Date()
    };

    const assistantMessage: Message = {
      id: tempAssistantMessageId,
      role: 'assistant',
      content: '',
      model: selectedModel,
      timestamp: new Date(),
      isStreaming: true,
      contentBlocks: []
    };

    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const newTitle = s.messages.length === 0
          ? messageContent.slice(0, 30) + (messageContent.length > 30 ? '...' : '')
          : s.title;
        return {
          ...s,
          title: newTitle,
          messages: [...s.messages, userMessage, assistantMessage]
        };
      }
      return s;
    }));

    setInputValue('');
    localStorage.removeItem(STORAGE_KEYS.draftInput);
    setIsLoading(true);
    // 每次发送新消息时，清除当前会话的退款卡片和书籍推荐卡片
    if (sessionId) {
      const sid = sessionId as string;
      setRefundOrderMap(prev => ({ ...prev, [sid]: null }));
      setBookRecommendMap(prev => ({ ...prev, [sid]: null }));
    }

    const agent = getAgent(currentAgentId);
    const systemPrompt = agent?.systemPrompt;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          message: messageContent,
          model: selectedModel,
          systemPrompt,
          cwd: currentCwd,
          permissionMode: currentPermissionMode,
        })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let usedModel = selectedModel;
      let currentToolCalls: ToolCall[] = [];
      let contentBlocks: ContentBlock[] = [];
      let currentTextBlock: string = '';
      let realSessionId: string = sessionId!;
      let realAssistantMessageId = tempAssistantMessageId;
      let sseBuffer = ''; // 跨 chunk 的不完整行缓冲

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          // 最后一段可能不完整，保留到下次
          sseBuffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'init') {
                  realSessionId = data.sessionId;
                  realAssistantMessageId = data.assistantMessageId;
                  usedModel = data.model;

                  if (realSessionId !== sessionId) {
                    setSessions(prev => prev.map(s =>
                      s.id === sessionId ? { ...s, id: realSessionId } : s
                    ));
                    setCurrentSessionId(realSessionId);
                    sessionId = realSessionId;
                  }

                  setSessions(prev => prev.map(s => {
                    if (s.id === realSessionId) {
                      return {
                        ...s,
                        messages: s.messages.map(m =>
                          m.id === tempAssistantMessageId
                            ? { ...m, id: realAssistantMessageId }
                            : m
                        )
                      };
                    }
                    return s;
                  }));
                } else if (data.type === 'text') {
                  fullContent += data.content;
                  currentTextBlock += data.content;

                  const lastBlock = contentBlocks[contentBlocks.length - 1];
                  if (lastBlock && lastBlock.type === 'text') {
                    lastBlock.text = currentTextBlock;
                  } else if (currentTextBlock) {
                    contentBlocks.push({ type: 'text', text: currentTextBlock });
                  }

                  setSessions(prev => prev.map(s => {
                    if (s.id === realSessionId) {
                      return {
                        ...s,
                        messages: s.messages.map(m =>
                          m.id === realAssistantMessageId
                            ? { ...m, content: fullContent, model: usedModel, toolCalls: [...currentToolCalls], contentBlocks: [...contentBlocks] }
                            : m
                        )
                      };
                    }
                    return s;
                  }));
                } else if (data.type === 'tool') {
                  currentTextBlock = '';

                  const toolCall: ToolCall = {
                    id: data.id || uuidv4(),
                    name: data.name,
                    input: data.input,
                    status: 'running'
                  };
                  currentToolCalls.push(toolCall);

                  contentBlocks.push({ type: 'tool_use', toolCall });

                  setSessions(prev => prev.map(s => {
                    if (s.id === realSessionId) {
                      return {
                        ...s,
                        messages: s.messages.map(m =>
                          m.id === realAssistantMessageId
                            ? { ...m, toolCalls: [...currentToolCalls], contentBlocks: [...contentBlocks] }
                            : m
                        )
                      };
                    }
                    return s;
                  }));
                } else if (data.type === 'tool_result') {
                  const toolId = data.toolId;
                  const toolIndex = toolId
                    ? currentToolCalls.findIndex(t => t.id === toolId)
                    : currentToolCalls.length - 1;

                  if (toolIndex >= 0) {
                    currentToolCalls[toolIndex].status = data.isError ? 'error' : 'completed';
                    currentToolCalls[toolIndex].isError = data.isError || false;
                    currentToolCalls[toolIndex].result = typeof data.content === 'string'
                      ? data.content
                      : JSON.stringify(data.content);

                    const blockIndex = contentBlocks.findIndex(
                      b => b.type === 'tool_use' && b.toolCall.id === currentToolCalls[toolIndex].id
                    );
                    if (blockIndex >= 0) {
                      (contentBlocks[blockIndex] as { type: 'tool_use'; toolCall: ToolCall }).toolCall = { ...currentToolCalls[toolIndex] };
                    }

                    setSessions(prev => prev.map(s => {
                      if (s.id === realSessionId) {
                        return {
                          ...s,
                          messages: s.messages.map(m =>
                            m.id === realAssistantMessageId
                              ? { ...m, toolCalls: [...currentToolCalls], contentBlocks: [...contentBlocks] }
                              : m
                          )
                        };
                      }
                      return s;
                    }));
                  }
                } else if (data.type === 'done') {
                  setSessions(prev => prev.map(s => {
                    if (s.id === realSessionId) {
                      return {
                        ...s,
                        messages: s.messages.map(m =>
                          m.id === realAssistantMessageId
                            ? { ...m, isStreaming: false }
                            : m
                        )
                      };
                    }
                    return s;
                  }));
                } else if (data.type === 'permission_request') {
                  console.log('[Permission] Request received:', data);
                  setPermissionRequest({
                    requestId: data.requestId,
                    toolUseId: data.toolUseId,
                    toolName: data.toolName,
                    input: data.input,
                    sessionId: data.sessionId,
                    timestamp: data.timestamp
                  });
                } else if (data.type === 'error') {
                  // 后端返回了错误事件，结束流式状态并显示错误信息
                  const errMsg = data.message || '服务器返回了错误，请稍后重试';
                  console.error('[Chat] Server error event:', errMsg);
                  setSessions(prev => prev.map(s => {
                    if (s.id === realSessionId) {
                      return {
                        ...s,
                        messages: s.messages.map(m =>
                          m.id === realAssistantMessageId
                            ? { ...m, content: `❌ ${errMsg}`, isStreaming: false }
                            : m
                        )
                      };
                    }
                    return s;
                  }));
                } else if (data.type === 'transfer_to_human') {
                  // 转人工通知，前端可做额外处理（目前仅记录日志）
                  console.log('[Chat] Transfer to human requested for session:', data.sessionId);
                } else if (data.type === 'refund_order_list') {
                  // 退款订单列表事件，绑定到当前 realSessionId，隔离多会话
                  console.log('[Chat] Refund order list received:', data.orders?.length, 'orders', 'for session:', realSessionId);
                  setRefundOrderMap(prev => ({ ...prev, [realSessionId]: data.orders || null }));
                } else if (data.type === 'book_recommend') {
                  // 书籍推荐列表事件，供前端渲染书籍卡片
                  console.log('[Chat] Book recommend received:', data.books?.length, 'books', 'for session:', realSessionId);
                  setBookRecommendMap(prev => ({ ...prev, [realSessionId]: data.books || null }));
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
        // 流读取完毕后，确保消息状态结束（防止后端未发 done 事件导致永久 isStreaming）
        setSessions(prev => prev.map(s => {
          if (s.id === realSessionId) {
            return {
              ...s,
              messages: s.messages.map(m =>
                m.id === realAssistantMessageId && m.isStreaming
                  ? { ...m, isStreaming: false }
                  : m
              )
            };
          }
          return s;
        }));
      }
    } catch (error) {
      console.error('Chat error:', error);
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: s.messages.map(m =>
              m.id === tempAssistantMessageId
                ? { ...m, content: '发生错误，请重试', isStreaming: false }
                : m
            )
          };
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
    }
  }, [currentSession, currentSessionId, selectedModel, getAgent, updateSessionModel, setCurrentSessionId, setSessions, isLoading]);

  // 处理停止事件
  const handleStop = useCallback(() => {
    console.log('ChatSender stop event');
    setIsLoading(false);
  }, []);

  // 处理权限允许
  const handlePermissionAllow = useCallback(async () => {
    if (!permissionRequest) return;

    console.log('[Permission] User allowed:', permissionRequest.requestId);

    await fetch('/api/permission-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: permissionRequest.requestId,
        behavior: 'allow'
      })
    });

    setPermissionRequest(null);
  }, [permissionRequest]);

  // 处理权限拒绝
  const handlePermissionDeny = useCallback(async () => {
    if (!permissionRequest) return;

    console.log('[Permission] User denied:', permissionRequest.requestId);

    await fetch('/api/permission-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: permissionRequest.requestId,
        behavior: 'deny',
        message: '用户拒绝了此操作'
      })
    });

    setPermissionRequest(null);
  }, [permissionRequest]);

  // 清除指定会话的退款订单列表
  const clearRefundOrderList = useCallback((sessionId: string) => {
    setRefundOrderMap(prev => ({ ...prev, [sessionId]: null }));
  }, []);

  // 获取当前会话的退款订单列表
  const refundOrderList = currentSessionId ? (refundOrderMap[currentSessionId] ?? null) : null;

  // 清除指定会话的书籍推荐列表
  const clearBookRecommendList = useCallback((sessionId: string) => {
    setBookRecommendMap(prev => ({ ...prev, [sessionId]: null }));
  }, []);

  // 获取当前会话的书籍推荐列表
  const bookRecommendList = currentSessionId ? (bookRecommendMap[currentSessionId] ?? null) : null;

  return {
    isLoading,
    inputValue,
    setInputValue: saveInput,
    permissionRequest,
    refundOrderList,
    clearRefundOrderList,
    bookRecommendList,
    clearBookRecommendList,
    sendMessage,
    handleStop,
    handlePermissionAllow,
    handlePermissionDeny,
  };
}
