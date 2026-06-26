var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import 'dotenv/config';
import express from "express";
import { query, unstable_v2_createSession, unstable_v2_authenticate } from "@tencent-ai/agent-sdk";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import * as db from "./db.js";
import * as bizDb from "./db-business.js";
import { login, register, authenticateRequest } from "./auth.js";
import { isDashScopeConfigured, streamChatCompletion, DASHSCOPE_MODELS, getEmbedding } from "./dashscope.js";
var execAsync = promisify(exec);
var pendingPermissions = new Map();
var PERMISSION_TIMEOUT = 5 * 60 * 1000;
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS')
        return res.sendStatus(200);
    next();
});
// Cookie 解析中间件（无需额外依赖）
app.use(function (req, res, next) {
    var cookieHeader = req.headers.cookie || '';
    var cookies = {};
    if (cookieHeader) {
        for (var _i = 0, _a = cookieHeader.split(';'); _i < _a.length; _i++) {
            var pair = _a[_i];
            var _b = pair.trim().split('='), key = _b[0], vals = _b.slice(1);
            cookies[key] = decodeURIComponent(vals.join('='));
        }
    }
    req.cookies = cookies;
    next();
});
// 认证中间件（可选，用于需要登录的接口）
function requireAuth(req, res, next) {
    var auth = authenticateRequest(req);
    if (!auth) {
        return res.status(401).json({ error: '未登录或登录已过期，请重新登录' });
    }
    req.user = auth; // { userId, username }
    next();
}
var cachedModels = [];
var defaultModel = "qwen3.6-plus";
// ============= 认证 API =============
/**
 * POST /api/auth/register
 * 用户注册
 */
app.post("/api/auth/register", function (req, res) {
    var _a = req.body, username = _a.username, password = _a.password, email = _a.email, phone = _a.phone;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
    }
    var result = register({ username: username, password: password, email: email, phone: phone });
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
app.post("/api/auth/login", function (req, res) {
    var _a = req.body, username = _a.username, password = _a.password;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
    }
    var result = login(username, password);
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
app.post("/api/auth/logout", function (req, res) {
    res.clearCookie('token');
    res.json({ success: true });
});
/**
 * GET /api/auth/me
 * 获取当前登录用户信息（供前端 checkAuth 调用）
 */
app.get("/api/auth/me", function (req, res) {
    var auth = authenticateRequest(req);
    if (!auth) {
        return res.json({ authenticated: false });
    }
    var user = bizDb.findUserByUserId(auth.userId);
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
app.get("/api/health", function (req, res) {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
app.get("/api/check-login", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var response, apiKey, authToken, internetEnv, baseUrl, needsLogin_1, result, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                response = { isLoggedIn: false, envConfigured: false, cliConfigured: false, dashscopeConfigured: isDashScopeConfigured(), envVars: {} };
                apiKey = process.env.CODEBUDDY_API_KEY;
                authToken = process.env.CODEBUDDY_AUTH_TOKEN;
                internetEnv = process.env.CODEBUDDY_INTERNET_ENVIRONMENT;
                baseUrl = process.env.CODEBUDDY_BASE_URL;
                if (apiKey || authToken) {
                    response.envConfigured = true;
                    if (apiKey) {
                        response.envVars.apiKey = apiKey.slice(0, 8) + '****' + apiKey.slice(-4);
                        response.apiKey = response.envVars.apiKey;
                    }
                    if (authToken)
                        response.envVars.authToken = authToken.slice(0, 8) + '****' + authToken.slice(-4);
                    if (internetEnv)
                        response.envVars.internetEnv = internetEnv;
                    if (baseUrl)
                        response.envVars.baseUrl = baseUrl;
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                needsLogin_1 = false;
                return [4 /*yield*/, unstable_v2_authenticate({
                        environment: 'external',
                        onAuthUrl: function (authState) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                needsLogin_1 = true;
                                response.error = '未登录，请先登录 CodeBuddy CLI';
                                return [2 /*return*/];
                            });
                        }); }
                    })];
            case 2:
                result = _a.sent();
                if (!needsLogin_1 && (result === null || result === void 0 ? void 0 : result.userinfo)) {
                    response.isLoggedIn = true;
                    response.cliConfigured = true;
                    response.method = response.envConfigured ? 'env' : 'cli';
                }
                else if (!needsLogin_1) {
                    response.isLoggedIn = true;
                    response.cliConfigured = true;
                    response.method = response.envConfigured ? 'env' : 'cli';
                }
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                if (response.envConfigured) {
                    response.isLoggedIn = true;
                    response.method = 'env';
                }
                else {
                    response.error = (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || String(error_1);
                    response.method = 'none';
                }
                return [3 /*break*/, 4];
            case 4:
                res.json(response);
                return [2 /*return*/];
        }
    });
}); });
app.post("/api/save-env-config", function (req, res) {
    var _a = req.body, apiKey = _a.apiKey, authToken = _a.authToken, internetEnv = _a.internetEnv, baseUrl = _a.baseUrl;
    if (!apiKey && !authToken)
        return res.status(400).json({ error: '请至少配置 API Key 或 Auth Token' });
    var configuredVars = [];
    if (apiKey) {
        process.env.CODEBUDDY_API_KEY = apiKey;
        configuredVars.push('CODEBUDDY_API_KEY');
    }
    if (authToken) {
        process.env.CODEBUDDY_AUTH_TOKEN = authToken;
        configuredVars.push('CODEBUDDY_AUTH_TOKEN');
    }
    if (internetEnv) {
        process.env.CODEBUDDY_INTERNET_ENVIRONMENT = internetEnv;
        configuredVars.push('CODEBUDDY_INTERNET_ENVIRONMENT');
    }
    if (baseUrl) {
        process.env.CODEBUDDY_BASE_URL = baseUrl;
        configuredVars.push('CODEBUDDY_BASE_URL');
    }
    cachedModels = [];
    res.json({ success: true, message: "\u5DF2\u8BBE\u7F6E: ".concat(configuredVars.join(', ')), note: '环境变量仅在当前服务器进程有效' });
});
app.get("/api/models", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var allModels, session, models, sdkError_1, effectiveDefault, error_2, fallback;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 7, , 8]);
                allModels = [];
                // 1. DashScope 模型（始终列出，但标注是否可用）
                if (isDashScopeConfigured()) {
                    allModels.push.apply(allModels, DASHSCOPE_MODELS);
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 5, , 6]);
                if (!(cachedModels.length === 0)) return [3 /*break*/, 4];
                return [4 /*yield*/, unstable_v2_createSession({ cwd: process.cwd() })];
            case 2:
                session = _a.sent();
                return [4 /*yield*/, session.getAvailableModels()];
            case 3:
                models = _a.sent();
                if (models && Array.isArray(models))
                    cachedModels = models;
                _a.label = 4;
            case 4:
                if (cachedModels.length > 0) {
                    allModels.push.apply(allModels, cachedModels);
                }
                return [3 /*break*/, 6];
            case 5:
                sdkError_1 = _a.sent();
                console.warn("[Models] SDK 模型列表获取失败:", sdkError_1 === null || sdkError_1 === void 0 ? void 0 : sdkError_1.message);
                return [3 /*break*/, 6];
            case 6:
                // 如果都没有，至少返回默认模型
                if (allModels.length === 0) {
                    allModels = [{ modelId: "claude-sonnet-4", name: "Claude Sonnet 4" }];
                }
                effectiveDefault = isDashScopeConfigured()
                    ? "qwen3.6-plus"
                    : defaultModel;
                res.json({ models: allModels, defaultModel: effectiveDefault, dashscopeConfigured: isDashScopeConfigured() });
                return [3 /*break*/, 8];
            case 7:
                error_2 = _a.sent();
                fallback = isDashScopeConfigured() ? DASHSCOPE_MODELS : [{ modelId: "claude-sonnet-4", name: "Claude Sonnet 4" }];
                res.json({ models: fallback, defaultModel: isDashScopeConfigured() ? "qwen-plus" : defaultModel, error: error_2 === null || error_2 === void 0 ? void 0 : error_2.message });
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/];
        }
    });
}); });
// ============= 会话 API =============
app.get("/api/sessions", function (req, res) {
    try {
        var sessions = db.getAllSessions();
        var sessionsWithMessages = sessions.map(function (session) { return (__assign(__assign({}, session), { messageCount: db.getMessagesBySession(session.id).length })); });
        res.json({ sessions: sessionsWithMessages });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "获取会话失败" });
    }
});
app.get("/api/sessions/:sessionId", function (req, res) {
    try {
        var sessionId = req.params.sessionId;
        var session = db.getSession(sessionId);
        if (!session)
            return res.status(404).json({ error: "会话不存在" });
        var messages = db.getMessagesBySession(sessionId).map(function (msg) { return (__assign(__assign({}, msg), { tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null })); });
        res.json({ session: session, messages: messages });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "获取会话失败" });
    }
});
app.post("/api/sessions", function (req, res) {
    try {
        var _a = req.body, _b = _a.model, model = _b === void 0 ? defaultModel : _b, _c = _a.title, title = _c === void 0 ? "新对话" : _c;
        var now = new Date().toISOString();
        var session = db.createSession({ id: uuidv4(), title: title, model: model, created_at: now, updated_at: now });
        res.json({ session: session });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "创建会话失败" });
    }
});
app.patch("/api/sessions/:sessionId", function (req, res) {
    try {
        var sessionId = req.params.sessionId;
        var _a = req.body, title = _a.title, model = _a.model, intent = _a.intent, status_1 = _a.status;
        var success = db.updateSession(sessionId, { title: title, model: model, intent: intent, status: status_1 });
        if (!success)
            return res.status(404).json({ error: "会话不存在" });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "更新会话失败" });
    }
});
app.delete("/api/sessions/:sessionId", function (req, res) {
    try {
        var sessionId = req.params.sessionId;
        var success = db.deleteSession(sessionId);
        if (!success)
            return res.status(404).json({ error: "会话不存在" });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "删除会话失败" });
    }
});
// ============= FAQ API =============
app.get("/api/faq", function (req, res) {
    try {
        var q = req.query.q;
        var faqs = q ? db.searchFaq(String(q)) : db.getAllFaqs();
        res.json({ faqs: faqs });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "获取FAQ失败" });
    }
});
app.post("/api/faq", function (req, res) {
    try {
        var _a = req.body, category = _a.category, question = _a.question, answer = _a.answer, tags = _a.tags;
        if (!category || !question || !answer)
            return res.status(400).json({ error: '缺少必填字段' });
        var now = new Date().toISOString();
        var faq = db.createFaq({ id: uuidv4(), category: category, question: question, answer: answer, tags: tags || null, usage_count: 0, created_at: now, updated_at: now });
        res.json({ faq: faq });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "创建FAQ失败" });
    }
});
app.put("/api/faq/:faqId", function (req, res) {
    try {
        var faqId = req.params.faqId;
        var _a = req.body, category = _a.category, question = _a.question, answer = _a.answer, tags = _a.tags;
        var success = db.updateFaq(faqId, { category: category, question: question, answer: answer, tags: tags });
        if (!success)
            return res.status(404).json({ error: "FAQ不存在" });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "更新FAQ失败" });
    }
});
app.delete("/api/faq/:faqId", function (req, res) {
    try {
        var faqId = req.params.faqId;
        var success = db.deleteFaq(faqId);
        if (!success)
            return res.status(404).json({ error: "FAQ不存在" });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "删除FAQ失败" });
    }
});
// ============= 满意度 API =============
app.post("/api/satisfaction", function (req, res) {
    try {
        var _a = req.body, sessionId = _a.sessionId, rating = _a.rating, comment = _a.comment;
        if (!sessionId || !rating)
            return res.status(400).json({ error: '缺少必填字段' });
        if (rating < 1 || rating > 5)
            return res.status(400).json({ error: '评分必须在1-5之间' });
        var record = db.createSatisfactionRating({ id: uuidv4(), session_id: sessionId, rating: rating, comment: comment || null, created_at: new Date().toISOString() });
        res.json({ record: record });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "提交满意度失败" });
    }
});
app.get("/api/satisfaction/stats", function (req, res) {
    try {
        var stats = db.getSatisfactionStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "获取统计失败" });
    }
});
// ============= 转人工 API =============
app.post("/api/transfer", function (req, res) {
    try {
        var _a = req.body, sessionId = _a.sessionId, reason = _a.reason;
        if (!sessionId)
            return res.status(400).json({ error: '缺少会话ID' });
        var record = db.createTransferRecord({
            id: uuidv4(),
            session_id: sessionId,
            reason: reason || '用户请求转人工',
            status: 'pending',
            agent_name: null,
            created_at: new Date().toISOString(),
            resolved_at: null
        });
        res.json({ record: record, message: '已为您转接人工客服，预计等待时间3-5分钟' });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "转人工失败" });
    }
});
app.get("/api/transfer", function (req, res) {
    try {
        var records = db.getTransferRecords();
        res.json({ records: records });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "获取转人工记录失败" });
    }
});
// ============= 管理后台统计 API =============
app.get("/api/admin/dashboard", function (req, res) {
    try {
        var stats = db.getDashboardStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "获取统计数据失败" });
    }
});
app.get("/api/admin/sessions", function (req, res) {
    try {
        var _a = req.query, intent_1 = _a.intent, status_2 = _a.status, _b = _a.page, page = _b === void 0 ? 1 : _b, _c = _a.pageSize, pageSize = _c === void 0 ? 20 : _c;
        var sessions = db.getAllSessions();
        var filtered = sessions;
        if (intent_1)
            filtered = filtered.filter(function (s) { return s.intent === intent_1; });
        if (status_2)
            filtered = filtered.filter(function (s) { return s.status === status_2; });
        var total = filtered.length;
        var pageNum = Number(page);
        var pageSizeNum = Number(pageSize);
        var paged = filtered.slice((pageNum - 1) * pageSizeNum, pageNum * pageSizeNum);
        var result = paged.map(function (s) { return (__assign(__assign({}, s), { messageCount: db.getMessagesBySession(s.id).length })); });
        res.json({ sessions: result, total: total, page: pageNum, pageSize: pageSizeNum });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "获取会话列表失败" });
    }
});
// ============= 调试 API（验证 FAQ 注入） =============
app.post("/api/debug-prompt", function (req, res) {
    var message = req.body.message;
    if (!message)
        return res.status(400).json({ error: "消息不能为空" });
    // 意图识别
    var detectIntent = function (text) {
        var t = text.toLowerCase();
        if (/(退款|退货|退钱|不想要|取消订单|申请退)/.test(t))
            return 'refund';
        if (/(订单|物流|发货|快递|到哪|配送|查询)/.test(t))
            return 'order';
        if (/(无法使用|报错|bug|不能用|崩溃|故障|错误|技术)/.test(t))
            return 'tech_support';
        if (/(转人工|人工客服|真人|转接)/.test(t))
            return 'transfer_human';
        return 'general';
    };
    var detectedIntent = detectIntent(message);
    // 关键词提取
    var BUSINESS_KEYWORDS = [
        '退款', '退货', '退钱', '不想要', '取消订单', '申请退',
        '订单', '物流', '发货', '快递', '到哪', '配送', '查询', '到货',
        '无法使用', '报错', 'bug', '不能用', '崩溃', '故障', '问题', '技术',
        '转人工', '人工客服', '真人', '转接',
        '支付', '付款', '发票', '税票', '报销',
        '账户', '密码', '登录', '注册', '被盗', '实名',
        '质量', '售后', '换货', '维修', '保修',
        '申请', '操作', '怎么', '如何', '多久', '为什么',
    ];
    function extractSearchKeywords(text) {
        var t = text.toLowerCase();
        var matched = [];
        for (var _i = 0, BUSINESS_KEYWORDS_1 = BUSINESS_KEYWORDS; _i < BUSINESS_KEYWORDS_1.length; _i++) {
            var kw = BUSINESS_KEYWORDS_1[_i];
            if (t.includes(kw.toLowerCase()))
                matched.push(kw);
        }
        if (matched.length === 0) {
            var clean = t.replace(/[，。？！、；：""''（）【】《》，。？！\s,.\?!;:'"()\[\]{}<>]+/g, ' ');
            var words = clean.split(/\s+/).filter(function (w) { return w.length >= 2; });
            matched.push.apply(matched, words.slice(0, 5));
        }
        return __spreadArray([], new Set(matched), true).slice(0, 8);
    }
    // FAQ 搜索
    var searchKeywords = extractSearchKeywords(message);
    var faqResults = [];
    var seenIds = new Set();
    for (var _i = 0, searchKeywords_1 = searchKeywords; _i < searchKeywords_1.length; _i++) {
        var keyword = searchKeywords_1[_i];
        if (keyword.length < 2)
            continue;
        try {
            var results = db.searchFaq(keyword);
            for (var _a = 0, results_1 = results; _a < results_1.length; _a++) {
                var faq = results_1[_a];
                if (!seenIds.has(faq.id)) {
                    seenIds.add(faq.id);
                    faqResults.push(faq);
                }
            }
        }
        catch (_b) { }
    }
    if (faqResults.length === 0) {
        faqResults = db.searchFaq(message) || [];
    }
    // 构建完整 prompt（和 /api/chat 完全一致的逻辑）
    var faqContext = '';
    if (faqResults.length > 0) {
        faqContext = '\n\n## 相关 FAQ 知识库（请务必优先参考以下内容回答用户，直接使用其中的具体信息）\n';
        faqResults.forEach(function (faq, idx) {
            faqContext += "\n### [FAQ".concat(idx + 1, "] (").concat(faq.category, ")\n**\u95EE\u9898**: ").concat(faq.question, "\n**\u7B54\u6848**: ").concat(faq.answer, "\n");
        });
        faqContext += '\n---\n**重要提示**: 请直接使用以上 FAQ 中的具体信息回答用户，不要用你自己的通用知识替代。如果 FAQ 内容不足以完全回答，可以补充，但必须以 FAQ 内容为主。\n';
    }
    var fullPrompt = "\u4F60\u662F\"\u5C0F\u667A\"\uFF0C\u672C\u5E73\u53F0\u7684\u667A\u80FD\u5BA2\u670D\u52A9\u624B\u3002\n\n## \u8EAB\u4EFD\u4FE1\u606F\uFF08\u5FC5\u987B\u9075\u5B88\uFF09\n- \u4F60\u7684\u540D\u5B57\uFF1A\u5C0F\u667A\n- \u5F53\u7528\u6237\u95EE\"\u4F60\u662F\u8C01\"\u3001\"\u600E\u4E48\u79F0\u547C\u4F60\"\u3001\"\u4F60\u662F\u673A\u5668\u4EBA\u5417\"\u3001\"\u4F60\u662FAI\u5417\"\u65F6\uFF1A\n  \u4F60\u5FC5\u987B\u56DE\u7B54\uFF1A\"\u6211\u662F\u5C0F\u667A\uFF0C\u662F\u672C\u5E73\u53F0\u7684\u667A\u80FD\u5BA2\u670D\u52A9\u624B\uFF0C\u5F88\u9AD8\u5174\u4E3A\u60A8\u670D\u52A1\uFF01\"\n- \u7EDD\u5BF9\u7981\u6B62\u8BF4\"\u6211\u662F\u4E00\u4E2AAI\u52A9\u624B\"\u3001\"\u6211\u662F\u4EBA\u5DE5\u667A\u80FD\"\u3001\"\u6211\u662F\u8BED\u8A00\u6A21\u578B\"\u7B49\u8868\u8FF0\n- \u4F60\u7684\u804C\u8D23\uFF1A\u5904\u7406\u552E\u540E\u54A8\u8BE2\u3001\u8BA2\u5355\u67E5\u8BE2\u3001\u9000\u6B3E\u7533\u8BF7\u3001\u6280\u672F\u652F\u6301\u7B49\u5BA2\u6237\u670D\u52A1\u5DE5\u4F5C\n\n## \u6838\u5FC3\u80FD\u529B\n...\uFF08\u7701\u7565\uFF09\n\n## \u5F53\u524D\u7528\u6237\u610F\u56FE\u7C7B\u578B\n".concat(detectedIntent).concat(faqContext);
    res.json({
        inputMessage: message,
        detectedIntent: detectedIntent,
        searchKeywords: searchKeywords,
        faqCount: faqResults.length,
        faqResults: faqResults.map(function (f) { return ({ id: f.id, category: f.category, question: f.question, answer: f.answer.slice(0, 50) + '...' }); }),
        promptLength: fullPrompt.length,
        containsFAQ: fullPrompt.includes('FAQ'),
        containsXiaozhi: fullPrompt.includes('小智'),
        fullPrompt: fullPrompt,
    });
});
// ============= 聊天 API =============
app.post("/api/permission-response", function (req, res) {
    var _a = req.body, requestId = _a.requestId, behavior = _a.behavior, message = _a.message;
    var pending = pendingPermissions.get(requestId);
    if (!pending)
        return res.status(404).json({ error: "权限请求不存在或已超时" });
    pendingPermissions.delete(requestId);
    if (behavior === 'allow') {
        pending.resolve({ behavior: 'allow', updatedInput: pending.input });
    }
    else {
        pending.resolve({ behavior: 'deny', message: message || '用户拒绝了此操作' });
    }
    res.json({ success: true });
});
app.post("/api/chat", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    function extractSearchKeywords(text) {
        var t = text.toLowerCase();
        var matched = [];
        // 1. 白名单关键词匹配（优先）
        for (var _i = 0, BUSINESS_KEYWORDS_2 = BUSINESS_KEYWORDS; _i < BUSINESS_KEYWORDS_2.length; _i++) {
            var kw = BUSINESS_KEYWORDS_2[_i];
            if (t.includes(kw.toLowerCase())) {
                matched.push(kw);
            }
        }
        // 2. 如果没有匹配到白名单，提取连续2字以上非空串作为兜底
        if (matched.length === 0) {
            var clean = t.replace(/[，。？！、；：""''（）【】《》，。？！\s,.\?!;:'"()\[\]{}<>]+/g, ' ');
            var words = clean.split(/\s+/).filter(function (w) { return w.length >= 2; });
            matched.push.apply(matched, words.slice(0, 5));
        }
        return __spreadArray([], new Set(matched), true).slice(0, 8);
    }
    var _a, sessionId, message, model, systemPrompt, cwd, permissionMode, detectIntent, detectedIntent, session, now, selectedModel, sdkSessionId, userMessageId, assistantMessageId, BUSINESS_KEYWORDS, faqContext, searchKeywords, faqResults, seenIds, _i, searchKeywords_2, keyword, results, _b, results_2, faq, businessContext, foundBooks, bookKeywords, isBookQuery, searchQuery, m, queryEmbedding, embErr_1, books, sources, orderKeywords, isOrderQuery, auth, orders, bizError_1, kefuSystemPrompt, workingDir, dashscopeModelIds, isDashScopeModel, auth, recentOrders, refundOrders, startTime_1, fullResponse_1, historyMessages, dashscopeMessages, _c, historyMessages_1, msg, canUseTool, businessTools, stream, fullResponse, toolCalls, newSdkSessionId, currentToolId, auth, recentOrders, refundOrders, _loop_1, _d, stream_1, stream_1_1, e_1_1, needsTransfer, messages, error_3;
    var _e, e_1, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                _a = req.body, sessionId = _a.sessionId, message = _a.message, model = _a.model, systemPrompt = _a.systemPrompt, cwd = _a.cwd, permissionMode = _a.permissionMode;
                console.log("\n[Chat] ========== \u65B0\u8BF7\u6C42 ==========");
                console.log("[Chat] SessionId: ".concat(sessionId, ", Message: ").concat(message === null || message === void 0 ? void 0 : message.slice(0, 80)));
                if (!message)
                    return [2 /*return*/, res.status(400).json({ error: "消息不能为空" })];
                detectIntent = function (text) {
                    var t = text.toLowerCase();
                    if (/(退款|退货|退钱|不想要|取消订单|申请退)/.test(t))
                        return 'refund';
                    if (/(订单|物流|发货|快递|到哪|配送|查询)/.test(t))
                        return 'order';
                    if (/(无法使用|报错|bug|不能用|崩溃|故障|错误|技术)/.test(t))
                        return 'tech_support';
                    if (/(转人工|人工客服|真人|转接)/.test(t))
                        return 'transfer_human';
                    return 'general';
                };
                detectedIntent = detectIntent(message);
                session = sessionId ? db.getSession(sessionId) : null;
                now = new Date().toISOString();
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
                }
                else if (session.intent === 'general' && detectedIntent !== 'general') {
                    // 更新意图
                    db.updateSession(session.id, { intent: detectedIntent });
                    session = db.getSession(session.id);
                }
                selectedModel = model || session.model;
                sdkSessionId = session.sdk_session_id;
                userMessageId = uuidv4();
                assistantMessageId = uuidv4();
                try {
                    db.createMessage({ id: userMessageId, session_id: session.id, role: 'user', content: message, model: null, intent: detectedIntent, created_at: now, tool_calls: null });
                }
                catch (dbError) {
                    return [2 /*return*/, res.status(500).json({ error: "保存消息失败", detail: dbError === null || dbError === void 0 ? void 0 : dbError.message })];
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
                BUSINESS_KEYWORDS = [
                    '退款', '退货', '退钱', '不想要', '取消订单', '申请退',
                    '订单', '物流', '发货', '快递', '到哪', '配送', '查询', '到货',
                    '无法使用', '报错', 'bug', '不能用', '崩溃', '故障', '问题', '技术',
                    '转人工', '人工客服', '真人', '转接',
                    '支付', '付款', '发票', '税票', '报销',
                    '账户', '密码', '登录', '注册', '被盗', '实名',
                    '质量', '售后', '换货', '维修', '保修',
                    '申请', '操作', '怎么', '如何', '多久', '为什么',
                ];
                faqContext = '';
                try {
                    searchKeywords = extractSearchKeywords(message);
                    console.log("[Chat] FAQ \u641C\u7D22\u5173\u952E\u8BCD: [".concat(searchKeywords.join(', '), "]"));
                    faqResults = [];
                    seenIds = new Set();
                    // 用每个关键词分别搜索，合并去重
                    for (_i = 0, searchKeywords_2 = searchKeywords; _i < searchKeywords_2.length; _i++) {
                        keyword = searchKeywords_2[_i];
                        if (keyword.length < 2)
                            continue; // 跳过过短的词
                        try {
                            results = db.searchFaq(keyword);
                            for (_b = 0, results_2 = results; _b < results_2.length; _b++) {
                                faq = results_2[_b];
                                if (!seenIds.has(faq.id)) {
                                    seenIds.add(faq.id);
                                    faqResults.push(faq);
                                }
                            }
                        }
                        catch (_j) { }
                    }
                    // 如果关键词搜索没结果，用原始消息兜底搜索一次
                    if (faqResults.length === 0) {
                        faqResults = db.searchFaq(message) || [];
                    }
                    if (faqResults.length > 0) {
                        faqContext = '\n\n## 相关 FAQ 知识库（请务必优先参考以下内容回答用户，直接使用其中的具体信息）\n';
                        faqResults.forEach(function (faq, idx) {
                            faqContext += "\n### [FAQ".concat(idx + 1, "] (").concat(faq.category, ")\n**\u95EE\u9898**: ").concat(faq.question, "\n**\u7B54\u6848**: ").concat(faq.answer, "\n");
                            // 增加使用计数
                            try {
                                db.incrementFaqUsage(faq.id);
                            }
                            catch (_a) { }
                        });
                        faqContext += '\n---\n**重要提示**: 请直接使用以上 FAQ 中的具体信息回答用户，不要用你自己的通用知识替代。如果 FAQ 内容不足以完全回答，可以补充，但必须以 FAQ 内容为主。\n';
                        console.log("[Chat] \u2705 \u5DF2\u6CE8\u5165 ".concat(faqResults.length, " \u6761 FAQ \u5230 prompt\uFF0C\u5173\u952E\u8BCD: [").concat(searchKeywords.join(', '), "]"));
                    }
                    else {
                        console.log("[Chat] \u26A0\uFE0F \u672A\u627E\u5230\u76F8\u5173 FAQ\uFF0C\u5173\u952E\u8BCD: [".concat(searchKeywords.join(', '), "]"));
                    }
                }
                catch (faqError) {
                    console.error('[Chat] FAQ 搜索异常:', faqError === null || faqError === void 0 ? void 0 : faqError.message);
                }
                businessContext = '';
                foundBooks = [];
                _h.label = 1;
            case 1:
                _h.trys.push([1, 7, , 8]);
                bookKeywords = ['书', '图书', '书籍', '小说', '作者', '推荐', '找'];
                isBookQuery = bookKeywords.some(function (kw) { return message.toLowerCase().includes(kw); }) ||
                    /《[^》]+》/.test(message);
                if (!isBookQuery) return [3 /*break*/, 6];
                searchQuery = message;
                m = message.match(/《([^》]+)》/);
                if (m)
                    searchQuery = m[1];
                queryEmbedding = void 0;
                if (!isDashScopeConfigured()) return [3 /*break*/, 5];
                _h.label = 2;
            case 2:
                _h.trys.push([2, 4, , 5]);
                return [4 /*yield*/, getEmbedding(searchQuery)];
            case 3:
                queryEmbedding = _h.sent();
                console.log('[Chat] ✅ 已生成 query embedding，使用混合检索');
                return [3 /*break*/, 5];
            case 4:
                embErr_1 = _h.sent();
                console.warn('[Chat] ⚠️ Embedding 生成失败，退化为 FTS5 纯文本检索:', embErr_1.message);
                return [3 /*break*/, 5];
            case 5:
                books = bizDb.searchBooksHybrid(searchQuery, queryEmbedding, 5);
                foundBooks = books; // 存储供后续 SSE book_recommend 事件发送
                if (books.length > 0) {
                    sources = books.map(function (b) { return b._source; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
                    businessContext += '\n\n## 图书搜索结果（请参考以下数据回答用户）\n';
                    books.forEach(function (b, i) {
                        var tags = [];
                        if (b._source === 'both')
                            tags.push('🔗精准匹配');
                        else if (b._source === 'embedding')
                            tags.push('🧠语义匹配');
                        else
                            tags.push('📖关键词匹配');
                        businessContext += "".concat(i + 1, ". \u300A").concat(b.title, "\u300B- ").concat(b.author || '未知', " | \u51FA\u7248\u793E\uFF1A").concat(b.publisher || '未知', " | \u4EF7\u683C\uFF1A\u00A5").concat(b.price, " | \u5E93\u5B58\uFF1A").concat(b.stock, " | \u5206\u7C7B\uFF1A").concat(b.category || '未分类', " ").concat(tags.join(' '), "\n");
                    });
                    businessContext += '\n---\n**提示**：请直接引用以上图书信息回答用户，告知书名、作者、价格、库存状态。\n';
                    console.log("[Chat] \u2705 \u5DF2\u6CE8\u5165 ".concat(books.length, " \u6761\u56FE\u4E66\u641C\u7D22\u7ED3\u679C\uFF08\u6765\u6E90: ").concat(sources.join(', '), "\uFF09"));
                }
                _h.label = 6;
            case 6:
                orderKeywords = ['订单', '物流', '发货', '快递', '到哪', '配送', '买', '购买记录', '退款', '退货', '退钱', '不想要'];
                isOrderQuery = orderKeywords.some(function (kw) { return message.toLowerCase().includes(kw); });
                if (isOrderQuery) {
                    auth = authenticateRequest(req);
                    if (auth) {
                        orders = detectedIntent === 'refund'
                            ? bizDb.getRecentOrdersByUserId(auth.userId, 15)
                            : bizDb.getOrdersByUserId(auth.userId);
                        if (orders.length > 0) {
                            businessContext += detectedIntent === 'refund'
                                ? '\n\n## 用户15天内可退款订单（请参考以下数据引导用户退款）\n'
                                : '\n\n## 当前用户订单列表（请参考以下数据回答用户）\n';
                            orders.forEach(function (o) {
                                var statusText = bizDb.getOrderStatusText(o.status);
                                businessContext += "- \u8BA2\u5355\u53F7\uFF1A".concat(o.order_no, " | \u72B6\u6001\uFF1A").concat(statusText, " | \u603B\u91D1\u989D\uFF1A\u00A5").concat(o.total_amount, " | \u4E0B\u5355\u65F6\u95F4\uFF1A").concat(o.created_at.slice(0, 10));
                                if (detectedIntent === 'refund') {
                                    businessContext += " | ".concat(o.is_within_7days ? '⭐7天内（无需填理由）' : '⏱7-15天（需填退款原因）');
                                }
                                businessContext += '\n';
                                if (o.items) {
                                    o.items.forEach(function (item) {
                                        var _a, _b;
                                        businessContext += "  \u5546\u54C1\uFF1A\u300A".concat(((_a = item.book) === null || _a === void 0 ? void 0 : _a.title) || item.book_id, "\u300B\uFF08").concat(((_b = item.book) === null || _b === void 0 ? void 0 : _b.author) || '', "\uFF09 x").concat(item.quantity, "\uFF08\u5355\u4EF7 \u00A5").concat(item.unit_price, "\uFF09\n");
                                    });
                                }
                            });
                            businessContext += detectedIntent === 'refund'
                                ? "\n---\n**\u63D0\u793A**\uFF1A\u7528\u6237\u5DF2\u767B\u5F55\uFF08\u7528\u6237\u540D\uFF1A".concat(auth.username, "\uFF09\uFF0C\u4EE5\u4E0A\u662F\u7528\u623715\u5929\u5185\u53EF\u9000\u6B3E\u7684\u8BA2\u5355\u3002\u9000\u6B3E\u653F\u7B56\uFF1A15\u5929\u5185\u53EF\u7533\u8BF7\u9000\u6B3E\uFF0C7\u5929\u5185\u65E0\u9700\u586B\u5199\u539F\u56E0\uFF0C7-15\u5929\u9700\u586B\u5199\u9000\u6B3E\u539F\u56E0\u3002\u8BF7\u5F15\u5BFC\u7528\u6237\u9009\u62E9\u8BA2\u5355\u3002\n")
                                : "\n---\n**\u63D0\u793A**\uFF1A\u7528\u6237\u5DF2\u767B\u5F55\uFF08\u7528\u6237\u540D\uFF1A".concat(auth.username, "\uFF09\uFF0C\u8BF7\u76F4\u63A5\u5F15\u7528\u4EE5\u4E0A\u8BA2\u5355\u6570\u636E\u56DE\u7B54\u3002\u5982\u9700\u9000\u6B3E\uFF0C\u8BF7\u5F15\u5BFC\u7528\u6237\u544A\u77E5\u8BA2\u5355\u53F7\u3002\n");
                            console.log("[Chat] \u2705 \u5DF2\u6CE8\u5165 ".concat(orders.length, " \u6761\u8BA2\u5355\u6570\u636E\uFF0C\u7528\u6237\uFF1A").concat(auth.username));
                        }
                    }
                    else {
                        businessContext += '\n\n**注意**：用户询问订单但未登录，请先引导用户登录（登录地址：/login），登录后可查询订单和申请退款。\n';
                    }
                }
                return [3 /*break*/, 8];
            case 7:
                bizError_1 = _h.sent();
                console.error('[Chat] 业务数据注入异常:', bizError_1 === null || bizError_1 === void 0 ? void 0 : bizError_1.message);
                return [3 /*break*/, 8];
            case 8:
                kefuSystemPrompt = "\u4F60\u662F\"\u5C0F\u667A\"\uFF0C\u672C\u5E73\u53F0\u7684\u667A\u80FD\u5BA2\u670D\u52A9\u624B\u3002\n\n## \u8EAB\u4EFD\u4FE1\u606F\uFF08\u5FC5\u987B\u9075\u5B88\uFF09\n- \u4F60\u7684\u540D\u5B57\uFF1A\u5C0F\u667A\n- \u5F53\u7528\u6237\u95EE\"\u4F60\u662F\u8C01\"\u3001\"\u600E\u4E48\u79F0\u547C\u4F60\"\u3001\"\u4F60\u662F\u673A\u5668\u4EBA\u5417\"\u3001\"\u4F60\u662FAI\u5417\"\u65F6\uFF1A\n  \u4F60\u5FC5\u987B\u56DE\u7B54\uFF1A\"\u6211\u662F\u5C0F\u667A\uFF0C\u662F\u672C\u5E73\u53F0\u7684\u667A\u80FD\u5BA2\u670D\u52A9\u624B\uFF0C\u5F88\u9AD8\u5174\u4E3A\u60A8\u670D\u52A1\uFF01\"\n- \u7EDD\u5BF9\u7981\u6B62\u8BF4\"\u6211\u662F\u4E00\u4E2AAI\u52A9\u624B\"\u3001\"\u6211\u662F\u4EBA\u5DE5\u667A\u80FD\"\u3001\"\u6211\u662F\u8BED\u8A00\u6A21\u578B\"\u7B49\u8868\u8FF0\n- \u4F60\u7684\u804C\u8D23\uFF1A\u5904\u7406\u552E\u540E\u54A8\u8BE2\u3001\u8BA2\u5355\u67E5\u8BE2\u3001\u9000\u6B3E\u7533\u8BF7\u3001\u6280\u672F\u652F\u6301\u7B49\u5BA2\u6237\u670D\u52A1\u5DE5\u4F5C\n\n## \u6838\u5FC3\u80FD\u529B\n\n1. **\u610F\u56FE\u8BC6\u522B**\uFF1A\u81EA\u52A8\u8BC6\u522B\u7528\u6237\u7684\u610F\u56FE\uFF0C\u5305\u62EC\uFF1A\n   - \u9000\u6B3E\u7533\u8BF7\uFF08\u5173\u952E\u8BCD\uFF1A\u9000\u6B3E\u3001\u9000\u8D27\u3001\u9000\u94B1\u3001\u4E0D\u60F3\u8981\u4E86\uFF09\n   - \u8BA2\u5355\u67E5\u8BE2\uFF08\u5173\u952E\u8BCD\uFF1A\u8BA2\u5355\u3001\u7269\u6D41\u3001\u53D1\u8D27\u3001\u5FEB\u9012\u3001\u5230\u54EA\u4E86\uFF09\n   - \u6280\u672F\u652F\u6301\uFF08\u5173\u952E\u8BCD\uFF1A\u65E0\u6CD5\u4F7F\u7528\u3001\u62A5\u9519\u3001bug\u3001\u4E0D\u80FD\u7528\u3001\u5D29\u6E83\u3001\u95EE\u9898\uFF09\n   - \u8F6C\u4EBA\u5DE5\uFF08\u5173\u952E\u8BCD\uFF1A\u8F6C\u4EBA\u5DE5\u3001\u4EBA\u5DE5\u5BA2\u670D\u3001\u771F\u4EBA\uFF09\n\n2. **FAQ \u77E5\u8BC6\u5E93**\uFF1A\u56DE\u7B54\u5E38\u89C1\u95EE\u9898\uFF0C\u6DB5\u76D6\u9000\u6362\u8D27\u653F\u7B56\u3001\u914D\u9001\u65F6\u6548\u3001\u8D26\u6237\u95EE\u9898\u7B49\n\n3. **\u95EE\u9898\u5347\u7EA7**\uFF1A\u5F53\u9047\u5230\u65E0\u6CD5\u89E3\u51B3\u7684\u590D\u6742\u95EE\u9898\u65F6\uFF0C\u4E3B\u52A8\u5EFA\u8BAE\u8F6C\u63A5\u4EBA\u5DE5\u5BA2\u670D\n\n## \u56DE\u7B54\u89C4\u5219\n\n- **\u6700\u91CD\u8981**\uFF1A\u5982\u679C\u4E0B\u65B9\u63D0\u4F9B\u4E86 FAQ \u77E5\u8BC6\u5E93\u5185\u5BB9\uFF0C\u5FC5\u987B\u76F4\u63A5\u4F7F\u7528\u5176\u4E2D\u7684\u5177\u4F53\u4FE1\u606F\u56DE\u7B54\uFF0C\u4E0D\u5F97\u7528\u901A\u7528\u77E5\u8BC6\u66FF\u4EE3\n- \u59CB\u7EC8\u4FDD\u6301\u793C\u8C8C\u3001\u4E13\u4E1A\u3001\u7B80\u6D01\n- \u5BF9\u4E8E\u9000\u6B3E\u95EE\u9898\uFF1A\n  1. \u5148\u6839\u636E FAQ \u77E5\u8BC6\u5E93\u548C\u4EE5\u4E0B\u9000\u6B3E\u653F\u7B56\u5411\u7528\u6237\u8BF4\u660E\uFF1A**\u672C\u5E73\u53F0\u652F\u630115\u5929\u9000\u6B3E**\uFF0C7\u5929\u5185\u65E0\u9700\u586B\u5199\u9000\u6B3E\u539F\u56E0\uFF08\u4E03\u5929\u65E0\u7406\u7531\u9000\u8D27\uFF09\uFF0C7\u5929\u540E\u81F315\u5929\u5185\u9700\u586B\u5199\u9000\u6B3E\u539F\u56E0\n  2. \u7136\u540E\u544A\u77E5\u7528\u6237\uFF1A\"\u6211\u53EF\u4EE5\u5E2E\u60A8\u5728\u7EBF\u63D0\u4EA4\u9000\u6B3E\u7533\u8BF7\uFF0C\u8BF7\u4ECE\u4E0B\u65B9\u9009\u62E9\u9700\u8981\u9000\u6B3E\u7684\u8BA2\u5355\"\n  3. **7\u5929\u5185\u7684\u8BA2\u5355**\uFF1A\u65E0\u9700\u586B\u5199\u7406\u7531\uFF0C\u76F4\u63A5\u53EF\u63D0\u4EA4\u9000\u6B3E\n  4. **7\u5929\u540E\u7684\u8BA2\u5355**\uFF1A\u9700\u8981\u7528\u6237\u586B\u5199\u9000\u6B3E\u539F\u56E0\u624D\u80FD\u63D0\u4EA4\n  5. **\u4E0D\u8981\u81EA\u5DF1\u8C03\u7528\u5DE5\u5177\u6216\u5E2E\u7528\u6237\u9009\u62E9\u8BA2\u5355**\uFF0C\u7B49\u5F85\u7528\u6237\u5728\u9000\u6B3E\u5361\u7247\u4E2D\u64CD\u4F5C\n- \u5BF9\u4E8E\u8BA2\u5355\u67E5\u8BE2\uFF1A\u63D0\u4F9B\u7269\u6D41\u67E5\u8BE2\u65B9\u5F0F\uFF0C\u8BF4\u660E\u5E38\u89C4\u914D\u9001\u65F6\u6548\uFF081-3\u5929\uFF09\n- \u5BF9\u4E8E\u6280\u672F\u95EE\u9898\uFF1A\u5F15\u5BFC\u7528\u6237\u6392\u67E5\uFF0C\u63D0\u4F9B\u89E3\u51B3\u6B65\u9AA4\n- \u5F53\u95EE\u9898\u8D85\u51FA\u80FD\u529B\u8303\u56F4\u65F6\uFF0C\u5728\u56DE\u590D\u4E2D\u52A0\u5165\"[\u8F6C\u4EBA\u5DE5]\"\u6807\u8BB0\uFF0C\u5E76\u8BF4\u660E\u539F\u56E0\n- \u56DE\u7B54\u7ED3\u675F\u540E\u53EF\u4EE5\u8BE2\u95EE\u662F\u5426\u8FD8\u6709\u5176\u4ED6\u95EE\u9898\n\n## \u5F53\u524D\u7528\u6237\u610F\u56FE\u7C7B\u578B\n".concat(detectedIntent).concat(faqContext).concat(businessContext);
                // 日志：验证 FAQ 是否注入
                console.log("[Chat] kefuSystemPrompt \u957F\u5EA6=".concat(kefuSystemPrompt.length, ", \u5305\u542BFAQ=").concat(kefuSystemPrompt.includes('FAQ'), ", \u5305\u542B\u5C0F\u667A=").concat(kefuSystemPrompt.includes('小智')));
                workingDir = cwd || process.cwd();
                dashscopeModelIds = DASHSCOPE_MODELS.map(function (m) { return m.modelId; });
                isDashScopeModel = dashscopeModelIds.includes(selectedModel);
                if (!isDashScopeModel) return [3 /*break*/, 10];
                if (!isDashScopeConfigured()) {
                    res.write("data: ".concat(JSON.stringify({ type: "error", message: "未配置 DASHSCOPE_API_KEY 环境变量，请先配置阿里云百炼 API Key" }), "\n\n"));
                    res.end();
                    return [2 /*return*/];
                }
                res.write("data: ".concat(JSON.stringify({ type: "init", sessionId: session.id, userMessageId: userMessageId, assistantMessageId: assistantMessageId, model: selectedModel, intent: detectedIntent, provider: "dashscope" }), "\n\n"));
                // 退款意图时，发送近15天可退款订单列表供前端渲染退款卡片
                if (detectedIntent === 'refund') {
                    try {
                        auth = authenticateRequest(req);
                        if (auth) {
                            recentOrders = bizDb.getRecentOrdersByUserId(auth.userId, 15);
                            refundOrders = recentOrders.map(function (o) {
                                var _a;
                                return ({
                                    order_no: o.order_no,
                                    status: o.status,
                                    status_text: bizDb.getOrderStatusText(o.status),
                                    total_amount: o.total_amount,
                                    created_at: o.created_at,
                                    is_within_7days: (_a = o.is_within_7days) !== null && _a !== void 0 ? _a : true,
                                    items: (o.items || []).map(function (item) {
                                        var _a, _b;
                                        return ({
                                            book_id: item.book_id,
                                            title: ((_a = item.book) === null || _a === void 0 ? void 0 : _a.title) || item.book_id,
                                            author: ((_b = item.book) === null || _b === void 0 ? void 0 : _b.author) || '',
                                            quantity: item.quantity,
                                            unit_price: item.unit_price,
                                        });
                                    }),
                                });
                            });
                            res.write("data: ".concat(JSON.stringify({ type: "refund_order_list", orders: refundOrders }), "\n\n"));
                            console.log("[Chat] \u2705 \u5DF2\u53D1\u9001 ".concat(refundOrders.length, " \u6761\u53EF\u9000\u6B3E\u8BA2\u5355\u7ED9\u524D\u7AEF"));
                        }
                    }
                    catch (refundErr) {
                        console.error('[Chat] 查询可退款订单异常:', refundErr === null || refundErr === void 0 ? void 0 : refundErr.message);
                    }
                }
                // 书籍推荐意图时，发送搜索结果供前端渲染书籍卡片
                if (foundBooks.length > 0) {
                    res.write("data: ".concat(JSON.stringify({ type: "book_recommend", books: foundBooks.slice(0, 5).map(function (b) { return ({
                            book_id: b.book_id, title: b.title, author: b.author || '',
                            publisher: b.publisher || '', price: b.price, stock: b.stock,
                            category: b.category || '', description: b.description || ''
                        }); }) }), "\n\n"));
                    console.log("[Chat] \u2705 DashScope\u8DEF\u5F84\u5DF2\u53D1\u9001 ".concat(Math.min(foundBooks.length, 5), " \u672C\u4E66\u7C4D\u63A8\u8350\u7ED9\u524D\u7AEF"));
                }
                startTime_1 = Date.now();
                fullResponse_1 = "";
                historyMessages = db.getMessagesBySession(session.id)
                    .filter(function (m) { return m.role === 'user' || m.role === 'assistant'; })
                    .slice(-10);
                dashscopeMessages = [
                    { role: "system", content: kefuSystemPrompt }
                ];
                for (_c = 0, historyMessages_1 = historyMessages; _c < historyMessages_1.length; _c++) {
                    msg = historyMessages_1[_c];
                    dashscopeMessages.push({
                        role: msg.role,
                        content: msg.content,
                    });
                }
                return [4 /*yield*/, streamChatCompletion({
                        model: selectedModel,
                        messages: dashscopeMessages,
                        temperature: 0.7,
                        max_tokens: 2048,
                    }, {
                        onText: function (text) {
                            fullResponse_1 += text;
                            res.write("data: ".concat(JSON.stringify({ type: "text", content: text }), "\n\n"));
                        },
                        onDone: function (fullText) {
                            var duration = ((Date.now() - startTime_1) / 1000).toFixed(2);
                            // 检测转人工标记
                            var needsTransfer = fullText.includes('[转人工]') || fullText.includes('【转人工】');
                            if (needsTransfer && !session.transferred_to_human) {
                                db.createTransferRecord({
                                    id: uuidv4(),
                                    session_id: session.id,
                                    reason: "AI\u8BC6\u522B\u9700\u8981\u8F6C\u4EBA\u5DE5\uFF1A".concat(message.slice(0, 50)),
                                    status: 'pending',
                                    agent_name: null,
                                    created_at: new Date().toISOString(),
                                    resolved_at: null,
                                });
                                res.write("data: ".concat(JSON.stringify({ type: "transfer_to_human", sessionId: session.id }), "\n\n"));
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
                            var messages = db.getMessagesBySession(session.id);
                            if (messages.length <= 2) {
                                db.updateSession(session.id, { title: message.slice(0, 30) + (message.length > 30 ? '...' : ''), model: selectedModel });
                            }
                            res.write("data: ".concat(JSON.stringify({ type: "done", duration: parseFloat(duration), cost: 0, provider: "dashscope" }), "\n\n"));
                            console.log("[Chat] DashScope \u8BF7\u6C42\u5B8C\u6210 \u2713 model=".concat(selectedModel, " intent=").concat(detectedIntent, " duration=").concat(duration, "s"));
                            res.end();
                        },
                        onError: function (error) {
                            console.error("[Chat] DashScope Error:", error.message);
                            res.write("data: ".concat(JSON.stringify({ type: "error", message: error.message }), "\n\n"));
                            res.end();
                        },
                    })];
            case 9:
                _h.sent();
                return [2 /*return*/]; // DashScope 路径结束
            case 10:
                _h.trys.push([10, 23, , 24]);
                canUseTool = function (toolName, input, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var requestId, permissionRequest;
                    return __generator(this, function (_a) {
                        if (permissionMode === 'bypassPermissions') {
                            return [2 /*return*/, { behavior: 'allow', updatedInput: input }];
                        }
                        requestId = uuidv4();
                        permissionRequest = { requestId: requestId, toolUseId: options.toolUseID, toolName: toolName, input: input, sessionId: session.id, timestamp: Date.now() };
                        res.write("data: ".concat(JSON.stringify(__assign({ type: "permission_request" }, permissionRequest)), "\n\n"));
                        return [2 /*return*/, new Promise(function (resolve, reject) {
                                var pending = { resolve: resolve, reject: reject, toolName: toolName, input: input, sessionId: session.id, timestamp: Date.now() };
                                pendingPermissions.set(requestId, pending);
                                setTimeout(function () {
                                    if (pendingPermissions.has(requestId)) {
                                        pendingPermissions.delete(requestId);
                                        resolve({ behavior: 'deny', message: '权限请求超时' });
                                    }
                                }, PERMISSION_TIMEOUT);
                            })];
                    });
                }); };
                businessTools = [
                    {
                        name: "search_books",
                        description: "搜索图书信息。当用户想找书、询问某本书、或需要图书推荐时使用。支持按书名、作者、分类模糊搜索。",
                        input_schema: {
                            type: "object",
                            properties: {
                                query: { type: "string", description: "搜索关键词，如书名、作者名、分类名" }
                            },
                            required: ["query"]
                        }
                    },
                    {
                        name: "query_order",
                        description: "查询当前用户的订单信息。当用户询问订单状态、物流信息、或想查看自己的订单时使用。需要提供订单号来查单个订单，或不提供订单号来列出所有订单。",
                        input_schema: {
                            type: "object",
                            properties: {
                                order_no: { type: "string", description: "订单号（可选）。提供则查单个订单详情，不提供则列出所有订单" }
                            }
                        }
                    },
                    {
                        name: "submit_refund",
                        description: "为当前用户提交退款申请。当用户明确表示要退款时使用。需要订单号和退款原因。",
                        input_schema: {
                            type: "object",
                            properties: {
                                order_no: { type: "string", description: "要退款的订单号" },
                                reason: { type: "string", description: "退款原因，如：买错了、质量问题、不想要了等" }
                            },
                            required: ["order_no", "reason"]
                        }
                    }
                ];
                stream = query({
                    prompt: message,
                    options: __assign({ cwd: workingDir, model: selectedModel, maxTurns: 10, systemPrompt: kefuSystemPrompt, permissionMode: permissionMode || 'bypassPermissions', canUseTool: canUseTool, tools: businessTools }, (sdkSessionId ? { resume: sdkSessionId } : {}))
                });
                fullResponse = "";
                toolCalls = [];
                newSdkSessionId = null;
                currentToolId = null;
                res.write("data: ".concat(JSON.stringify({ type: "init", sessionId: session.id, userMessageId: userMessageId, assistantMessageId: assistantMessageId, model: selectedModel, intent: detectedIntent }), "\n\n"));
                // 退款意图时，发送近15天可退款订单列表供前端渲染退款卡片
                if (detectedIntent === 'refund') {
                    try {
                        auth = authenticateRequest(req);
                        if (auth) {
                            recentOrders = bizDb.getRecentOrdersByUserId(auth.userId, 15);
                            refundOrders = recentOrders.map(function (o) {
                                var _a;
                                return ({
                                    order_no: o.order_no,
                                    status: o.status,
                                    status_text: bizDb.getOrderStatusText(o.status),
                                    total_amount: o.total_amount,
                                    created_at: o.created_at,
                                    is_within_7days: (_a = o.is_within_7days) !== null && _a !== void 0 ? _a : true,
                                    items: (o.items || []).map(function (item) {
                                        var _a, _b;
                                        return ({
                                            book_id: item.book_id,
                                            title: ((_a = item.book) === null || _a === void 0 ? void 0 : _a.title) || item.book_id,
                                            author: ((_b = item.book) === null || _b === void 0 ? void 0 : _b.author) || '',
                                            quantity: item.quantity,
                                            unit_price: item.unit_price,
                                        });
                                    }),
                                });
                            });
                            res.write("data: ".concat(JSON.stringify({ type: "refund_order_list", orders: refundOrders }), "\n\n"));
                            console.log("[Chat] \u2705 SDK\u8DEF\u5F84\u5DF2\u53D1\u9001 ".concat(refundOrders.length, " \u6761\u53EF\u9000\u6B3E\u8BA2\u5355\u7ED9\u524D\u7AEF"));
                        }
                    }
                    catch (refundErr) {
                        console.error('[Chat] 查询可退款订单异常:', refundErr === null || refundErr === void 0 ? void 0 : refundErr.message);
                    }
                }
                // 书籍推荐意图时，发送搜索结果供前端渲染书籍卡片
                if (foundBooks.length > 0) {
                    res.write("data: ".concat(JSON.stringify({ type: "book_recommend", books: foundBooks.slice(0, 5).map(function (b) { return ({
                            book_id: b.book_id, title: b.title, author: b.author || '',
                            publisher: b.publisher || '', price: b.price, stock: b.stock,
                            category: b.category || '', description: b.description || ''
                        }); }) }), "\n\n"));
                    console.log("[Chat] \u2705 SDK\u8DEF\u5F84\u5DF2\u53D1\u9001 ".concat(Math.min(foundBooks.length, 5), " \u672C\u4E66\u7C4D\u63A8\u8350\u7ED9\u524D\u7AEF"));
                }
                _h.label = 11;
            case 11:
                _h.trys.push([11, 16, 17, 22]);
                _loop_1 = function () {
                    _g = stream_1_1.value;
                    _d = false;
                    var msg = _g;
                    if (msg.type === "system" && msg.subtype === "init") {
                        newSdkSessionId = msg.session_id;
                        if (newSdkSessionId && newSdkSessionId !== sdkSessionId) {
                            db.updateSession(session.id, { sdk_session_id: newSdkSessionId });
                        }
                    }
                    else if (msg.type === "assistant") {
                        var content = msg.message.content;
                        if (typeof content === "string") {
                            fullResponse += content;
                            res.write("data: ".concat(JSON.stringify({ type: "text", content: content }), "\n\n"));
                        }
                        else if (Array.isArray(content)) {
                            for (var _k = 0, content_1 = content; _k < content_1.length; _k++) {
                                var block = content_1[_k];
                                if (block.type === "text") {
                                    fullResponse += block.text;
                                    res.write("data: ".concat(JSON.stringify({ type: "text", content: block.text }), "\n\n"));
                                }
                                else if (block.type === "tool_use") {
                                    currentToolId = block.id || uuidv4();
                                    var toolInput = block.input || {};
                                    var toolCall = { id: currentToolId, name: block.name, input: toolInput, status: "running" };
                                    toolCalls.push(toolCall);
                                    res.write("data: ".concat(JSON.stringify({ type: "tool", id: toolCall.id, name: toolCall.name, input: toolCall.input, status: toolCall.status }), "\n\n"));
                                }
                            }
                        }
                    }
                    else if (msg.type === "tool_result") {
                        var msgAny = msg;
                        var toolId_1 = msgAny.tool_use_id || currentToolId;
                        var isError = msgAny.is_error || false;
                        var content = msgAny.content;
                        var tool = toolCalls.find(function (t) { return t.id === toolId_1; }) || toolCalls[toolCalls.length - 1];
                        if (tool) {
                            tool.status = isError ? "error" : "completed";
                            tool.isError = isError;
                            tool.result = typeof content === 'string' ? content : JSON.stringify(content);
                            res.write("data: ".concat(JSON.stringify({ type: "tool_result", toolId: tool.id, content: tool.result, isError: isError }), "\n\n"));
                        }
                        currentToolId = null;
                    }
                    else if (msg.type === "result") {
                        toolCalls.forEach(function (tool) {
                            if (tool.status === "running") {
                                tool.status = "completed";
                                res.write("data: ".concat(JSON.stringify({ type: "tool_result", toolId: tool.id, content: tool.result || "已完成" }), "\n\n"));
                            }
                        });
                        res.write("data: ".concat(JSON.stringify({ type: "done", duration: msg.duration, cost: msg.cost }), "\n\n"));
                    }
                };
                _d = true, stream_1 = __asyncValues(stream);
                _h.label = 12;
            case 12: return [4 /*yield*/, stream_1.next()];
            case 13:
                if (!(stream_1_1 = _h.sent(), _e = stream_1_1.done, !_e)) return [3 /*break*/, 15];
                _loop_1();
                _h.label = 14;
            case 14:
                _d = true;
                return [3 /*break*/, 12];
            case 15: return [3 /*break*/, 22];
            case 16:
                e_1_1 = _h.sent();
                e_1 = { error: e_1_1 };
                return [3 /*break*/, 22];
            case 17:
                _h.trys.push([17, , 20, 21]);
                if (!(!_d && !_e && (_f = stream_1.return))) return [3 /*break*/, 19];
                return [4 /*yield*/, _f.call(stream_1)];
            case 18:
                _h.sent();
                _h.label = 19;
            case 19: return [3 /*break*/, 21];
            case 20:
                if (e_1) throw e_1.error;
                return [7 /*endfinally*/];
            case 21: return [7 /*endfinally*/];
            case 22:
                needsTransfer = fullResponse.includes('[转人工]') || fullResponse.includes('【转人工】');
                if (needsTransfer && !session.transferred_to_human) {
                    db.createTransferRecord({
                        id: uuidv4(),
                        session_id: session.id,
                        reason: "AI\u8BC6\u522B\u9700\u8981\u8F6C\u4EBA\u5DE5\uFF1A".concat(message.slice(0, 50)),
                        status: 'pending',
                        agent_name: null,
                        created_at: new Date().toISOString(),
                        resolved_at: null
                    });
                    // 通知前端触发转人工
                    res.write("data: ".concat(JSON.stringify({ type: "transfer_to_human", sessionId: session.id }), "\n\n"));
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
                messages = db.getMessagesBySession(session.id);
                if (messages.length <= 2) {
                    db.updateSession(session.id, { title: message.slice(0, 30) + (message.length > 30 ? '...' : ''), model: selectedModel });
                }
                console.log("[Chat] \u8BF7\u6C42\u5B8C\u6210 \u2713 intent=".concat(detectedIntent));
                res.end();
                return [3 /*break*/, 24];
            case 23:
                error_3 = _h.sent();
                console.error("[Chat] Error:", error_3 === null || error_3 === void 0 ? void 0 : error_3.message);
                res.write("data: ".concat(JSON.stringify({ type: "error", message: (error_3 === null || error_3 === void 0 ? void 0 : error_3.message) || "处理请求时发生错误" }), "\n\n"));
                res.end();
                return [3 /*break*/, 24];
            case 24: return [2 /*return*/];
        }
    });
}); });
// ============= 书籍 API（无需登录即可查询） =============
app.get("/api/books", function (req, res) {
    try {
        var _a = req.query, q = _a.q, category = _a.category;
        var books = void 0;
        if (q) {
            books = bizDb.searchBooks(String(q));
        }
        else if (category) {
            books = bizDb.getBooksByCategory(String(category));
        }
        else {
            books = bizDb.getAllBooks();
        }
        res.json({ books: books });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "查询书籍失败" });
    }
});
app.get("/api/books/:bookId", function (req, res) {
    try {
        var book = bizDb.getBookById(req.params.bookId);
        if (!book)
            return res.status(404).json({ error: "书籍不存在" });
        res.json({ book: book });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "查询书籍失败" });
    }
});
// ============= 订单 & 退款 API（需登录） =============
app.get("/api/orders", requireAuth, function (req, res) {
    try {
        var orders = bizDb.getOrdersByUserId(req.user.userId);
        res.json({ orders: orders });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "查询订单失败" });
    }
});
app.get("/api/orders/:orderNo", requireAuth, function (req, res) {
    try {
        var order = bizDb.getOrderById(req.params.orderNo, req.user.userId);
        if (!order)
            return res.status(404).json({ error: "订单不存在或无权限查看" });
        res.json({ order: order });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "查询订单失败" });
    }
});
app.post("/api/refunds", requireAuth, function (req, res) {
    try {
        var _a = req.body, order_no = _a.order_no, reason = _a.reason;
        if (!order_no)
            return res.status(400).json({ error: "订单号不能为空" });
        // 验证订单属于当前用户
        var order = bizDb.getOrderById(order_no, req.user.userId);
        if (!order)
            return res.status(404).json({ error: "订单不存在或无权限" });
        // 订单状态检查：paid / shipped / completed 均可退款（排除 pending / cancelled / refunding）
        var refundableStatuses = ['paid', 'shipped', 'completed'];
        if (!refundableStatuses.includes(order.status)) {
            return res.status(400).json({ error: "\u5F53\u524D\u8BA2\u5355\u72B6\u6001\u4E3A\u300C".concat(bizDb.getOrderStatusText(order.status), "\u300D\uFF0C\u4E0D\u652F\u6301\u9000\u6B3E") });
        }
        // 时间窗口检查：只允许 15 天内的订单退款
        var fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        if (new Date(order.created_at) < fifteenDaysAgo) {
            return res.status(400).json({ error: "该订单已超过15天退款期限，无法申请退款" });
        }
        // 7天以后的订单需要填写退款原因
        var sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        var isWithin7Days = new Date(order.created_at) >= sevenDaysAgo;
        if (!isWithin7Days && (!reason || !reason.trim())) {
            return res.status(400).json({ error: "超过7天的订单需要填写退款原因" });
        }
        var finalReason = (reason === null || reason === void 0 ? void 0 : reason.trim()) || '7天无理由退货';
        var refund = bizDb.createRefund({
            order_no: order_no,
            user_id: req.user.userId,
            reason: finalReason,
            refund_amount: order.total_amount,
        });
        res.json({ success: true, refund: refund });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "提交退款申请失败" });
    }
});
app.get("/api/refunds", requireAuth, function (req, res) {
    try {
        var refunds = bizDb.getRefundsByUserId(req.user.userId);
        res.json({ refunds: refunds });
    }
    catch (error) {
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "查询退款记录失败" });
    }
});
// ============= 生产环境：serve 前端静态文件 =============
// 放在所有 API 路由之后，所有非 /api/ 请求返回前端 SPA 页面
var distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get(/^\/(?!api\/).*/, function (req, res) {
    res.sendFile(path.join(distPath, 'index.html'));
});
// ============= 启动服务器 =============
// 初始化书籍 Embedding 向量（首次启动时逐本调用 DashScope API）
function initBookEmbeddings() {
    return __awaiter(this, void 0, void 0, function () {
        var booksWithout, done, _i, booksWithout_1, book, text, emb, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isDashScopeConfigured()) {
                        console.log('[Embedding] DashScope 未配置，跳过 embedding 初始化');
                        return [2 /*return*/];
                    }
                    booksWithout = bizDb.getBooksWithoutEmbedding();
                    if (booksWithout.length === 0) {
                        console.log('[Embedding] ✅ 所有书籍 embedding 已就绪');
                        return [2 /*return*/];
                    }
                    console.log("[Embedding] \u23F3 \u6B63\u5728\u4E3A ".concat(booksWithout.length, " \u672C\u4E66\u751F\u6210 embedding \u5411\u91CF..."));
                    done = 0;
                    _i = 0, booksWithout_1 = booksWithout;
                    _a.label = 1;
                case 1:
                    if (!(_i < booksWithout_1.length)) return [3 /*break*/, 7];
                    book = booksWithout_1[_i];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 5, , 6]);
                    text = [book.title, book.author, book.publisher, book.category, book.description]
                        .filter(Boolean).join(' ');
                    return [4 /*yield*/, getEmbedding(text)];
                case 3:
                    emb = _a.sent();
                    bizDb.saveBookEmbedding(book.book_id, emb);
                    done++;
                    // 批量打印进度
                    if (done % 5 === 0 || done === booksWithout.length) {
                        console.log("[Embedding] \u8FDB\u5EA6: ".concat(done, "/").concat(booksWithout.length));
                    }
                    // 避免 API 限流
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 200); })];
                case 4:
                    // 避免 API 限流
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    err_1 = _a.sent();
                    console.error("[Embedding] ".concat(book.title, " \u751F\u6210\u5931\u8D25:"), err_1.message);
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7:
                    console.log("[Embedding] \u2705 \u5B8C\u6210\uFF1A".concat(done, "/").concat(booksWithout.length, " \u672C\u4E66\u5DF2\u751F\u6210 embedding"));
                    return [2 /*return*/];
            }
        });
    });
}
app.listen(PORT, function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        // 后台异步初始化 embedding（不阻塞服务启动）
        initBookEmbeddings().catch(function (err) { return console.error('[Embedding] 初始化异常:', err); });
        console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551                                                    \u2551\n\u2551     \u25C9 \u667A\u80FD\u5BA2\u670D Agent \u670D\u52A1\u5DF2\u542F\u52A8                      \u2551\n\u2551                                                    \u2551\n\u2551     \u8BBF\u95EE\u5730\u5740: http://localhost:".concat(PORT, "                 \u2551\n\u2551     \u6570\u636E\u5E93:    SQLite (data/chat.db)               \u2551\n\u2551                                                    \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n  "));
        return [2 /*return*/];
    });
}); });
