import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import '@tdesign-react/chat/es/style/index.js';

import { AuthProvider, useAuth } from './hooks/useAuth';
import { useAgents } from './hooks/useAgents';
import { useTheme } from './hooks/useTheme';
import { useSessions } from './hooks/useSessions';
import { useModels } from './hooks/useModels';
import { useChat } from './hooks/useChat';
import { useBookList } from './hooks/useBookList';
import { PermissionMode } from './types';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ChatPage } from './pages/ChatPage';
import { AdminPage } from './pages/AdminPage';
import { BookListPage } from './pages/BookListPage';
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/chat/:sessionId" element={<AppContent />} />
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </AuthProvider>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');
  const isBookListPage = location.pathname === '/book-list';

  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();

  // 路由守卫：未登录 → /login；已登录但在 /login → /
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    } else if (isAuthenticated && location.pathname === '/login') {
      navigate('/', { replace: true });
    }
  }, [authLoading, isAuthenticated, location.pathname, navigate]);

  const { theme, toggleTheme } = useTheme();
  const { agents, addAgent, updateAgent, deleteAgent, getAgent } = useAgents();
  const { models, selectedModel, setSelectedModel, fetchModels } = useModels();
  const { items: bookListItems, addBook, removeBook, hasBook, clearList } = useBookList();
  const {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    sessionModels,
    fetchSessions,
    deleteSession,
    updateSessionModel,
    addSession,
    updateSession,
    updateSessionMessages,
  } = useSessions();

  const {
    isLoading,
    inputValue,
    setInputValue,
    permissionRequest,
    refundOrderList,
    clearRefundOrderList,
    bookRecommendList,
    clearBookRecommendList,
    sendMessage,
    handleStop,
    handlePermissionAllow,
    handlePermissionDeny,
  } = useChat({
    currentSession,
    currentSessionId,
    selectedModel,
    getAgent,
    addSession,
    updateSession,
    updateSessionMessages,
    updateSessionModel,
    setCurrentSessionId,
    setSessions,
  });

  const currentAgent = currentSession?.agentId ? getAgent(currentSession.agentId) : getAgent('default');

  useEffect(() => {
    if (urlSessionId && urlSessionId !== currentSessionId) {
      setCurrentSessionId(urlSessionId);
    } else if (!urlSessionId && !isAdminPage && !isBookListPage && currentSessionId) {
      setCurrentSessionId(null);
    }
  }, [urlSessionId, isAdminPage, currentSessionId, setCurrentSessionId]);

  useEffect(() => {
    if (currentSessionId && sessionModels[currentSessionId]) {
      setSelectedModel(sessionModels[currentSessionId]);
    } else if (currentSession) {
      setSelectedModel(currentSession.model);
    }
  }, [currentSessionId, sessionModels, currentSession, setSelectedModel]);

  useEffect(() => { if (isAuthenticated) fetchSessions(); }, [fetchSessions, isAuthenticated]);

  const updateCurrentSessionModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    if (currentSessionId) updateSessionModel(currentSessionId, modelId);
  }, [currentSessionId, updateSessionModel, setSelectedModel]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const navigateTo = await deleteSession(sessionId);
    if (navigateTo) navigate(navigateTo);
  }, [deleteSession, navigate]);

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
    navigate('/');
  }, [navigate, setCurrentSessionId]);

  const handleSelectSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    navigate(`/chat/${sessionId}`);
  }, [navigate, setCurrentSessionId]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('default');

  // 认证加载中
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center"
        style={{ backgroundColor: 'var(--td-bg-color-page)' }}>
        <span className="text-gray-400">加载中...</span>
      </div>
    );
  }

  // 未登录：只渲染 LoginPage（路由守卫会跳转，这里做兜底）
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div
      className="flex h-screen w-screen"
      style={{ backgroundColor: 'var(--td-bg-color-page)' }}
    >
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        sidebarOpen={sidebarOpen}
        agents={agents}
        getAgent={getAgent}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        bookListCount={bookListItems.length}
      />

      <main
        className="flex-1 flex flex-col min-w-0"
        style={{ backgroundColor: 'var(--td-bg-color-page)' }}
      >
        <Header
          isAdminPage={isAdminPage}
          isBookListPage={isBookListPage}
          sidebarOpen={sidebarOpen}
          theme={theme}
          currentSession={currentSession}
          currentAgent={currentAgent}
          models={models}
          user={user}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleTheme={toggleTheme}
          onRefreshModels={fetchModels}
          onLogout={handleLogout}
        />

        {isAdminPage ? (
          <AdminPage />
        ) : isBookListPage ? (
          <BookListPage
            items={bookListItems}
            onRemoveBook={removeBook}
            onClearList={clearList}
          />
        ) : (
          <ChatPage
            key={currentSessionId || 'new-chat'}
            currentSession={currentSession}
            models={models}
            selectedModel={selectedModel}
            agents={agents}
            isLoading={isLoading}
            inputValue={inputValue}
            permissionRequest={permissionRequest}
            permissionMode={permissionMode}
            onSendMessage={sendMessage}
            onStop={handleStop}
            onInputChange={setInputValue}
            onModelChange={updateCurrentSessionModel}
            onPermissionAllow={handlePermissionAllow}
            onPermissionDeny={handlePermissionDeny}
            onPermissionModeChange={setPermissionMode}
            refundOrderList={refundOrderList}
            onRefundCardClose={() => currentSessionId && clearRefundOrderList(currentSessionId)}
            bookRecommendList={bookRecommendList}
            onBookRecommendClose={() => currentSessionId && clearBookRecommendList(currentSessionId)}
            hasBook={hasBook}
            onAddBook={addBook}
          />
        )}
      </main>
    </div>
  );
}

export default App;
