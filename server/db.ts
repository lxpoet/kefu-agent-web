import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'chat.db');

// 确保 data 目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(dbPath);

// 启用 WAL 模式以提高性能
db.pragma('journal_mode = WAL');

// 初始化数据库表
db.exec(`
  -- 会话表
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT NOT NULL,
    sdk_session_id TEXT,
    intent TEXT DEFAULT 'general',
    status TEXT DEFAULT 'open',
    satisfaction INTEGER,
    transferred_to_human INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- 消息表
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model TEXT,
    intent TEXT,
    created_at TEXT NOT NULL,
    tool_calls TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- FAQ 知识库表
  CREATE TABLE IF NOT EXISTS faq (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    tags TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- 满意度评价表
  CREATE TABLE IF NOT EXISTS satisfaction_ratings (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- 转人工记录表
  CREATE TABLE IF NOT EXISTS transfer_records (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    agent_name TEXT,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- 索引
  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
  CREATE INDEX IF NOT EXISTS idx_sessions_intent ON sessions(intent);
  CREATE INDEX IF NOT EXISTS idx_satisfaction_ratings_session ON satisfaction_ratings(session_id);
`);

// 数据库迁移：添加客服字段（如果不存在）
const sessionColumns = (db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>).map(c => c.name);
const migrations: [string, string][] = [
  ['sdk_session_id', "ALTER TABLE sessions ADD COLUMN sdk_session_id TEXT"],
  ['intent', "ALTER TABLE sessions ADD COLUMN intent TEXT DEFAULT 'general'"],
  ['status', "ALTER TABLE sessions ADD COLUMN status TEXT DEFAULT 'open'"],
  ['satisfaction', "ALTER TABLE sessions ADD COLUMN satisfaction INTEGER"],
  ['transferred_to_human', "ALTER TABLE sessions ADD COLUMN transferred_to_human INTEGER DEFAULT 0"],
];
for (const [col, sql] of migrations) {
  if (!sessionColumns.includes(col)) {
    try { db.exec(sql); console.log(`[DB] Added column: ${col}`); } catch {}
  }
}

// 初始化 FAQ 数据
const faqCount = (db.prepare("SELECT COUNT(*) as count FROM faq").get() as { count: number }).count;
if (faqCount === 0) {
  const insertFaq = db.prepare(`
    INSERT INTO faq (id, category, question, answer, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  const faqs = [
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
  const insertMany = db.transaction(() => {
    for (const faq of faqs) {
      insertFaq.run(faq[0], faq[1], faq[2], faq[3], faq[4], now, now);
    }
  });
  insertMany();
  console.log('[DB] FAQ 初始数据已插入');
}

// 类型定义
export interface DbSession {
  id: string;
  title: string;
  model: string;
  sdk_session_id: string | null;
  intent: string;
  status: string;
  satisfaction: number | null;
  transferred_to_human: number;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  intent: string | null;
  created_at: string;
  tool_calls: string | null;
}

export interface DbFaq {
  id: string;
  category: string;
  question: string;
  answer: string;
  tags: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface DbSatisfactionRating {
  id: string;
  session_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface DbTransferRecord {
  id: string;
  session_id: string;
  reason: string | null;
  status: string;
  agent_name: string | null;
  created_at: string;
  resolved_at: string | null;
}

// ============= 会话操作 =============

export function getAllSessions(): DbSession[] {
  const stmt = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
  return stmt.all() as DbSession[];
}

export function getSession(id: string): DbSession | undefined {
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  return stmt.get(id) as DbSession | undefined;
}

export function createSession(session: Partial<DbSession> & Pick<DbSession, 'id' | 'title' | 'model' | 'created_at' | 'updated_at'>): DbSession {
  const stmt = db.prepare(`
    INSERT INTO sessions (id, title, model, sdk_session_id, intent, status, satisfaction, transferred_to_human, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    session.id, session.title, session.model,
    session.sdk_session_id ?? null,
    session.intent ?? 'general',
    session.status ?? 'open',
    session.satisfaction ?? null,
    session.transferred_to_human ?? 0,
    session.created_at, session.updated_at
  );
  return getSession(session.id)!;
}

export function updateSession(id: string, updates: Partial<Pick<DbSession, 'title' | 'model' | 'sdk_session_id' | 'intent' | 'status' | 'satisfaction' | 'transferred_to_human'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];

  const allowed: (keyof typeof updates)[] = ['title', 'model', 'sdk_session_id', 'intent', 'status', 'satisfaction', 'transferred_to_human'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return false;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

export function deleteSession(id: string): boolean {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============= 消息操作 =============

export function getMessagesBySession(sessionId: string): DbMessage[] {
  const stmt = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC');
  return stmt.all(sessionId) as DbMessage[];
}

export function createMessage(message: Omit<DbMessage, 'intent'> & { intent?: string | null }): DbMessage {
  const stmt = db.prepare(`
    INSERT INTO messages (id, session_id, role, content, model, intent, created_at, tool_calls)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    message.id, message.session_id, message.role,
    message.content, message.model ?? null,
    message.intent ?? null,
    message.created_at, message.tool_calls ?? null
  );

  // 更新会话的 updated_at
  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), message.session_id);

  return message as DbMessage;
}

export function updateMessage(id: string, updates: Partial<Pick<DbMessage, 'content' | 'tool_calls'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
  if (updates.tool_calls !== undefined) { fields.push('tool_calls = ?'); values.push(updates.tool_calls); }

  if (fields.length === 0) return false;
  values.push(id);

  const stmt = db.prepare(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

export function deleteMessage(id: string): boolean {
  const stmt = db.prepare('DELETE FROM messages WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function createMessages(messages: DbMessage[]): void {
  const stmt = db.prepare(`
    INSERT INTO messages (id, session_id, role, content, model, intent, created_at, tool_calls)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((msgs: DbMessage[]) => {
    for (const msg of msgs) {
      stmt.run(msg.id, msg.session_id, msg.role, msg.content, msg.model, msg.intent, msg.created_at, msg.tool_calls);
    }
  });

  insertMany(messages);
}

// ============= FAQ 操作 =============

export function getAllFaqs(): DbFaq[] {
  return db.prepare('SELECT * FROM faq ORDER BY category, question').all() as DbFaq[];
}

export function searchFaq(keyword: string): DbFaq[] {
  const q = `%${keyword}%`;
  return db.prepare('SELECT * FROM faq WHERE question LIKE ? OR answer LIKE ? OR tags LIKE ? ORDER BY usage_count DESC LIMIT 5').all(q, q, q) as DbFaq[];
}

export function createFaq(faq: DbFaq): DbFaq {
  db.prepare(`INSERT INTO faq (id, category, question, answer, tags, usage_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`).run(faq.id, faq.category, faq.question, faq.answer, faq.tags, faq.created_at, faq.updated_at);
  return faq;
}

export function updateFaq(id: string, updates: Partial<Pick<DbFaq, 'category' | 'question' | 'answer' | 'tags' | 'usage_count'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); }
  }
  if (!fields.length) return false;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString(), id);
  return (db.prepare(`UPDATE faq SET ${fields.join(', ')} WHERE id = ?`).run(...values)).changes > 0;
}

export function deleteFaq(id: string): boolean {
  return (db.prepare('DELETE FROM faq WHERE id = ?').run(id)).changes > 0;
}

export function incrementFaqUsage(id: string): void {
  db.prepare('UPDATE faq SET usage_count = usage_count + 1 WHERE id = ?').run(id);
}

// ============= 满意度操作 =============

export function createSatisfactionRating(rating: DbSatisfactionRating): DbSatisfactionRating {
  db.prepare(`INSERT INTO satisfaction_ratings (id, session_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?)`).run(rating.id, rating.session_id, rating.rating, rating.comment, rating.created_at);
  // 同步更新 session
  updateSession(rating.session_id, { satisfaction: rating.rating, status: 'closed' });
  return rating;
}

export function getSatisfactionStats(): {
  avg: number;
  total: number;
  distribution: Record<number, number>;
  byIntent: Record<string, number>;
} {
  const ratings = db.prepare('SELECT r.rating, s.intent FROM satisfaction_ratings r LEFT JOIN sessions s ON r.session_id = s.id').all() as Array<{ rating: number; intent: string }>;

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const byIntent: Record<string, number[]> = {};

  for (const r of ratings) {
    distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    if (r.intent) {
      if (!byIntent[r.intent]) byIntent[r.intent] = [];
      byIntent[r.intent].push(r.rating);
    }
  }

  const avg = ratings.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;
  const byIntentAvg: Record<string, number> = {};
  for (const [intent, rList] of Object.entries(byIntent)) {
    byIntentAvg[intent] = rList.reduce((s, r) => s + r, 0) / rList.length;
  }

  return { avg: Math.round(avg * 10) / 10, total: ratings.length, distribution, byIntent: byIntentAvg };
}

// ============= 转人工记录 =============

export function createTransferRecord(record: DbTransferRecord): DbTransferRecord {
  db.prepare(`INSERT INTO transfer_records (id, session_id, reason, status, agent_name, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(record.id, record.session_id, record.reason, record.status, record.agent_name, record.created_at, record.resolved_at);
  updateSession(record.session_id, { transferred_to_human: 1, status: 'transferred' });
  return record;
}

export function getTransferRecords(): DbTransferRecord[] {
  return db.prepare('SELECT * FROM transfer_records ORDER BY created_at DESC').all() as DbTransferRecord[];
}

// ============= 统计数据 =============

export function getDashboardStats() {
  const totalSessions = (db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number }).count;
  const openSessions = (db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'open'").get() as { count: number }).count;
  const transferredSessions = (db.prepare("SELECT COUNT(*) as count FROM sessions WHERE transferred_to_human = 1").get() as { count: number }).count;
  const intentStats = db.prepare("SELECT intent, COUNT(*) as count FROM sessions GROUP BY intent").all() as Array<{ intent: string; count: number }>;
  const recentSessions = db.prepare("SELECT s.*, (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count FROM sessions s ORDER BY s.updated_at DESC LIMIT 20").all();
  const satisfactionStats = getSatisfactionStats();

  return {
    totalSessions,
    openSessions,
    transferredSessions,
    intentStats,
    recentSessions,
    satisfactionStats,
  };
}

export function clearAllData(): void {
  db.exec('DELETE FROM messages');
  db.exec('DELETE FROM sessions');
  db.exec('DELETE FROM satisfaction_ratings');
  db.exec('DELETE FROM transfer_records');
}

export default db;
