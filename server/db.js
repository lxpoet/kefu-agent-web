import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
// 数据库文件路径
var dbPath = path.join(__dirname, '..', 'data', 'chat.db');
// 确保 data 目录存在
var dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
// 创建数据库连接
var db = new Database(dbPath);
// 启用 WAL 模式以提高性能
db.pragma('journal_mode = WAL');
// 初始化数据库表
db.exec("\n  -- \u4F1A\u8BDD\u8868\n  CREATE TABLE IF NOT EXISTS sessions (\n    id TEXT PRIMARY KEY,\n    title TEXT NOT NULL,\n    model TEXT NOT NULL,\n    sdk_session_id TEXT,\n    intent TEXT DEFAULT 'general',\n    status TEXT DEFAULT 'open',\n    satisfaction INTEGER,\n    transferred_to_human INTEGER DEFAULT 0,\n    created_at TEXT NOT NULL,\n    updated_at TEXT NOT NULL\n  );\n\n  -- \u6D88\u606F\u8868\n  CREATE TABLE IF NOT EXISTS messages (\n    id TEXT PRIMARY KEY,\n    session_id TEXT NOT NULL,\n    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),\n    content TEXT NOT NULL,\n    model TEXT,\n    intent TEXT,\n    created_at TEXT NOT NULL,\n    tool_calls TEXT,\n    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE\n  );\n\n  -- FAQ \u77E5\u8BC6\u5E93\u8868\n  CREATE TABLE IF NOT EXISTS faq (\n    id TEXT PRIMARY KEY,\n    category TEXT NOT NULL,\n    question TEXT NOT NULL,\n    answer TEXT NOT NULL,\n    tags TEXT,\n    usage_count INTEGER DEFAULT 0,\n    created_at TEXT NOT NULL,\n    updated_at TEXT NOT NULL\n  );\n\n  -- \u6EE1\u610F\u5EA6\u8BC4\u4EF7\u8868\n  CREATE TABLE IF NOT EXISTS satisfaction_ratings (\n    id TEXT PRIMARY KEY,\n    session_id TEXT NOT NULL,\n    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),\n    comment TEXT,\n    created_at TEXT NOT NULL,\n    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE\n  );\n\n  -- \u8F6C\u4EBA\u5DE5\u8BB0\u5F55\u8868\n  CREATE TABLE IF NOT EXISTS transfer_records (\n    id TEXT PRIMARY KEY,\n    session_id TEXT NOT NULL,\n    reason TEXT,\n    status TEXT DEFAULT 'pending',\n    agent_name TEXT,\n    created_at TEXT NOT NULL,\n    resolved_at TEXT,\n    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE\n  );\n\n  -- \u7D22\u5F15\n  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);\n  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);\n  CREATE INDEX IF NOT EXISTS idx_sessions_intent ON sessions(intent);\n  CREATE INDEX IF NOT EXISTS idx_satisfaction_ratings_session ON satisfaction_ratings(session_id);\n");
// 数据库迁移：添加客服字段（如果不存在）
var sessionColumns = db.prepare("PRAGMA table_info(sessions)").all().map(function (c) { return c.name; });
var migrations = [
    ['sdk_session_id', "ALTER TABLE sessions ADD COLUMN sdk_session_id TEXT"],
    ['intent', "ALTER TABLE sessions ADD COLUMN intent TEXT DEFAULT 'general'"],
    ['status', "ALTER TABLE sessions ADD COLUMN status TEXT DEFAULT 'open'"],
    ['satisfaction', "ALTER TABLE sessions ADD COLUMN satisfaction INTEGER"],
    ['transferred_to_human', "ALTER TABLE sessions ADD COLUMN transferred_to_human INTEGER DEFAULT 0"],
];
for (var _i = 0, migrations_1 = migrations; _i < migrations_1.length; _i++) {
    var _a = migrations_1[_i], col = _a[0], sql = _a[1];
    if (!sessionColumns.includes(col)) {
        try {
            db.exec(sql);
            console.log("[DB] Added column: ".concat(col));
        }
        catch (_b) { }
    }
}
// 初始化 FAQ 数据
var faqCount = db.prepare("SELECT COUNT(*) as count FROM faq").get().count;
if (faqCount === 0) {
    var insertFaq_1 = db.prepare("\n    INSERT INTO faq (id, category, question, answer, tags, created_at, updated_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?)\n  ");
    var now_1 = new Date().toISOString();
    var faqs_1 = [
        ['faq-1', '退款政策', '如何申请退款？', '您可以在收货后7天内申请无理由退货退款。请前往"我的订单"→"申请退款"，填写退款原因并提交。退款将在3-5个工作日内退回原支付账户。', '退款,退货,退钱'],
        ['faq-2', '退款政策', '退款需要多久到账？', '退款审核通过后，3-5个工作日内退回原支付账户。具体到账时间以银行处理时间为准，一般不超过7个工作日。', '退款,到账,时效'],
        ['faq-3', '配送政策', '配送时效是多久？', '标准配送1-3个工作日，次日达城市支持次日送达，偏远地区可能需要3-7个工作日。您可在订单详情中查看预计送达时间。', '配送,物流,时效'],
        ['faq-4', '配送政策', '如何查询物流信息？', '您可以在"我的订单"中找到对应订单，点击"查看物流"即可查看实时物流信息。也可以使用快递单号在对应快递公司官网查询。', '物流,快递,查询'],
        ['faq-5', '账户问题', '忘记密码怎么办？', '您可以在登录页面点击"忘记密码"，通过注册手机号或邮箱接收验证码，重置新密码。', '密码,找回,账户'],
        ['faq-6', '账户问题', '账号被盗怎么办？', '请立即联系我们客服冻结账号，并提供身份证明。我们会在核实身份后协助您找回账号并保障账号安全。', '账号,安全,被盗'],
        ['faq-7', '售后服务', '商品质量有问题怎么办？', '收货后15天内如有质量问题，可申请免费换货或退款。请保留商品原包装和购买凭证，拍照上传质量问题图片提交申请。', '质量,售后,换货'],
        ['faq-8', '技术支持', 'APP无法登录怎么办？', '请尝试以下步骤：1.检查网络连接；2.清除APP缓存；3.卸载重装APP；4.检查账号密码是否正确。若仍无法解决，请联系技术支持。', '登录,APP,技术'],
        ['faq-9', '支付问题', '支付失败怎么办？', '支付失败可能原因：1.银行卡余额不足；2.网络问题；3.银行风控拦截。建议更换支付方式或联系银行确认。', '支付,付款,失败'],
        ['faq-10', '发票问题', '如何申请发票？', '购买商品时可在结算页面选择开具发票，支持普通发票和增值税专用发票。也可在收货后30天内在"我的订单"中补开发票。', '发票,税票,报销'],
    ];
    var insertMany = db.transaction(function () {
        for (var _i = 0, faqs_2 = faqs_1; _i < faqs_2.length; _i++) {
            var faq = faqs_2[_i];
            insertFaq_1.run(faq[0], faq[1], faq[2], faq[3], faq[4], now_1, now_1);
        }
    });
    insertMany();
    console.log('[DB] FAQ 初始数据已插入');
}
// ============= 会话操作 =============
export function getAllSessions() {
    var stmt = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
    return stmt.all();
}
export function getSession(id) {
    var stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(id);
}
export function createSession(session) {
    var _a, _b, _c, _d, _e;
    var stmt = db.prepare("\n    INSERT INTO sessions (id, title, model, sdk_session_id, intent, status, satisfaction, transferred_to_human, created_at, updated_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    stmt.run(session.id, session.title, session.model, (_a = session.sdk_session_id) !== null && _a !== void 0 ? _a : null, (_b = session.intent) !== null && _b !== void 0 ? _b : 'general', (_c = session.status) !== null && _c !== void 0 ? _c : 'open', (_d = session.satisfaction) !== null && _d !== void 0 ? _d : null, (_e = session.transferred_to_human) !== null && _e !== void 0 ? _e : 0, session.created_at, session.updated_at);
    return getSession(session.id);
}
export function updateSession(id, updates) {
    var fields = [];
    var values = [];
    var allowed = ['title', 'model', 'sdk_session_id', 'intent', 'status', 'satisfaction', 'transferred_to_human'];
    for (var _i = 0, allowed_1 = allowed; _i < allowed_1.length; _i++) {
        var key = allowed_1[_i];
        if (updates[key] !== undefined) {
            fields.push("".concat(key, " = ?"));
            values.push(updates[key]);
        }
    }
    if (fields.length === 0)
        return false;
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    var stmt = db.prepare("UPDATE sessions SET ".concat(fields.join(', '), " WHERE id = ?"));
    var result = stmt.run.apply(stmt, values);
    return result.changes > 0;
}
export function deleteSession(id) {
    var stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
    var result = stmt.run(id);
    return result.changes > 0;
}
// ============= 消息操作 =============
export function getMessagesBySession(sessionId) {
    var stmt = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC');
    return stmt.all(sessionId);
}
export function createMessage(message) {
    var _a, _b, _c;
    var stmt = db.prepare("\n    INSERT INTO messages (id, session_id, role, content, model, intent, created_at, tool_calls)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    stmt.run(message.id, message.session_id, message.role, message.content, (_a = message.model) !== null && _a !== void 0 ? _a : null, (_b = message.intent) !== null && _b !== void 0 ? _b : null, message.created_at, (_c = message.tool_calls) !== null && _c !== void 0 ? _c : null);
    // 更新会话的 updated_at
    db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), message.session_id);
    return message;
}
export function updateMessage(id, updates) {
    var fields = [];
    var values = [];
    if (updates.content !== undefined) {
        fields.push('content = ?');
        values.push(updates.content);
    }
    if (updates.tool_calls !== undefined) {
        fields.push('tool_calls = ?');
        values.push(updates.tool_calls);
    }
    if (fields.length === 0)
        return false;
    values.push(id);
    var stmt = db.prepare("UPDATE messages SET ".concat(fields.join(', '), " WHERE id = ?"));
    var result = stmt.run.apply(stmt, values);
    return result.changes > 0;
}
export function deleteMessage(id) {
    var stmt = db.prepare('DELETE FROM messages WHERE id = ?');
    var result = stmt.run(id);
    return result.changes > 0;
}
export function createMessages(messages) {
    var stmt = db.prepare("\n    INSERT INTO messages (id, session_id, role, content, model, intent, created_at, tool_calls)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    var insertMany = db.transaction(function (msgs) {
        for (var _i = 0, msgs_1 = msgs; _i < msgs_1.length; _i++) {
            var msg = msgs_1[_i];
            stmt.run(msg.id, msg.session_id, msg.role, msg.content, msg.model, msg.intent, msg.created_at, msg.tool_calls);
        }
    });
    insertMany(messages);
}
// ============= FAQ 操作 =============
export function getAllFaqs() {
    return db.prepare('SELECT * FROM faq ORDER BY category, question').all();
}
export function searchFaq(keyword) {
    var q = "%".concat(keyword, "%");
    return db.prepare('SELECT * FROM faq WHERE question LIKE ? OR answer LIKE ? OR tags LIKE ? ORDER BY usage_count DESC LIMIT 5').all(q, q, q);
}
export function createFaq(faq) {
    db.prepare("INSERT INTO faq (id, category, question, answer, tags, usage_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)").run(faq.id, faq.category, faq.question, faq.answer, faq.tags, faq.created_at, faq.updated_at);
    return faq;
}
export function updateFaq(id, updates) {
    var _a;
    var fields = [];
    var values = [];
    for (var _i = 0, _b = Object.entries(updates); _i < _b.length; _i++) {
        var _c = _b[_i], k = _c[0], v = _c[1];
        if (v !== undefined) {
            fields.push("".concat(k, " = ?"));
            values.push(v);
        }
    }
    if (!fields.length)
        return false;
    fields.push('updated_at = ?');
    values.push(new Date().toISOString(), id);
    return ((_a = db.prepare("UPDATE faq SET ".concat(fields.join(', '), " WHERE id = ?"))).run.apply(_a, values)).changes > 0;
}
export function deleteFaq(id) {
    return (db.prepare('DELETE FROM faq WHERE id = ?').run(id)).changes > 0;
}
export function incrementFaqUsage(id) {
    db.prepare('UPDATE faq SET usage_count = usage_count + 1 WHERE id = ?').run(id);
}
// ============= 满意度操作 =============
export function createSatisfactionRating(rating) {
    db.prepare("INSERT INTO satisfaction_ratings (id, session_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?)").run(rating.id, rating.session_id, rating.rating, rating.comment, rating.created_at);
    // 同步更新 session
    updateSession(rating.session_id, { satisfaction: rating.rating, status: 'closed' });
    return rating;
}
export function getSatisfactionStats() {
    var ratings = db.prepare('SELECT r.rating, s.intent FROM satisfaction_ratings r LEFT JOIN sessions s ON r.session_id = s.id').all();
    var distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    var byIntent = {};
    for (var _i = 0, ratings_1 = ratings; _i < ratings_1.length; _i++) {
        var r = ratings_1[_i];
        distribution[r.rating] = (distribution[r.rating] || 0) + 1;
        if (r.intent) {
            if (!byIntent[r.intent])
                byIntent[r.intent] = [];
            byIntent[r.intent].push(r.rating);
        }
    }
    var avg = ratings.length ? ratings.reduce(function (s, r) { return s + r.rating; }, 0) / ratings.length : 0;
    var byIntentAvg = {};
    for (var _a = 0, _b = Object.entries(byIntent); _a < _b.length; _a++) {
        var _c = _b[_a], intent = _c[0], rList = _c[1];
        byIntentAvg[intent] = rList.reduce(function (s, r) { return s + r; }, 0) / rList.length;
    }
    return { avg: Math.round(avg * 10) / 10, total: ratings.length, distribution: distribution, byIntent: byIntentAvg };
}
// ============= 转人工记录 =============
export function createTransferRecord(record) {
    db.prepare("INSERT INTO transfer_records (id, session_id, reason, status, agent_name, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(record.id, record.session_id, record.reason, record.status, record.agent_name, record.created_at, record.resolved_at);
    updateSession(record.session_id, { transferred_to_human: 1, status: 'transferred' });
    return record;
}
export function getTransferRecords() {
    return db.prepare('SELECT * FROM transfer_records ORDER BY created_at DESC').all();
}
// ============= 统计数据 =============
export function getDashboardStats() {
    var totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
    var openSessions = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'open'").get().count;
    var transferredSessions = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE transferred_to_human = 1").get().count;
    var intentStats = db.prepare("SELECT intent, COUNT(*) as count FROM sessions GROUP BY intent").all();
    var recentSessions = db.prepare("SELECT s.*, (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count FROM sessions s ORDER BY s.updated_at DESC LIMIT 20").all();
    var satisfactionStats = getSatisfactionStats();
    return {
        totalSessions: totalSessions,
        openSessions: openSessions,
        transferredSessions: transferredSessions,
        intentStats: intentStats,
        recentSessions: recentSessions,
        satisfactionStats: satisfactionStats,
    };
}
export function clearAllData() {
    db.exec('DELETE FROM messages');
    db.exec('DELETE FROM sessions');
    db.exec('DELETE FROM satisfaction_ratings');
    db.exec('DELETE FROM transfer_records');
}
export default db;
