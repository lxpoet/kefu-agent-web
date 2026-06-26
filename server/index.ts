import 'dotenv/config';
import express from "express";
import { query, unstable_v2_createSession, unstable_v2_authenticate, PermissionResult, CanUseTool } from "@tencent-ai/agent-sdk";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import * as db from "./db.js";
import * as bizDb from "./db-business.js";
import { login, register, verifyToken, authenticateRequest } from "./auth.js";
import { isDashScopeConfigured, getDashScopeApiKey, streamChatCompletion, DASHSCOPE_MODELS, DashScopeMessage, getEmbedding } from "./dashscope.js";

const execAsync = promisify(exec);

interface PendingPermission {
  resolve: (result: PermissionResult) => void;
  reject: (error: Error) => void;
  toolName: string;
  input: Record<string, unknown>;
  sessionId: string;
  timestamp: number;
}

const pendingPermissions = new Map<string, PendingPermission>();
const PERMISSION_TIMEOUT = 5 * 60 * 1000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Cookie 解析中间件（无需额外依赖）
app.use((req: any, res: any, next: any) => {
  const cookieHeader = req.headers.cookie || '';
  const cookies: Record<string, string> = {};
  if (cookieHeader) {
    for (const pair of cookieHeader.split(';')) {
      const [key, ...vals] = pair.trim().split('=');
      cookies[key] = decodeURIComponent(vals.join('='));
    }
  }
  req.cookies = cookies;
  next();
});

// 认证中间件（可选，用于需要登录的接口）
function requireAuth(req: any, res: any, next: any) {
  const auth = authenticateRequest(req);
  if (!auth) {
    return res.status(401).json({ error: '未登录或登录已过期，请重新登录' });
  }
  req.user = auth; // { userId, username }
  next();
}

let cachedModels: Array<{ modelId: string; name: string; description?: string }> = [];
const defaultModel = "qwen3.6-plus";

// ============= 认证 API =============

/**
 * POST /api/auth/register
 * 用户注册
 */
app.post("/api/auth/register", (req, res) => {
  const { username, password, email, phone } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
  }
  const result = register({ username, password, email, phone });
  if (result.success && result.token) {
    res.cookie('token', result.token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });
  }
  res.json(result);
});

/**
 * POST /api/auth/login
 * 用户登录
 */
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
  }
  const result = login(username, password);
  if (result.success && result.token) {
    res.cookie('token', result.token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });
  }
  res.json(result);
});

/**
 * POST /api/auth/logout
 * 用户登出
 */
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 * 获取当前登录用户信息（供前端 checkAuth 调用）
 */
app.get("/api/auth/me", (req, res) => {
  const auth = authenticateRequest(req);
  if (!auth) {
    return res.json({ authenticated: false });
  }
  const user = bizDb.findUserByUserId(auth.userId);
  if (!user) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      phone: user.phone,
    },
  });
});

// ============= 基础 API =============

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

type LoginMethod = 'env' | 'cli' | 'none';
interface LoginStatusResponse {
  isLoggedIn: boolean;
  method?: LoginMethod;
  envConfigured?: boolean;
  cliConfigured?: boolean;
  dashscopeConfigured?: boolean;
  error?: string;
  apiKey?: string;
  envVars?: { apiKey?: string; authToken?: string; internetEnv?: string; baseUrl?: string };
}

app.get("/api/check-login", async (req, res) => {
  const response: LoginStatusResponse = { isLoggedIn: false, envConfigured: false, cliConfigured: false, dashscopeConfigured: isDashScopeConfigured(), envVars: {} };

  const apiKey = process.env.CODEBUDDY_API_KEY;
  const authToken = process.env.CODEBUDDY_AUTH_TOKEN;
  const internetEnv = process.env.CODEBUDDY_INTERNET_ENVIRONMENT;
  const baseUrl = process.env.CODEBUDDY_BASE_URL;

  if (apiKey || authToken) {
    response.envConfigured = true;
    if (apiKey) { response.envVars!.apiKey = apiKey.slice(0, 8) + '****' + apiKey.slice(-4); response.apiKey = response.envVars!.apiKey; }
    if (authToken) response.envVars!.authToken = authToken.slice(0, 8) + '****' + authToken.slice(-4);
    if (internetEnv) response.envVars!.internetEnv = internetEnv;
    if (baseUrl) response.envVars!.baseUrl = baseUrl;
  }

  try {
    let needsLogin = false;
    const result = await unstable_v2_authenticate({
      environment: 'external',
      onAuthUrl: async (authState) => {
        needsLogin = true;
        response.error = '未登录，请先登录 CodeBuddy CLI';
      }
    });

    if (!needsLogin && result?.userinfo) {
      response.isLoggedIn = true;
      response.cliConfigured = true;
      response.method = response.envConfigured ? 'env' : 'cli';
    } else if (!needsLogin) {
      response.isLoggedIn = true;
      response.cliConfigured = true;
      response.method = response.envConfigured ? 'env' : 'cli';
    }
  } catch (error: any) {
    if (response.envConfigured) {
      response.isLoggedIn = true;
      response.method = 'env';
    } else {
      response.error = error?.message || String(error);
      response.method = 'none';
    }
  }

  res.json(response);
});

app.post("/api/save-env-config", (req, res) => {
  const { apiKey, authToken, internetEnv, baseUrl } = req.body;
  if (!apiKey && !authToken) return res.status(400).json({ error: '请至少配置 API Key 或 Auth Token' });

  const configuredVars: string[] = [];
  if (apiKey) { process.env.CODEBUDDY_API_KEY = apiKey; configuredVars.push('CODEBUDDY_API_KEY'); }
  if (authToken) { process.env.CODEBUDDY_AUTH_TOKEN = authToken; configuredVars.push('CODEBUDDY_AUTH_TOKEN'); }
  if (internetEnv) { process.env.CODEBUDDY_INTERNET_ENVIRONMENT = internetEnv; configuredVars.push('CODEBUDDY_INTERNET_ENVIRONMENT'); }
  if (baseUrl) { process.env.CODEBUDDY_BASE_URL = baseUrl; configuredVars.push('CODEBUDDY_BASE_URL'); }
  cachedModels = [];

  res.json({ success: true, message: `已设置: ${configuredVars.join(', ')}`, note: '环境变量仅在当前服务器进程有效' });
});

app.get("/api/models", async (req, res) => {
  try {
    // 收集所有可用模型
    let allModels: Array<{ modelId: string; name: string; description?: string; provider?: string }> = [];

    // 1. DashScope 模型（始终列出，但标注是否可用）
    if (isDashScopeConfigured()) {
      allModels.push(...DASHSCOPE_MODELS);
    }

    // 2. CodeBuddy SDK 模型
    try {
      if (cachedModels.length === 0) {
        const session = await unstable_v2_createSession({ cwd: process.cwd() });
        const models = await session.getAvailableModels();
        if (models && Array.isArray(models)) cachedModels = models;
      }
      if (cachedModels.length > 0) {
        allModels.push(...cachedModels);
      }
    } catch (sdkError: any) {
      console.warn("[Models] SDK 模型列表获取失败:", sdkError?.message);
    }

    // 如果都没有，至少返回默认模型
    if (allModels.length === 0) {
      allModels = [{ modelId: "claude-sonnet-4", name: "Claude Sonnet 4" }];
    }

    // 如果配置了 DashScope 且当前默认不是 SDK 模型，使用 qwen3.6-plus 作为默认
    const effectiveDefault = isDashScopeConfigured()
      ? "qwen3.6-plus"
      : defaultModel;

    res.json({ models: allModels, defaultModel: effectiveDefault, dashscopeConfigured: isDashScopeConfigured() });
  } catch (error: any) {
    const fallback = isDashScopeConfigured() ? DASHSCOPE_MODELS : [{ modelId: "claude-sonnet-4", name: "Claude Sonnet 4" }];
    res.json({ models: fallback, defaultModel: isDashScopeConfigured() ? "qwen-plus" : defaultModel, error: error?.message });
  }
});

// ============= 会话 API =============

app.get("/api/sessions", (req, res) => {
  try {
    const sessions = db.getAllSessions();
    const sessionsWithMessages = sessions.map(session => ({
      ...session,
      messageCount: db.getMessagesBySession(session.id).length
    }));
    res.json({ sessions: sessionsWithMessages });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

app.get("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = db.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "会话不存在" });
    const messages = db.getMessagesBySession(sessionId).map(msg => ({
      ...msg,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null
    }));
    res.json({ session, messages });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

app.post("/api/sessions", (req, res) => {
  try {
    const { model = defaultModel, title = "新对话" } = req.body;
    const now = new Date().toISOString();
    const session = db.createSession({ id: uuidv4(), title, model, created_at: now, updated_at: now });
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "创建会话失败" });
  }
});

app.patch("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, model, intent, status } = req.body;
    const success = db.updateSession(sessionId, { title, model, intent, status });
    if (!success) return res.status(404).json({ error: "会话不存在" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "更新会话失败" });
  }
});

app.delete("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = db.deleteSession(sessionId);
    if (!success) return res.status(404).json({ error: "会话不存在" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "删除会话失败" });
  }
});

// ============= FAQ API =============

app.get("/api/faq", (req, res) => {
  try {
    const { q } = req.query;
    const faqs = q ? db.searchFaq(String(q)) : db.getAllFaqs();
    res.json({ faqs });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取FAQ失败" });
  }
});

app.post("/api/faq", (req, res) => {
  try {
    const { category, question, answer, tags } = req.body;
    if (!category || !question || !answer) return res.status(400).json({ error: '缺少必填字段' });
    const now = new Date().toISOString();
    const faq = db.createFaq({ id: uuidv4(), category, question, answer, tags: tags || null, usage_count: 0, created_at: now, updated_at: now });
    res.json({ faq });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "创建FAQ失败" });
  }
});

app.put("/api/faq/:faqId", (req, res) => {
  try {
    const { faqId } = req.params;
    const { category, question, answer, tags } = req.body;
    const success = db.updateFaq(faqId, { category, question, answer, tags });
    if (!success) return res.status(404).json({ error: "FAQ不存在" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "更新FAQ失败" });
  }
});

app.delete("/api/faq/:faqId", (req, res) => {
  try {
    const { faqId } = req.params;
    const success = db.deleteFaq(faqId);
    if (!success) return res.status(404).json({ error: "FAQ不存在" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "删除FAQ失败" });
  }
});

// ============= 满意度 API =============

app.post("/api/satisfaction", (req, res) => {
  try {
    const { sessionId, rating, comment } = req.body;
    if (!sessionId || !rating) return res.status(400).json({ error: '缺少必填字段' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: '评分必须在1-5之间' });
    const record = db.createSatisfactionRating({ id: uuidv4(), session_id: sessionId, rating, comment: comment || null, created_at: new Date().toISOString() });
    res.json({ record });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "提交满意度失败" });
  }
});

app.get("/api/satisfaction/stats", (req, res) => {
  try {
    const stats = db.getSatisfactionStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取统计失败" });
  }
});

// ============= 转人工 API =============

app.post("/api/transfer", (req, res) => {
  try {
    const { sessionId, reason } = req.body;
    if (!sessionId) return res.status(400).json({ error: '缺少会话ID' });
    const record = db.createTransferRecord({
      id: uuidv4(),
      session_id: sessionId,
      reason: reason || '用户请求转人工',
      status: 'pending',
      agent_name: null,
      created_at: new Date().toISOString(),
      resolved_at: null
    });
    res.json({ record, message: '已为您转接人工客服，预计等待时间3-5分钟' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "转人工失败" });
  }
});

app.get("/api/transfer", (req, res) => {
  try {
    const records = db.getTransferRecords();
    res.json({ records });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取转人工记录失败" });
  }
});

// ============= 管理后台统计 API =============

app.get("/api/admin/dashboard", (req, res) => {
  try {
    const stats = db.getDashboardStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取统计数据失败" });
  }
});

app.get("/api/admin/sessions", (req, res) => {
  try {
    const { intent, status, page = 1, pageSize = 20 } = req.query;
    const sessions = db.getAllSessions();
    let filtered = sessions;
    if (intent) filtered = filtered.filter(s => s.intent === intent);
    if (status) filtered = filtered.filter(s => s.status === status);
    const total = filtered.length;
    const pageNum = Number(page);
    const pageSizeNum = Number(pageSize);
    const paged = filtered.slice((pageNum - 1) * pageSizeNum, pageNum * pageSizeNum);
    const result = paged.map(s => ({
      ...s,
      messageCount: db.getMessagesBySession(s.id).length
    }));
    res.json({ sessions: result, total, page: pageNum, pageSize: pageSizeNum });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取会话列表失败" });
  }
});

// ============= 调试 API（验证 FAQ 注入） =============
app.post("/api/debug-prompt", (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "消息不能为空" });

  // 意图识别
  const detectIntent = (text: string): string => {
    const t = text.toLowerCase();
    if (/(退款|退货|退钱|不想要|取消订单|申请退)/.test(t)) return 'refund';
    if (/(订单|物流|发货|快递|到哪|配送|查询)/.test(t)) return 'order';
    if (/(无法使用|报错|bug|不能用|崩溃|故障|错误|技术)/.test(t)) return 'tech_support';
    if (/(转人工|人工客服|真人|转接)/.test(t)) return 'transfer_human';
    return 'general';
  };
  const detectedIntent = detectIntent(message);

  // 关键词提取
  const BUSINESS_KEYWORDS = [
    '退款', '退货', '退钱', '不想要', '取消订单', '申请退',
    '订单', '物流', '发货', '快递', '到哪', '配送', '查询', '到货',
    '无法使用', '报错', 'bug', '不能用', '崩溃', '故障', '问题', '技术',
    '转人工', '人工客服', '真人', '转接',
    '支付', '付款', '发票', '税票', '报销',
    '账户', '密码', '登录', '注册', '被盗', '实名',
    '质量', '售后', '换货', '维修', '保修',
    '申请', '操作', '怎么', '如何', '多久', '为什么',
  ];
  function extractSearchKeywords(text: string): string[] {
    const t = text.toLowerCase();
    const matched: string[] = [];
    for (const kw of BUSINESS_KEYWORDS) {
      if (t.includes(kw.toLowerCase())) matched.push(kw);
    }
    if (matched.length === 0) {
      const clean = t.replace(/[，。？！、；：""''（）【】《》，。？！\s,.\?!;:'"()\[\]{}<>]+/g, ' ');
      const words = clean.split(/\s+/).filter(w => w.length >= 2);
      matched.push(...words.slice(0, 5));
    }
    return [...new Set(matched)].slice(0, 8);
  }

  // FAQ 搜索
  const searchKeywords = extractSearchKeywords(message);
  let faqResults: any[] = [];
  const seenIds = new Set<string>();
  for (const keyword of searchKeywords) {
    if (keyword.length < 2) continue;
    try {
      const results = db.searchFaq(keyword);
      for (const faq of results) {
        if (!seenIds.has(faq.id)) { seenIds.add(faq.id); faqResults.push(faq); }
      }
    } catch {}
  }
  if (faqResults.length === 0) {
    faqResults = db.searchFaq(message) || [];
  }

  // 构建完整 prompt（和 /api/chat 完全一致的逻辑）
  let faqContext = '';
  if (faqResults.length > 0) {
    faqContext = '\n\n## 相关 FAQ 知识库（请务必优先参考以下内容回答用户，直接使用其中的具体信息）\n';
    faqResults.forEach((faq: any, idx: number) => {
      faqContext += `\n### [FAQ${idx + 1}] (${faq.category})\n**问题**: ${faq.question}\n**答案**: ${faq.answer}\n`;
    });
    faqContext += '\n---\n**重要提示**: 请直接使用以上 FAQ 中的具体信息回答用户，不要用你自己的通用知识替代。如果 FAQ 内容不足以完全回答，可以补充，但必须以 FAQ 内容为主。\n';
  }

  const fullPrompt = `你是"小智"，本平台的智能客服助手。

## 身份信息（必须遵守）
- 你的名字：小智
- 当用户问"你是谁"、"怎么称呼你"、"你是机器人吗"、"你是AI吗"时：
  你必须回答："我是小智，是本平台的智能客服助手，很高兴为您服务！"
- 绝对禁止说"我是一个AI助手"、"我是人工智能"、"我是语言模型"等表述
- 你的职责：处理售后咨询、订单查询、退款申请、技术支持等客户服务工作

## 核心能力
...（省略）

## 当前用户意图类型
${detectedIntent}${faqContext}`;

  res.json({
    inputMessage: message,
    detectedIntent,
    searchKeywords,
    faqCount: faqResults.length,
    faqResults: faqResults.map(f => ({ id: f.id, category: f.category, question: f.question, answer: f.answer.slice(0, 50) + '...' })),
    promptLength: fullPrompt.length,
    containsFAQ: fullPrompt.includes('FAQ'),
    containsXiaozhi: fullPrompt.includes('小智'),
    fullPrompt,
  });
});

// ============= 聊天 API =============

app.post("/api/permission-response", (req, res) => {
  const { requestId, behavior, message } = req.body;
  const pending = pendingPermissions.get(requestId);
  if (!pending) return res.status(404).json({ error: "权限请求不存在或已超时" });

  pendingPermissions.delete(requestId);
  if (behavior === 'allow') {
    pending.resolve({ behavior: 'allow', updatedInput: pending.input });
  } else {
    pending.resolve({ behavior: 'deny', message: message || '用户拒绝了此操作' });
  }
  res.json({ success: true });
});

app.post("/api/chat", async (req, res) => {
  const { sessionId, message, model, systemPrompt, cwd, permissionMode } = req.body;

  console.log(`\n[Chat] ========== 新请求 ==========`);
  console.log(`[Chat] SessionId: ${sessionId}, Message: ${message?.slice(0, 80)}`);

  if (!message) return res.status(400).json({ error: "消息不能为空" });

  // 意图识别
  const detectIntent = (text: string): string => {
    const t = text.toLowerCase();
    if (/(退款|退货|退钱|不想要|取消订单|申请退)/.test(t)) return 'refund';
    if (/(订单|物流|发货|快递|到哪|配送|查询)/.test(t)) return 'order';
    if (/(无法使用|报错|bug|不能用|崩溃|故障|错误|技术)/.test(t)) return 'tech_support';
    if (/(转人工|人工客服|真人|转接)/.test(t)) return 'transfer_human';
    return 'general';
  };

  const detectedIntent = detectIntent(message);

  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();

  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
      model: model || defaultModel,
      sdk_session_id: null,
      intent: detectedIntent,
      created_at: now,
      updated_at: now
    });
  } else if (session.intent === 'general' && detectedIntent !== 'general') {
    // 更新意图
    db.updateSession(session.id, { intent: detectedIntent });
    session = db.getSession(session.id)!;
  }

  const selectedModel = model || session.model;
  const sdkSessionId = session.sdk_session_id;

  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  try {
    db.createMessage({ id: userMessageId, session_id: session.id, role: 'user', content: message, model: null, intent: detectedIntent, created_at: now, tool_calls: null });
  } catch (dbError: any) {
    return res.status(500).json({ error: "保存消息失败", detail: dbError?.message });
  }

  // 如果是转人工请求，直接返回转人工响应
  if (detectedIntent === 'transfer_human') {
    db.createTransferRecord({
      id: uuidv4(),
      session_id: session.id,
      reason: message,
      status: 'pending',
      agent_name: null,
      created_at: now,
      resolved_at: null
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // ========== 关键词提取（必须在使用之前定义） ==========
  // 业务关键词白名单（来自 FAQ 数据）
  const BUSINESS_KEYWORDS = [
    '退款', '退货', '退钱', '不想要', '取消订单', '申请退',
    '订单', '物流', '发货', '快递', '到哪', '配送', '查询', '到货',
    '无法使用', '报错', 'bug', '不能用', '崩溃', '故障', '问题', '技术',
    '转人工', '人工客服', '真人', '转接',
    '支付', '付款', '发票', '税票', '报销',
    '账户', '密码', '登录', '注册', '被盗', '实名',
    '质量', '售后', '换货', '维修', '保修',
    '申请', '操作', '怎么', '如何', '多久', '为什么',
  ];
  function extractSearchKeywords(text: string): string[] {
    const t = text.toLowerCase();
    const matched: string[] = [];
    // 1. 白名单关键词匹配（优先）
    for (const kw of BUSINESS_KEYWORDS) {
      if (t.includes(kw.toLowerCase())) {
        matched.push(kw);
      }
    }
    // 2. 如果没有匹配到白名单，提取连续2字以上非空串作为兜底
    if (matched.length === 0) {
      const clean = t.replace(/[，。？！、；：""''（）【】《》，。？！\s,.\?!;:'"()\[\]{}<>]+/g, ' ');
      const words = clean.split(/\s+/).filter(w => w.length >= 2);
      matched.push(...words.slice(0, 5));
    }
    return [...new Set(matched)].slice(0, 8);
  }

  // ========== 搜索 FAQ 知识库 ==========
  let faqContext = '';
  try {
    // 从用户消息中提取关键词进行搜索（而非用整句匹配）
    const searchKeywords = extractSearchKeywords(message);
    console.log(`[Chat] FAQ 搜索关键词: [${searchKeywords.join(', ')}]`);

    let faqResults: any[] = [];
    const seenIds = new Set<string>();

    // 用每个关键词分别搜索，合并去重
    for (const keyword of searchKeywords) {
      if (keyword.length < 2) continue; // 跳过过短的词
      try {
        const results = db.searchFaq(keyword);
        for (const faq of results) {
          if (!seenIds.has(faq.id)) {
            seenIds.add(faq.id);
            faqResults.push(faq);
          }
        }
      } catch {}
    }

    // 如果关键词搜索没结果，用原始消息兜底搜索一次
    if (faqResults.length === 0) {
      faqResults = db.searchFaq(message) || [];
    }

    if (faqResults.length > 0) {
      faqContext = '\n\n## 相关 FAQ 知识库（请务必优先参考以下内容回答用户，直接使用其中的具体信息）\n';
      faqResults.forEach((faq: any, idx: number) => {
        faqContext += `\n### [FAQ${idx + 1}] (${faq.category})\n**问题**: ${faq.question}\n**答案**: ${faq.answer}\n`;
        // 增加使用计数
        try { db.incrementFaqUsage(faq.id); } catch {}
      });
      faqContext += '\n---\n**重要提示**: 请直接使用以上 FAQ 中的具体信息回答用户，不要用你自己的通用知识替代。如果 FAQ 内容不足以完全回答，可以补充，但必须以 FAQ 内容为主。\n';
      console.log(`[Chat] ✅ 已注入 ${faqResults.length} 条 FAQ 到 prompt，关键词: [${searchKeywords.join(', ')}]`);
    } else {
      console.log(`[Chat] ⚠️ 未找到相关 FAQ，关键词: [${searchKeywords.join(', ')}]`);
    }
  } catch (faqError: any) {
    console.error('[Chat] FAQ 搜索异常:', faqError?.message);
  }

  // ============= 业务数据注入（书籍搜索 / 订单查询） =============
  let businessContext = '';
  let foundBooks: any[] = [];  // 保存书籍搜索结果，供后续 SSE book_recommend 使用
  try {
    // 1. 书籍搜索：用户消息涉及找书、书名、作者、购买意向
    const bookKeywords = [
      // 直接书籍词汇
      '书', '图书', '书籍', '小说', '作者', '作品',
      // 查找/推荐意图
      '推荐', '找', '搜索', '查',
      // 购买/询价意图（最关键：让"三体有卖吗？"这类口语化查询也能触发）
      '有卖', '卖吗', '有货', '多少钱', '价格', '价钱',
      '想买', '买书', '买一本',
      // 询问是否有某物
      '有没有', '你们有'
    ];
    const isBookQuery = bookKeywords.some(kw => message.toLowerCase().includes(kw)) ||
                        /《[^》]+》/.test(message) || // 带书名号的
                        /有没有.{1,30}(?:书|卖|货)/.test(message) || // "有没有XX书/卖/货"
                        /想买.{1,30}/.test(message);  // "想买XX"
    if (isBookQuery) {
      // 提取搜索词：优先书名号内容，其次去掉常见问句后缀得到干净的搜索词
      let searchQuery = message;
      const m = message.match(/《([^》]+)》/);
      if (m) {
        searchQuery = m[1];
      } else {
        // 去掉常见的口语化问句前缀/后缀，提取核心搜索词
        searchQuery = searchQuery
          .replace(/有卖吗[？?]?$/i, '')
          .replace(/卖吗[？?]?$/i, '')
          .replace(/有货吗[？?]?$/i, '')
          .replace(/有吗[？?]?$/i, '')
          .replace(/多少钱[？?]?$/i, '')
          .replace(/什么价[格钱][？?]?$/i, '')
          .replace(/价格[多少]*[？?]?$/i, '')
          .replace(/价钱[多少]*[？?]?$/i, '')
          .replace(/有没有[？?]?$/i, '')
          .replace(/你们有|想买|我要买|帮我找|帮我搜|帮我查/g, '')
          .replace(/的(?:价格|作品|书)[？?]?$/i, '')
          .trim();
      }

      // 尝试获取 query embedding（DashScope 配置时使用混合检索）
      let queryEmbedding: Float32Array | undefined;
      if (isDashScopeConfigured()) {
        try {
          queryEmbedding = await getEmbedding(searchQuery);
          console.log('[Chat] ✅ 已生成 query embedding，使用混合检索');
        } catch (embErr: any) {
          console.warn('[Chat] ⚠️ Embedding 生成失败，退化为 FTS5 纯文本检索:', embErr.message);
        }
      }

      const books = bizDb.searchBooksHybrid(searchQuery, queryEmbedding, 5);

      // 精准匹配检测：如果 FTS5 有高分结果（说明用户搜索了具体书名/作者），
      // 过滤掉仅由 Embedding 语义匹配到的书，避免"搜三体，弹出流浪地球"的情况
      const hasStrongFts5Match = books.some(
        (b: any) => (b._source === 'fts5' || b._source === 'both') && b._score > 0.6
      );
      if (hasStrongFts5Match) {
        foundBooks = books.filter((b: any) => b._source !== 'embedding');
        if (foundBooks.length !== books.length) {
          console.log(`[Chat] 🔍 检测到精准书名匹配（FTS5高分），过滤掉 ${books.length - foundBooks.length} 条纯语义结果`);
        }
      } else {
        foundBooks = books;
      }

      if (foundBooks.length > 0) {
        const sources = foundBooks.map((b: any) => b._source).filter((v: any, i: number, a: any) => a.indexOf(v) === i);
        businessContext += '\n\n## 图书搜索结果（请参考以下数据回答用户）\n';
        foundBooks.forEach((b: any, i: number) => {
          const tags = [];
          if (b._source === 'both') tags.push('🔗精准匹配');
          else if (b._source === 'embedding') tags.push('🧠语义匹配');
          else tags.push('📖关键词匹配');
          businessContext += `${i + 1}. 《${b.title}》- ${b.author || '未知'} | 出版社：${b.publisher || '未知'} | 价格：¥${b.price} | 库存：${b.stock} | 分类：${b.category || '未分类'} ${tags.join(' ')}\n`;
        });
        businessContext += '\n---\n**提示**：请直接引用以上图书信息回答用户，告知书名、作者、价格、库存状态。\n';
        console.log(`[Chat] ✅ 已注入 ${foundBooks.length} 条图书搜索结果（来源: ${sources.join(', ')}）`);
      }
    }

    // 2. 订单查询：已登录用户 + 涉及订单/物流/退款
    const orderKeywords = ['订单', '物流', '发货', '快递', '到哪', '配送', '买', '购买记录', '退款', '退货', '退钱', '不想要'];
    const isOrderQuery = orderKeywords.some(kw => message.toLowerCase().includes(kw));
    if (isOrderQuery) {
      const auth = authenticateRequest(req);
      if (auth) {
        // 退款意图只查最近15天订单，其他查全部
        const orders = detectedIntent === 'refund'
          ? bizDb.getRecentOrdersByUserId(auth.userId, 15)
          : bizDb.getOrdersByUserId(auth.userId);
          if (orders.length > 0) {
          businessContext += detectedIntent === 'refund'
            ? '\n\n## 用户15天内可退款订单（请参考以下数据引导用户退款）\n'
            : '\n\n## 当前用户订单列表（请参考以下数据回答用户）\n';
          orders.forEach((o: any) => {
            const statusText = bizDb.getOrderStatusText(o.status);
            businessContext += `- 订单号：${o.order_no} | 状态：${statusText} | 总金额：¥${o.total_amount} | 下单时间：${o.created_at.slice(0, 10)}`;
            if (detectedIntent === 'refund') {
              businessContext += ` | ${o.is_within_7days ? '⭐7天内（无需填理由）' : '⏱7-15天（需填退款原因）'}`;
            }
            businessContext += '\n';
            if (o.items) {
              o.items.forEach((item: any) => {
                businessContext += `  商品：《${item.book?.title || item.book_id}》（${item.book?.author || ''}） x${item.quantity}（单价 ¥${item.unit_price}）\n`;
              });
            }
          });
          businessContext += detectedIntent === 'refund'
            ? `\n---\n**提示**：用户已登录（用户名：${auth.username}），以上是用户15天内可退款的订单。退款政策：15天内可申请退款，7天内无需填写原因，7-15天需填写退款原因。请引导用户选择订单。\n`
            : `\n---\n**提示**：用户已登录（用户名：${auth.username}），请直接引用以上订单数据回答。如需退款，请引导用户告知订单号。\n`;
          console.log(`[Chat] ✅ 已注入 ${orders.length} 条订单数据，用户：${auth.username}`);
        }
      } else {
        businessContext += '\n\n**注意**：用户询问订单但未登录，请先引导用户登录（登录地址：/login），登录后可查询订单和申请退款。\n';
      }
    }
  } catch (bizError: any) {
    console.error('[Chat] 业务数据注入异常:', bizError?.message);
  }

  // 客服系统提示词
  const kefuSystemPrompt = `你是"小智"，本平台的智能客服助手。

## 身份信息（必须遵守）
- 你的名字：小智
- 当用户问"你是谁"、"怎么称呼你"、"你是机器人吗"、"你是AI吗"时：
  你必须回答："我是小智，是本平台的智能客服助手，很高兴为您服务！"
- 绝对禁止说"我是一个AI助手"、"我是人工智能"、"我是语言模型"等表述
- 你的职责：处理售后咨询、订单查询、退款申请、技术支持等客户服务工作

## 核心能力

1. **意图识别**：自动识别用户的意图，包括：
   - 退款申请（关键词：退款、退货、退钱、不想要了）
   - 订单查询（关键词：订单、物流、发货、快递、到哪了）
   - 技术支持（关键词：无法使用、报错、bug、不能用、崩溃、问题）
   - 转人工（关键词：转人工、人工客服、真人）

2. **FAQ 知识库**：回答常见问题，涵盖退换货政策、配送时效、账户问题等

3. **问题升级**：当遇到无法解决的复杂问题时，主动建议转接人工客服

## 回答规则

- **最重要**：如果下方提供了 FAQ 知识库内容，必须直接使用其中的具体信息回答，不得用通用知识替代
- 始终保持礼貌、专业、简洁
- 对于退款问题：
  1. 先根据 FAQ 知识库和以下退款政策向用户说明：**本平台支持15天退款**，7天内无需填写退款原因（七天无理由退货），7天后至15天内需填写退款原因
  2. 然后告知用户："我可以帮您在线提交退款申请，请从下方选择需要退款的订单"
  3. **7天内的订单**：无需填写理由，直接可提交退款
  4. **7天后的订单**：需要用户填写退款原因才能提交
  5. **不要自己调用工具或帮用户选择订单**，等待用户在退款卡片中操作
- 对于订单查询：提供物流查询方式，说明常规配送时效（1-3天）
- 对于技术问题：引导用户排查，提供解决步骤
- 当问题超出能力范围时，在回复中加入"[转人工]"标记，并说明原因
- 回答结束后可以询问是否还有其他问题

## 当前用户意图类型
${detectedIntent}${faqContext}${businessContext}`;

  // 日志：验证 FAQ 是否注入
  console.log(`[Chat] kefuSystemPrompt 长度=${kefuSystemPrompt.length}, 包含FAQ=${kefuSystemPrompt.includes('FAQ')}, 包含小智=${kefuSystemPrompt.includes('小智')}`);

  const workingDir = cwd || process.cwd();

  // ========== 判断是否使用 DashScope 模型 ==========
  const dashscopeModelIds = DASHSCOPE_MODELS.map(m => m.modelId);
  const isDashScopeModel = dashscopeModelIds.includes(selectedModel);

  // ========== DashScope 模型路径 ==========
  if (isDashScopeModel) {
    if (!isDashScopeConfigured()) {
      res.write(`data: ${JSON.stringify({ type: "error", message: "未配置 DASHSCOPE_API_KEY 环境变量，请先配置阿里云百炼 API Key" })}\n\n`);
      res.end();
      return;
    }

    res.write(`data: ${JSON.stringify({ type: "init", sessionId: session.id, userMessageId, assistantMessageId, model: selectedModel, intent: detectedIntent, provider: "dashscope" })}\n\n`);

    // 退款意图时，发送近15天可退款订单列表供前端渲染退款卡片
    if (detectedIntent === 'refund') {
      try {
        const auth = authenticateRequest(req);
        if (auth) {
          const recentOrders = bizDb.getRecentOrdersByUserId(auth.userId, 15);
          const refundOrders = recentOrders.map(o => ({
            order_no: o.order_no,
            status: o.status,
            status_text: bizDb.getOrderStatusText(o.status),
            total_amount: o.total_amount,
            created_at: o.created_at,
            is_within_7days: (o as any).is_within_7days ?? true,
            items: (o.items || []).map((item: any) => ({
              book_id: item.book_id,
              title: item.book?.title || item.book_id,
              author: item.book?.author || '',
              quantity: item.quantity,
              unit_price: item.unit_price,
            })),
          }));
          res.write(`data: ${JSON.stringify({ type: "refund_order_list", orders: refundOrders })}\n\n`);
          console.log(`[Chat] ✅ 已发送 ${refundOrders.length} 条可退款订单给前端`);
        }
      } catch (refundErr: any) {
        console.error('[Chat] 查询可退款订单异常:', refundErr?.message);
      }
    }

    // 书籍推荐意图时，发送搜索结果供前端渲染书籍卡片
    if (foundBooks.length > 0) {
      res.write(`data: ${JSON.stringify({ type: "book_recommend", books: foundBooks.slice(0, 5).map((b: any) => ({
        book_id: b.book_id, title: b.title, author: b.author || '',
        publisher: b.publisher || '', price: b.price, stock: b.stock,
        category: b.category || '', description: b.description || ''
      })) })}\n\n`);
      console.log(`[Chat] ✅ DashScope路径已发送 ${Math.min(foundBooks.length, 5)} 本书籍推荐给前端`);
    }

    const startTime = Date.now();
    let fullResponse = "";

    // 构建历史消息上下文（多轮对话）
    const historyMessages = db.getMessagesBySession(session.id)
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10); // 最近10条消息作为上下文

    const dashscopeMessages: DashScopeMessage[] = [
      { role: "system", content: kefuSystemPrompt }
    ];

    for (const msg of historyMessages) {
      dashscopeMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    await streamChatCompletion(
      {
        model: selectedModel,
        messages: dashscopeMessages,
        temperature: 0.7,
        max_tokens: 2048,
      },
      {
        onText: (text) => {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
        },
        onDone: (fullText) => {
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);

          // 检测转人工标记
          const needsTransfer = fullText.includes('[转人工]') || fullText.includes('【转人工】');
          if (needsTransfer && !session.transferred_to_human) {
            db.createTransferRecord({
              id: uuidv4(),
              session_id: session.id,
              reason: `AI识别需要转人工：${message.slice(0, 50)}`,
              status: 'pending',
              agent_name: null,
              created_at: new Date().toISOString(),
              resolved_at: null,
            });
            res.write(`data: ${JSON.stringify({ type: "transfer_to_human", sessionId: session.id })}\n\n`);
          }

          db.createMessage({
            id: assistantMessageId,
            session_id: session.id,
            role: 'assistant',
            content: fullText,
            model: selectedModel,
            intent: detectedIntent,
            created_at: new Date().toISOString(),
            tool_calls: null,
          });

          const messages = db.getMessagesBySession(session.id);
          if (messages.length <= 2) {
            db.updateSession(session.id, { title: message.slice(0, 30) + (message.length > 30 ? '...' : ''), model: selectedModel });
          }

          res.write(`data: ${JSON.stringify({ type: "done", duration: parseFloat(duration), cost: 0, provider: "dashscope" })}\n\n`);
          console.log(`[Chat] DashScope 请求完成 ✓ model=${selectedModel} intent=${detectedIntent} duration=${duration}s`);
          res.end();
        },
        onError: (error) => {
          console.error(`[Chat] DashScope Error:`, error.message);
          res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
          res.end();
        },
      }
    );
    return; // DashScope 路径结束
  }

  // ========== CodeBuddy SDK 模型路径（原始逻辑）==========
  try {
    const canUseTool: CanUseTool = async (toolName, input, options) => {
      if (permissionMode === 'bypassPermissions') {
        return { behavior: 'allow', updatedInput: input };
      }

      const requestId = uuidv4();
      const permissionRequest = { requestId, toolUseId: options.toolUseID, toolName, input, sessionId: session!.id, timestamp: Date.now() };
      res.write(`data: ${JSON.stringify({ type: "permission_request", ...permissionRequest })}\n\n`);

      return new Promise<PermissionResult>((resolve, reject) => {
        const pending: PendingPermission = { resolve, reject, toolName, input, sessionId: session!.id, timestamp: Date.now() };
        pendingPermissions.set(requestId, pending);
        setTimeout(() => {
          if (pendingPermissions.has(requestId)) {
            pendingPermissions.delete(requestId);
            resolve({ behavior: 'deny', message: '权限请求超时' });
          }
        }, PERMISSION_TIMEOUT);
      });
    };

    // 注册业务工具（让 AI 可以查书、查订单、提交退款）
    const businessTools = [
      {
        name: "search_books",
        description: "搜索图书信息。当用户想找书、询问某本书、或需要图书推荐时使用。支持按书名、作者、分类模糊搜索。",
        input_schema: {
          type: "object" as const,
          properties: {
            query: { type: "string" as const, description: "搜索关键词，如书名、作者名、分类名" }
          },
          required: ["query"]
        }
      },
      {
        name: "query_order",
        description: "查询当前用户的订单信息。当用户询问订单状态、物流信息、或想查看自己的订单时使用。需要提供订单号来查单个订单，或不提供订单号来列出所有订单。",
        input_schema: {
          type: "object" as const,
          properties: {
            order_no: { type: "string" as const, description: "订单号（可选）。提供则查单个订单详情，不提供则列出所有订单" }
          }
        }
      },
      {
        name: "submit_refund",
        description: "为当前用户提交退款申请。当用户明确表示要退款时使用。需要订单号和退款原因。",
        input_schema: {
          type: "object" as const,
          properties: {
            order_no: { type: "string" as const, description: "要退款的订单号" },
            reason: { type: "string" as const, description: "退款原因，如：买错了、质量问题、不想要了等" }
          },
          required: ["order_no", "reason"]
        }
      }
    ];

    const stream = query({
      prompt: message,
      options: {
        cwd: workingDir,
        model: selectedModel,
        maxTurns: 10,
        systemPrompt: kefuSystemPrompt,
        permissionMode: permissionMode || 'bypassPermissions',
        canUseTool,
        tools: businessTools,
        ...(sdkSessionId ? { resume: sdkSessionId } : {})
      }
    });

    let fullResponse = "";
    let toolCalls: Array<{ id: string; name: string; input?: Record<string, unknown>; status: string; result?: string; isError?: boolean }> = [];
    let newSdkSessionId: string | null = null;
    let currentToolId: string | null = null;

    res.write(`data: ${JSON.stringify({ type: "init", sessionId: session.id, userMessageId, assistantMessageId, model: selectedModel, intent: detectedIntent })}\n\n`);

    // 退款意图时，发送近15天可退款订单列表供前端渲染退款卡片
    if (detectedIntent === 'refund') {
      try {
        const auth = authenticateRequest(req);
        if (auth) {
          const recentOrders = bizDb.getRecentOrdersByUserId(auth.userId, 15);
          const refundOrders = recentOrders.map(o => ({
            order_no: o.order_no,
            status: o.status,
            status_text: bizDb.getOrderStatusText(o.status),
            total_amount: o.total_amount,
            created_at: o.created_at,
            is_within_7days: (o as any).is_within_7days ?? true,
            items: (o.items || []).map((item: any) => ({
              book_id: item.book_id,
              title: item.book?.title || item.book_id,
              author: item.book?.author || '',
              quantity: item.quantity,
              unit_price: item.unit_price,
            })),
          }));
          res.write(`data: ${JSON.stringify({ type: "refund_order_list", orders: refundOrders })}\n\n`);
          console.log(`[Chat] ✅ SDK路径已发送 ${refundOrders.length} 条可退款订单给前端`);
        }
      } catch (refundErr: any) {
        console.error('[Chat] 查询可退款订单异常:', refundErr?.message);
      }
    }

    // 书籍推荐意图时，发送搜索结果供前端渲染书籍卡片
    if (foundBooks.length > 0) {
      res.write(`data: ${JSON.stringify({ type: "book_recommend", books: foundBooks.slice(0, 5).map((b: any) => ({
        book_id: b.book_id, title: b.title, author: b.author || '',
        publisher: b.publisher || '', price: b.price, stock: b.stock,
        category: b.category || '', description: b.description || ''
      })) })}\n\n`);
      console.log(`[Chat] ✅ SDK路径已发送 ${Math.min(foundBooks.length, 5)} 本书籍推荐给前端`);
    }

    for await (const msg of stream) {
      if (msg.type === "system" && (msg as any).subtype === "init") {
        newSdkSessionId = (msg as any).session_id;
        if (newSdkSessionId && newSdkSessionId !== sdkSessionId) {
          db.updateSession(session.id, { sdk_session_id: newSdkSessionId });
        }
      } else if (msg.type === "assistant") {
        const content = msg.message.content;
        if (typeof content === "string") {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              fullResponse += block.text;
              res.write(`data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`);
            } else if (block.type === "tool_use") {
              currentToolId = block.id || uuidv4();
              const toolInput = (block as any).input || {};
              const toolCall = { id: currentToolId, name: block.name, input: toolInput, status: "running" };
              toolCalls.push(toolCall);
              res.write(`data: ${JSON.stringify({ type: "tool", id: toolCall.id, name: toolCall.name, input: toolCall.input, status: toolCall.status })}\n\n`);
            }
          }
        }
      } else if (msg.type === "tool_result") {
        const msgAny = msg as any;
        const toolId = msgAny.tool_use_id || currentToolId;
        const isError = msgAny.is_error || false;
        const content = msgAny.content;
        const tool = toolCalls.find(t => t.id === toolId) || toolCalls[toolCalls.length - 1];
        if (tool) {
          tool.status = isError ? "error" : "completed";
          tool.isError = isError;
          tool.result = typeof content === 'string' ? content : JSON.stringify(content);
          res.write(`data: ${JSON.stringify({ type: "tool_result", toolId: tool.id, content: tool.result, isError })}\n\n`);
        }
        currentToolId = null;
      } else if (msg.type === "result") {
        toolCalls.forEach(tool => {
          if (tool.status === "running") {
            tool.status = "completed";
            res.write(`data: ${JSON.stringify({ type: "tool_result", toolId: tool.id, content: tool.result || "已完成" })}\n\n`);
          }
        });
        res.write(`data: ${JSON.stringify({ type: "done", duration: msg.duration, cost: msg.cost })}\n\n`);
      }
    }

    // 检测响应中是否有转人工标记
    const needsTransfer = fullResponse.includes('[转人工]') || fullResponse.includes('【转人工】');
    if (needsTransfer && !session.transferred_to_human) {
      db.createTransferRecord({
        id: uuidv4(),
        session_id: session.id,
        reason: `AI识别需要转人工：${message.slice(0, 50)}`,
        status: 'pending',
        agent_name: null,
        created_at: new Date().toISOString(),
        resolved_at: null
      });
      // 通知前端触发转人工
      res.write(`data: ${JSON.stringify({ type: "transfer_to_human", sessionId: session.id })}\n\n`);
    }

    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: 'assistant',
      content: fullResponse,
      model: selectedModel,
      intent: detectedIntent,
      created_at: new Date().toISOString(),
      tool_calls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null
    });

    const messages = db.getMessagesBySession(session.id);
    if (messages.length <= 2) {
      db.updateSession(session.id, { title: message.slice(0, 30) + (message.length > 30 ? '...' : ''), model: selectedModel });
    }

    console.log(`[Chat] 请求完成 ✓ intent=${detectedIntent}`);
    res.end();
  } catch (error: any) {
    console.error(`[Chat] Error:`, error?.message);
    res.write(`data: ${JSON.stringify({ type: "error", message: error?.message || "处理请求时发生错误" })}\n\n`);
    res.end();
  }
});

// ============= 书籍 API（无需登录即可查询） =============

app.get("/api/books", (req, res) => {
  try {
    const { q, category } = req.query;
    let books;
    if (q) {
      books = bizDb.searchBooks(String(q));
    } else if (category) {
      books = bizDb.getBooksByCategory(String(category));
    } else {
      books = bizDb.getAllBooks();
    }
    res.json({ books });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "查询书籍失败" });
  }
});

app.get("/api/books/:bookId", (req, res) => {
  try {
    const book = bizDb.getBookById(req.params.bookId);
    if (!book) return res.status(404).json({ error: "书籍不存在" });
    res.json({ book });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "查询书籍失败" });
  }
});

// ============= 订单 & 退款 API（需登录） =============

app.get("/api/orders", requireAuth, (req: any, res) => {
  try {
    const orders = bizDb.getOrdersByUserId(req.user.userId);
    res.json({ orders });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "查询订单失败" });
  }
});

app.get("/api/orders/:orderNo", requireAuth, (req: any, res) => {
  try {
    const order = bizDb.getOrderById(req.params.orderNo, req.user.userId);
    if (!order) return res.status(404).json({ error: "订单不存在或无权限查看" });
    res.json({ order });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "查询订单失败" });
  }
});

app.post("/api/refunds", requireAuth, (req: any, res) => {
  try {
    const { order_no, reason } = req.body;
    if (!order_no) return res.status(400).json({ error: "订单号不能为空" });

    // 验证订单属于当前用户
    const order = bizDb.getOrderById(order_no, req.user.userId);
    if (!order) return res.status(404).json({ error: "订单不存在或无权限" });

    // 订单状态检查：paid / shipped / completed 均可退款（排除 pending / cancelled / refunding）
    const refundableStatuses = ['paid', 'shipped', 'completed'];
    if (!refundableStatuses.includes(order.status)) {
      return res.status(400).json({ error: `当前订单状态为「${bizDb.getOrderStatusText(order.status)}」，不支持退款` });
    }

    // 时间窗口检查：只允许 15 天内的订单退款
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    if (new Date(order.created_at) < fifteenDaysAgo) {
      return res.status(400).json({ error: "该订单已超过15天退款期限，无法申请退款" });
    }

    // 7天以后的订单需要填写退款原因
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isWithin7Days = new Date(order.created_at) >= sevenDaysAgo;
    if (!isWithin7Days && (!reason || !reason.trim())) {
      return res.status(400).json({ error: "超过7天的订单需要填写退款原因" });
    }

    const finalReason = reason?.trim() || '7天无理由退货';

    const refund = bizDb.createRefund({
      order_no,
      user_id: req.user.userId,
      reason: finalReason,
      refund_amount: order.total_amount,
    });
    res.json({ success: true, refund });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "提交退款申请失败" });
  }
});

app.get("/api/refunds", requireAuth, (req: any, res) => {
  try {
    const refunds = bizDb.getRefundsByUserId(req.user.userId);
    res.json({ refunds });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "查询退款记录失败" });
  }
});

// ============= 生产环境：serve 前端静态文件 =============
// 放在所有 API 路由之后，所有非 /api/ 请求返回前端 SPA 页面
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ============= 启动服务器 =============

// 初始化书籍 Embedding 向量（首次启动时逐本调用 DashScope API）
async function initBookEmbeddings() {
  if (!isDashScopeConfigured()) {
    console.log('[Embedding] DashScope 未配置，跳过 embedding 初始化');
    return;
  }

  const booksWithout = bizDb.getBooksWithoutEmbedding();
  if (booksWithout.length === 0) {
    console.log('[Embedding] ✅ 所有书籍 embedding 已就绪');
    return;
  }

  console.log(`[Embedding] ⏳ 正在为 ${booksWithout.length} 本书生成 embedding 向量...`);
  let done = 0;
  for (const book of booksWithout) {
    try {
      // 拼接书籍的语义文本：标题 + 作者 + 分类 + 描述
      const text = [book.title, book.author, book.publisher, book.category, book.description]
        .filter(Boolean).join(' ');
      const emb = await getEmbedding(text);
      bizDb.saveBookEmbedding(book.book_id, emb);
      done++;
      // 批量打印进度
      if (done % 5 === 0 || done === booksWithout.length) {
        console.log(`[Embedding] 进度: ${done}/${booksWithout.length}`);
      }
      // 避免 API 限流
      await new Promise(r => setTimeout(r, 200));
    } catch (err: any) {
      console.error(`[Embedding] ${book.title} 生成失败:`, err.message);
    }
  }
  console.log(`[Embedding] ✅ 完成：${done}/${booksWithout.length} 本书已生成 embedding`);
}

app.listen(PORT, async () => {
  // 后台异步初始化 embedding（不阻塞服务启动）
  initBookEmbeddings().catch(err => console.error('[Embedding] 初始化异常:', err));

  console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║     ◉ 智能客服 Agent 服务已启动                      ║
║                                                    ║
║     访问地址: http://localhost:${PORT}                 ║
║     数据库:    SQLite (data/chat.db)               ║
║                                                    ║
╚════════════════════════════════════════════════════╝
  `);
});
