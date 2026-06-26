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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
// 数据库文件路径（独立文件）
var dbPath = path.join(__dirname, '..', 'data', 'business.db');
var dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
var db = new Database(dbPath);
db.pragma('journal_mode = WAL');
// ============= 初始化表结构 =============
db.exec("\n  -- \u7528\u6237\u8868\n  CREATE TABLE IF NOT EXISTS biz_users (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    user_id TEXT UNIQUE NOT NULL,\n    username TEXT UNIQUE NOT NULL,\n    password_hash TEXT NOT NULL,\n    email TEXT,\n    phone TEXT,\n    created_at TEXT NOT NULL\n  );\n\n  -- \u4E66\u7C4D\u4FE1\u606F\u8868\n  CREATE TABLE IF NOT EXISTS books (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    book_id TEXT UNIQUE NOT NULL,\n    title TEXT NOT NULL,\n    author TEXT,\n    publisher TEXT,\n    price REAL NOT NULL,\n    stock INTEGER DEFAULT 0,\n    category TEXT,\n    description TEXT,\n    created_at TEXT NOT NULL\n  );\n\n  -- \u8BA2\u5355\u8868\n  CREATE TABLE IF NOT EXISTS orders (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    order_no TEXT UNIQUE NOT NULL,\n    user_id TEXT NOT NULL,\n    total_amount REAL NOT NULL,\n    status TEXT DEFAULT 'pending',\n    created_at TEXT NOT NULL,\n    paid_at TEXT,\n    shipped_at TEXT,\n    completed_at TEXT,\n    cancelled_at TEXT,\n    FOREIGN KEY (user_id) REFERENCES biz_users(user_id)\n  );\n\n  -- \u8BA2\u5355\u660E\u7EC6\u8868\n  CREATE TABLE IF NOT EXISTS order_items (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    order_no TEXT NOT NULL,\n    book_id TEXT NOT NULL,\n    quantity INTEGER NOT NULL,\n    unit_price REAL NOT NULL,\n    FOREIGN KEY (order_no) REFERENCES orders(order_no),\n    FOREIGN KEY (book_id) REFERENCES books(book_id)\n  );\n\n  -- \u9000\u6B3E\u7533\u8BF7\u8868\n  CREATE TABLE IF NOT EXISTS refunds (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    refund_no TEXT UNIQUE NOT NULL,\n    order_no TEXT NOT NULL,\n    user_id TEXT NOT NULL,\n    reason TEXT,\n    status TEXT DEFAULT 'pending',\n    refund_amount REAL NOT NULL,\n    created_at TEXT NOT NULL,\n    processed_at TEXT,\n    FOREIGN KEY (order_no) REFERENCES orders(order_no),\n    FOREIGN KEY (user_id) REFERENCES biz_users(user_id)\n  );\n\n  -- \u7D22\u5F15\n  CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);\n  CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);\n  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);\n  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);\n  CREATE INDEX IF NOT EXISTS idx_refunds_user_id ON refunds(user_id);\n  CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);\n");
// ============= 迁移：embedding 字段 =============
try {
    db.exec("ALTER TABLE books ADD COLUMN embedding BLOB");
    console.log('[BusinessDB] ✅ 已添加 books.embedding 字段');
}
catch (_a) {
    // 字段已存在
}
// ============= FTS5 全文索引 =============
// 使用 unicode61 分词器，中文通过预处理在字间插入空格实现分词
// FTS5 表存储预处理后的文本（CJK 字间有空格），通过 rowid 关联 books.id
try {
    db.exec("\n    CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(\n      title,\n      author,\n      publisher,\n      category,\n      description,\n      tokenize='unicode61',\n      content=''\n    )\n  ");
    console.log('[BusinessDB] ✅ FTS5 虚拟表 books_fts 已就绪');
}
catch (err) {
    console.log('[BusinessDB] FTS5 表创建跳过:', err.message);
}
// ============= 种子数据 =============
var userCount = db.prepare('SELECT COUNT(*) as count FROM biz_users').get().count;
if (userCount === 0) {
    var now = new Date().toISOString();
    var hash = function (p) { return bcrypt.hashSync(p, 10); };
    var insertUser = db.prepare("INSERT INTO biz_users (user_id, username, password_hash, email, phone, created_at) VALUES (?, ?, ?, ?, ?, ?)");
    insertUser.run('U001', 'alice', hash('password123'), 'alice@example.com', '13800001111', now);
    insertUser.run('U002', 'bob', hash('password123'), 'bob@example.com', '13800002222', now);
    insertUser.run('U003', 'carol', hash('password123'), 'carol@example.com', '13800003333', now);
    insertUser.run('U004', 'david', hash('password123'), 'david@example.com', '13800004444', now);
    insertUser.run('U005', 'eve', hash('password123'), 'eve@example.com', '13800005555', now);
    console.log('[BusinessDB] 种子用户数据已插入（5 个测试用户，密码均为 password123）');
}
var bookCount = db.prepare('SELECT COUNT(*) as count FROM books').get().count;
if (bookCount === 0) {
    var now_1 = new Date().toISOString();
    var insertBook_1 = db.prepare("\n    INSERT INTO books (book_id, title, author, publisher, price, stock, category, description, created_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    var books_1 = [
        ['BK001', 'React 实战入门', '张三', '电子工业出版社', 79.00, 50, '技术', '从零开始学习 React，涵盖 Hooks、Router、状态管理等核心内容。'],
        ['BK002', '深入理解 TypeScript', '李四', '机械工业出版社', 89.00, 30, '技术', '全面讲解 TypeScript 类型系统、高级类型和工程实践。'],
        ['BK003', 'Node.js 高级编程', '王五', '人民邮电出版社', 95.00, 25, '技术', '深入 Node.js 运行时原理、异步编程和性能优化。'],
        ['BK004', '三体（全集）', '刘慈欣', '重庆出版社', 93.00, 100, '科幻', '刘慈欣代表作，雨果奖获奖作品，讲述地球文明与三体文明的交锋。'],
        ['BK005', '活着', '余华', '作家出版社', 35.00, 200, '文学', '余华经典代表作，讲述一个人在中国历史变迁中的苦难与坚韧。'],
        ['BK006', '百年孤独', '加西亚·马尔克斯', '南海出版公司', 55.00, 80, '文学', '魔幻现实主义代表作，布恩迪亚家族七代人的传奇故事。'],
        ['BK007', '算法导论（第4版）', 'Thomas H. Cormen', '机械工业出版社', 128.00, 20, '技术', '计算机算法经典教材，涵盖排序、图算法、动态规划等核心内容。'],
        ['BK008', '设计模式', 'Erich Gamma 等', '机械工业出版社', 69.00, 40, '技术', '23 种经典设计模式的详细讲解，软件工程师必读。'],
        ['BK009', '围城', '钱钟书', '人民文学出版社', 38.00, 150, '文学', '中国现代文学经典，以幽默笔触描绘知识分子的生活困境。'],
        ['BK010', '人类简史', '尤瓦尔·赫拉利', '中信出版社', 52.00, 60, '社科', '从认知革命、农业革命到科学革命，重新审视人类历史。'],
        ['BK011', 'Python 编程：从入门到实践', 'Eric Matthes', '人民邮电出版社', 89.00, 45, '技术', 'Python 入门经典教程，涵盖基础语法和项目实战。'],
        ['BK012', '月亮与六便士', '毛姆', '上海译文出版社', 42.00, 90, '文学', '以高更为原型，讲述一个英国画家放弃一切追求艺术的故事。'],
        ['BK013', '代码整洁之道', 'Robert C. Martin', '人民邮电出版社', 59.00, 35, '技术', '写出整洁代码的实践指南，涵盖命名、函数、类设计等原则。'],
        ['BK014', '平凡的世界', '路遥', '北京十月文艺出版社', 68.00, 120, '文学', '茅盾文学奖获奖作品，全景式展现中国当代城乡社会生活。'],
        ['BK015', '时间简史', '史蒂芬·霍金', '湖南科学技术出版社', 45.00, 70, '社科', '霍金经典科普著作，讲述宇宙的起源、黑洞和时间箭头。'],
    ];
    var insertMany = db.transaction(function (items) {
        for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
            var b = items_1[_i];
            insertBook_1.run.apply(insertBook_1, __spreadArray(__spreadArray([], b, false), [now_1], false));
        }
    });
    insertMany(books_1);
    console.log('[BusinessDB] 种子书籍数据已插入（15 本书）');
}
// ============= 同步 FTS5 索引（种子数据插入后执行一次） =============
var ftsCount = db.prepare('SELECT COUNT(*) as count FROM books_fts').get().count;
if (ftsCount === 0) {
    syncFts5FromBooks();
    console.log("[BusinessDB] \u2705 FTS5 \u7D22\u5F15\u5165\u5E93\u5B8C\u6210\uFF08".concat(ftsCount, " \u6761 \u2192 ").concat(db.prepare('SELECT COUNT(*) as count FROM books_fts').get().count, " \u6761\uFF09"));
}
// ============= CJK 字符预处理 =============
// 在中文字符之间插入空格，使得 unicode61 分词器能正确分词
// 保留 ASCII 单词和数字的连续性
function cjkPreprocess(text) {
    if (!text)
        return '';
    // 匹配 CJK 字符、中文标点，在它们前后插入空格
    return text
        .replace(/([\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff，。！？；：""''（）【】《》—…])/g, ' $1 ')
        .replace(/\s+/g, ' ')
        .trim();
}
// ============= 余弦相似度 =============
function cosineSimilarity(a, b) {
    var dot = 0, magA = 0, magB = 0;
    for (var i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    if (magA === 0 || magB === 0)
        return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
// Embedding 序列化 / 反序列化
function serializeEmbedding(emb) {
    return Buffer.from(emb.buffer);
}
function deserializeEmbedding(buf) {
    return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}
// ============= FTS5 同步辅助 =============
/** 将所有 books 行的预处理文本同步到 FTS5 表 */
export function syncFts5FromBooks() {
    var books = db.prepare('SELECT id, title, author, publisher, category, description FROM books').all();
    var stmt = db.prepare('INSERT INTO books_fts(rowid, title, author, publisher, category, description) VALUES (?, ?, ?, ?, ?, ?)');
    var tx = db.transaction(function (items) {
        for (var _i = 0, items_2 = items; _i < items_2.length; _i++) {
            var b = items_2[_i];
            stmt.run(b.id, cjkPreprocess(b.title), cjkPreprocess(b.author), cjkPreprocess(b.publisher), cjkPreprocess(b.category), cjkPreprocess(b.description));
        }
    });
    tx(books);
}
var orderCount = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
if (orderCount === 0) {
    var now = new Date().toISOString();
    var insertOrder = db.prepare("\n    INSERT INTO orders (order_no, user_id, total_amount, status, created_at, paid_at, shipped_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?)\n  ");
    var insertItem = db.prepare("\n    INSERT INTO order_items (order_no, book_id, quantity, unit_price)\n    VALUES (?, ?, ?, ?)\n  ");
    // U001 的订单：已发货
    insertOrder.run('ORD20260401001', 'U001', 79.00, 'shipped', '2026-04-01T10:00:00Z', '2026-04-01T10:05:00Z', '2026-04-02T08:00:00Z');
    insertItem.run('ORD20260401001', 'BK001', 1, 79.00);
    // U001 的订单：已完成
    insertOrder.run('ORD20260410001', 'U001', 128.00, 'completed', '2026-04-10T14:00:00Z', '2026-04-10T14:03:00Z', '2026-04-11T09:00:00Z');
    insertItem.run('ORD20260410001', 'BK007', 1, 128.00);
    // U002 的订单：待付款
    insertOrder.run('ORD20260501001', 'U002', 35.00, 'pending', '2026-05-01T09:00:00Z', null, null);
    insertItem.run('ORD20260501001', 'BK005', 1, 35.00);
    // U002 的订单：已付款
    insertOrder.run('ORD20260503001', 'U002', 93.00, 'paid', '2026-05-03T16:00:00Z', '2026-05-03T16:02:00Z', null);
    insertItem.run('ORD20260503001', 'BK004', 1, 93.00);
    // U003 的订单：已发货（有退款记录）
    insertOrder.run('ORD20260420001', 'U003', 89.00, 'shipped', '2026-04-20T11:00:00Z', '2026-04-20T11:05:00Z', '2026-04-21T08:00:00Z');
    insertItem.run('ORD20260420001', 'BK002', 1, 89.00);
    // U003 的退款记录
    db.prepare("\n    INSERT INTO refunds (refund_no, order_no, user_id, reason, status, refund_amount, created_at, processed_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?)\n  ").run('RF20260425001', 'ORD20260420001', 'U003', '买错了，想要 Python 相关的书', 'approved', 89.00, '2026-04-25T10:00:00Z', '2026-04-26T09:00:00Z');
    console.log('[BusinessDB] 种子订单和退款数据已插入');
}
// ============= 用户操作 =============
export function findUserByUsername(username) {
    return db.prepare('SELECT * FROM biz_users WHERE username = ?').get(username);
}
export function findUserByUserId(userId) {
    return db.prepare('SELECT * FROM biz_users WHERE user_id = ?').get(userId);
}
export function createUser(data) {
    var password_hash = bcrypt.hashSync(data.password, 10);
    var now = new Date().toISOString();
    db.prepare("\n    INSERT INTO biz_users (user_id, username, password_hash, email, phone, created_at)\n    VALUES (?, ?, ?, ?, ?, ?)\n  ").run(data.user_id, data.username, password_hash, data.email || null, data.phone || null, now);
    return findUserByUserId(data.user_id);
}
export function verifyPassword(user, password) {
    return bcrypt.compareSync(password, user.password_hash);
}
// ============= 书籍操作 =============
export function searchBooks(keyword) {
    var q = "%".concat(keyword, "%");
    return db.prepare("\n    SELECT * FROM books\n    WHERE title LIKE ? OR author LIKE ? OR category LIKE ? OR description LIKE ?\n    ORDER BY stock DESC\n  ").all(q, q, q, q);
}
export function getBookById(bookId) {
    return db.prepare('SELECT * FROM books WHERE book_id = ?').get(bookId);
}
export function getAllBooks() {
    return db.prepare('SELECT * FROM books ORDER BY category, title').all();
}
export function getBooksByCategory(category) {
    return db.prepare('SELECT * FROM books WHERE category = ? ORDER BY title').all(category);
}
// ============= Embedding 向量操作 =============
/** 获取所有已有 embedding 的书籍（用于批量检测初始化状态） */
export function getBooksWithoutEmbedding() {
    return db.prepare('SELECT * FROM books WHERE embedding IS NULL').all();
}
/** 获取所有书籍的 embedding（用于语义检索时的向量计算） */
export function getAllBookEmbeddings() {
    var rows = db.prepare('SELECT * FROM books WHERE embedding IS NOT NULL').all();
    return rows.map(function (b) { return (__assign(__assign({}, b), { embedding_vec: deserializeEmbedding(b.embedding) })); });
}
/** 保存书籍的 embedding 向量 */
export function saveBookEmbedding(bookId, emb) {
    db.prepare('UPDATE books SET embedding = ? WHERE book_id = ?').run(serializeEmbedding(emb), bookId);
}
// ============= FTS5 全文检索 =============
/** FTS5 全文检索，返回带 BM25 分数的书籍列表 */
export function searchBooksFTS5(keyword) {
    if (!keyword.trim())
        return [];
    // 对查询词做同样的 CJK 预处理
    var preprocessed = cjkPreprocess(keyword);
    if (!preprocessed)
        return [];
    try {
        return db.prepare("\n      SELECT b.*, rank as _score\n      FROM books_fts f\n      JOIN books b ON b.id = f.rowid\n      WHERE books_fts MATCH ?\n        AND b.embedding IS NOT NULL\n      ORDER BY rank\n      LIMIT 10\n    ").all(preprocessed);
    }
    catch (_a) {
        return [];
    }
}
// ============= 语义向量检索 =============
/** 基于 embedding 余弦相似度检索 Top-K 书籍 */
export function searchBooksSemantic(queryEmbedding, topK) {
    if (topK === void 0) { topK = 5; }
    var books = getAllBookEmbeddings();
    if (books.length === 0)
        return [];
    var scored = books.map(function (b) { return (__assign(__assign({}, b), { _score: cosineSimilarity(queryEmbedding, b.embedding_vec) })); });
    return scored
        .sort(function (a, b) { return b._score - a._score; })
        .slice(0, topK)
        .map(function (_a) {
        var embedding_vec = _a.embedding_vec, embedding = _a.embedding, rest = __rest(_a, ["embedding_vec", "embedding"]);
        return rest;
    });
}
/**
 * 混合检索：融合 FTS5 全文匹配和 Embedding 语义匹配
 * - queryEmbedding: 用户查询的 embedding 向量（未提供时纯 FTS5）
 * - keyword: 用户原始查询关键词（可能为空）
 * - topK: 返回结果数
 */
export function searchBooksHybrid(keyword, queryEmbedding, topK) {
    if (topK === void 0) { topK = 5; }
    // 用于去重的 map
    var resultMap = new Map();
    var MAX_FTS5_SCORE = 100; // FTS5 rank 归一化常数（rank 越小越好，范围约 -10 到 0）
    // 第一路：FTS5 关键词匹配
    if (keyword.trim()) {
        var fts5Results = searchBooksFTS5(keyword);
        for (var _i = 0, fts5Results_1 = fts5Results; _i < fts5Results_1.length; _i++) {
            var b = fts5Results_1[_i];
            // FTS5 rank 越小分数越高，归一化到 0-1
            var normalizedScore = Math.min(1, Math.max(0, (MAX_FTS5_SCORE + b._score) / MAX_FTS5_SCORE));
            resultMap.set(b.book_id, __assign(__assign({}, b), { _score: normalizedScore, _source: 'fts5' }));
            delete resultMap.get(b.book_id)._score_inner;
        }
    }
    // 第二路：Embedding 语义匹配
    if (queryEmbedding) {
        var semResults = searchBooksSemantic(queryEmbedding, topK * 2);
        for (var _a = 0, semResults_1 = semResults; _a < semResults_1.length; _a++) {
            var b = semResults_1[_a];
            var existing = resultMap.get(b.book_id);
            if (existing) {
                // 已存在于 FTS5 结果：加权融合（FTS5 占 0.3，Embedding 占 0.7）
                existing._score = existing._score * 0.3 + b._score * 0.7;
                existing._source = 'both';
            }
            else {
                resultMap.set(b.book_id, __assign(__assign({}, b), { _score: b._score, _source: 'embedding' }));
            }
        }
    }
    // 排序、截断、返回
    return __spreadArray([], resultMap.values(), true).sort(function (a, b) { return b._score - a._score; })
        .slice(0, topK);
}
// ============= 订单操作 =============
export function getOrdersByUserId(userId) {
    var orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    return orders.map(function (order) { return buildOrderWithItems(order); });
}
export function getOrderById(orderNo, userId) {
    var order;
    if (userId) {
        order = db.prepare('SELECT * FROM orders WHERE order_no = ? AND user_id = ?').get(orderNo, userId);
    }
    else {
        order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
    }
    if (!order)
        return undefined;
    return buildOrderWithItems(order);
}
// 获取用户最近 N 天内的订单（排除 pending/cancelled/refunding 状态，用于退款卡片）
// 同时排除已存在退款记录的订单（双重防护）
// 默认查询 15 天内，区分 7 天内（无理由免填）和 7-15 天（需填理由）
export function getRecentOrdersByUserId(userId, days) {
    if (days === void 0) { days = 15; }
    var since = new Date();
    since.setDate(since.getDate() - days);
    var sinceIso = since.toISOString();
    var sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    var sevenDaysAgoIso = sevenDaysAgo.toISOString();
    // 排除：pending、cancelled、refunding 状态
    // 排除：已存在退款申请的订单（通过 LEFT JOIN refunds 双重保险）
    var orders = db.prepare("\n    SELECT o.* FROM orders o\n    LEFT JOIN refunds r ON r.order_no = o.order_no\n    WHERE o.user_id = ?\n      AND o.created_at >= ?\n      AND o.status NOT IN ('pending', 'cancelled', 'refunding')\n      AND r.order_no IS NULL\n    ORDER BY o.created_at DESC\n  ").all(userId, sinceIso);
    return orders.map(function (order) { return (__assign(__assign({}, buildOrderWithItems(order)), { is_within_7days: order.created_at >= sevenDaysAgoIso })); });
}
// 构建订单+明细+书籍的完整结构
function buildOrderWithItems(order) {
    var items = db.prepare("\n    SELECT oi.*, b.* FROM order_items oi\n    JOIN books b ON b.book_id = oi.book_id\n    WHERE oi.order_no = ?\n  ").all(order.order_no);
    var mappedItems = items.map(function (it) { return (__assign(__assign({}, it), { book: {
            id: 0,
            book_id: it.book_id,
            title: it.title,
            author: it.author,
            publisher: it.publisher,
            price: it.price,
            stock: it.stock,
            category: it.category,
            description: it.description,
            created_at: it.created_at,
        } })); });
    return __assign(__assign({}, order), { items: mappedItems });
}
// ============= 退款操作 =============
export function createRefund(data) {
    var now = new Date().toISOString();
    var refund_no = "RF".concat(Date.now()).concat(Math.random().toString(36).slice(2, 6));
    db.prepare("\n    INSERT INTO refunds (refund_no, order_no, user_id, reason, status, refund_amount, created_at, processed_at)\n    VALUES (?, ?, ?, ?, 'pending', ?, ?, NULL)\n  ").run(refund_no, data.order_no, data.user_id, data.reason, data.refund_amount, now);
    // 同步更新订单状态为 refunding，防止重复退款申请
    db.prepare("UPDATE orders SET status = 'refunding' WHERE order_no = ?").run(data.order_no);
    return db.prepare('SELECT * FROM refunds WHERE refund_no = ?').get(refund_no);
}
export function getRefundsByUserId(userId) {
    return db.prepare('SELECT * FROM refunds WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}
export function getRefundByNo(refundNo) {
    return db.prepare('SELECT * FROM refunds WHERE refund_no = ?').get(refundNo);
}
// ============= 统计（供 AI 工具使用） =============
export function getOrderStatusText(status) {
    var map = {
        'pending': '待付款',
        'paid': '已付款',
        'shipped': '已发货',
        'completed': '已完成',
        'cancelled': '已取消',
        'refunding': '退款中',
    };
    return map[status] || status;
}
export default db;
