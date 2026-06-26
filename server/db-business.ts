import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径（独立文件）
const dbPath = path.join(__dirname, '..', 'data', 'business.db');

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// ============= 初始化表结构 =============

db.exec(`
  -- 用户表
  CREATE TABLE IF NOT EXISTS biz_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TEXT NOT NULL
  );

  -- 书籍信息表
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    publisher TEXT,
    price REAL NOT NULL,
    stock INTEGER DEFAULT 0,
    category TEXT,
    description TEXT,
    created_at TEXT NOT NULL
  );

  -- 订单表
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    paid_at TEXT,
    shipped_at TEXT,
    completed_at TEXT,
    cancelled_at TEXT,
    FOREIGN KEY (user_id) REFERENCES biz_users(user_id)
  );

  -- 订单明细表
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL,
    book_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    FOREIGN KEY (order_no) REFERENCES orders(order_no),
    FOREIGN KEY (book_id) REFERENCES books(book_id)
  );

  -- 退款申请表
  CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    refund_no TEXT UNIQUE NOT NULL,
    order_no TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    refund_amount REAL NOT NULL,
    created_at TEXT NOT NULL,
    processed_at TEXT,
    FOREIGN KEY (order_no) REFERENCES orders(order_no),
    FOREIGN KEY (user_id) REFERENCES biz_users(user_id)
  );

  -- 索引
  CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);
  CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_refunds_user_id ON refunds(user_id);
  CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
`);

// ============= 迁移：embedding 字段 =============

try {
  db.exec(`ALTER TABLE books ADD COLUMN embedding BLOB`);
  console.log('[BusinessDB] ✅ 已添加 books.embedding 字段');
} catch {
  // 字段已存在
}

// ============= FTS5 全文索引 =============
// 使用 unicode61 分词器，中文通过预处理在字间插入空格实现分词
// FTS5 表存储预处理后的文本（CJK 字间有空格），通过 rowid 关联 books.id

try {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
      title,
      author,
      publisher,
      category,
      description,
      tokenize='unicode61',
      content=''
    )
  `);
  console.log('[BusinessDB] ✅ FTS5 虚拟表 books_fts 已就绪');
} catch (err: any) {
  console.log('[BusinessDB] FTS5 表创建跳过:', err.message);
}

// ============= 种子数据 =============

const userCount = (db.prepare('SELECT COUNT(*) as count FROM biz_users').get() as { count: number }).count;
if (userCount === 0) {
  const now = new Date().toISOString();
  const hash = (p: string) => bcrypt.hashSync(p, 10);

  const insertUser = db.prepare(`INSERT INTO biz_users (user_id, username, password_hash, email, phone, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
  insertUser.run('U001', 'alice', hash('password123'), 'alice@example.com', '13800001111', now);
  insertUser.run('U002', 'bob', hash('password123'), 'bob@example.com', '13800002222', now);
  insertUser.run('U003', 'carol', hash('password123'), 'carol@example.com', '13800003333', now);
  insertUser.run('U004', 'david', hash('password123'), 'david@example.com', '13800004444', now);
  insertUser.run('U005', 'eve', hash('password123'), 'eve@example.com', '13800005555', now);

  console.log('[BusinessDB] 种子用户数据已插入（5 个测试用户，密码均为 password123）');
}

const bookCount = (db.prepare('SELECT COUNT(*) as count FROM books').get() as { count: number }).count;
if (bookCount === 0) {
  const now = new Date().toISOString();
  const insertBook = db.prepare(`
    INSERT INTO books (book_id, title, author, publisher, price, stock, category, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const books = [
    // ========== 技术类（8本） ==========
    ['BK001', 'React 实战入门', '张三', '电子工业出版社', 79.00, 50, '技术', '从零开始学习 React，涵盖 Hooks、Router、状态管理等核心内容。'],
    ['BK002', '深入理解 TypeScript', '李四', '机械工业出版社', 89.00, 30, '技术', '全面讲解 TypeScript 类型系统、高级类型和工程实践。'],
    ['BK003', 'Node.js 高级编程', '王五', '人民邮电出版社', 95.00, 25, '技术', '深入 Node.js 运行时原理、异步编程和性能优化。'],
    ['BK007', '算法导论（第4版）', 'Thomas H. Cormen', '机械工业出版社', 128.00, 20, '技术', '计算机算法经典教材，涵盖排序、图算法、动态规划等核心内容。'],
    ['BK008', '设计模式', 'Erich Gamma 等', '机械工业出版社', 69.00, 40, '技术', '23 种经典设计模式的详细讲解，软件工程师必读。'],
    ['BK011', 'Python 编程：从入门到实践', 'Eric Matthes', '人民邮电出版社', 89.00, 45, '技术', 'Python 入门经典教程，涵盖基础语法和项目实战。'],
    ['BK013', '代码整洁之道', 'Robert C. Martin', '人民邮电出版社', 59.00, 35, '技术', '写出整洁代码的实践指南，涵盖命名、函数、类设计等原则。'],
    ['BK016', 'Rust 程序设计', 'Steve Klabnik', '电子工业出版社', 99.00, 25, '技术', 'Rust 官方团队核心成员编写，系统讲解 Rust 所有权、生命周期和并发模型。'],

    // ========== 文学类（8本） ==========
    ['BK005', '活着', '余华', '作家出版社', 35.00, 200, '文学', '余华经典代表作，讲述一个人在中国历史变迁中的苦难与坚韧。'],
    ['BK006', '百年孤独', '加西亚·马尔克斯', '南海出版公司', 55.00, 80, '文学', '魔幻现实主义代表作，布恩迪亚家族七代人的传奇故事。'],
    ['BK009', '围城', '钱钟书', '人民文学出版社', 38.00, 150, '文学', '中国现代文学经典，以幽默笔触描绘知识分子的生活困境。'],
    ['BK012', '月亮与六便士', '毛姆', '上海译文出版社', 42.00, 90, '文学', '以高更为原型，讲述一个英国画家放弃一切追求艺术的故事。'],
    ['BK014', '平凡的世界', '路遥', '北京十月文艺出版社', 68.00, 120, '文学', '茅盾文学奖获奖作品，全景式展现中国当代城乡社会生活。'],
    ['BK017', '红楼梦', '曹雪芹', '人民文学出版社', 78.00, 100, '文学', '中国古典四大名著之首，以贾宝玉和林黛玉的爱情悲剧为主线，展现封建社会的衰落。'],
    ['BK018', '1984', '乔治·奥威尔', '上海译文出版社', 36.00, 85, '文学', '反乌托邦经典之作，"老大哥在看着你"，对极权主义的深刻批判。'],
    ['BK019', '挪威的森林', '村上春树', '上海译文出版社', 39.00, 110, '文学', '村上春树代表作，一段关于青春、爱情与死亡的动人故事。'],

    // ========== 科幻类（6本） ==========
    ['BK004', '三体（全集）', '刘慈欣', '重庆出版社', 93.00, 100, '科幻', '刘慈欣代表作，雨果奖获奖作品，讲述地球文明与三体文明的交锋。'],
    ['BK020', '银河帝国：基地', '艾萨克·阿西莫夫', '江苏文艺出版社', 45.00, 65, '科幻', '科幻史上最伟大的系列开篇，哈里·谢顿创立心理史学，预言银河帝国的灭亡。'],
    ['BK021', '沙丘', '弗兰克·赫伯特', '江苏凤凰文艺出版社', 68.00, 55, '科幻', '史诗级科幻巨著，沙漠星球厄拉科斯上的权力斗争与生态寓言。'],
    ['BK022', '流浪地球', '刘慈欣', '四川科学技术出版社', 32.00, 90, '科幻', '刘慈欣短篇代表作，太阳即将毁灭，人类带着地球去流浪。'],
    ['BK023', '你一生的故事', '特德·姜', '译林出版社', 38.00, 60, '科幻', '降临原作，语言学与物理学交织的科幻杰作，探讨自由意志与宿命。'],
    ['BK024', '神经漫游者', '威廉·吉布森', '江苏教育出版社', 42.00, 40, '科幻', '赛博朋克开山之作，定义了网络空间的概念，影响了《黑客帝国》等无数作品。'],

    // ========== 社科类（5本） ==========
    ['BK010', '人类简史', '尤瓦尔·赫拉利', '中信出版社', 52.00, 60, '社科', '从认知革命、农业革命到科学革命，重新审视人类历史。'],
    ['BK015', '时间简史', '史蒂芬·霍金', '湖南科学技术出版社', 45.00, 70, '社科', '霍金经典科普著作，讲述宇宙的起源、黑洞和时间箭头。'],
    ['BK025', '乌合之众', '古斯塔夫·勒庞', '中央编译出版社', 29.00, 80, '社科', '群体心理学经典，剖析群体行为的非理性特征及其对社会的影响。'],
    ['BK026', '枪炮、病菌与钢铁', '贾雷德·戴蒙德', '中信出版社', 62.00, 45, '社科', '普利策奖获奖作品，解释不同大陆文明发展差异的深层原因。'],
    ['BK027', '思考，快与慢', '丹尼尔·卡尼曼', '中信出版社', 58.00, 70, '社科', '诺贝尔经济学奖得主著作，揭示人类思维的系统1和系统2运作机制。'],

    // ========== 商业类（4本） ==========
    ['BK028', '原则', '瑞·达利欧', '中信出版社', 69.00, 55, '商业', '桥水基金创始人的生活和工作原则，时间检验的成功法则。'],
    ['BK029', '从0到1', '彼得·蒂尔', '中信出版社', 42.00, 75, '商业', 'PayPal创始人的创业哲学，如何建立垄断性企业的全新思考。'],
    ['BK030', '精益创业', '埃里克·莱斯', '中信出版社', 49.00, 65, '商业', '最小可行产品（MVP）方法论，现代互联网创业的圣经。'],
    ['BK031', '创新者的窘境', '克莱顿·克里斯坦森', '中信出版社', 56.00, 50, '商业', '颠覆性创新理论的奠基之作，解释领先企业为何会被后来者打败。'],

    // ========== 哲学类（3本） ==========
    ['BK032', '苏菲的世界', '乔斯坦·贾德', '作家出版社', 38.00, 90, '哲学', '以小说形式讲述西方哲学史，从苏格拉底到萨特的智慧之旅。'],
    ['BK033', '存在与时间', '海德格尔', '商务印书馆', 88.00, 20, '哲学', '20世纪最重要哲学著作之一，探讨"此在"与存在的意义。'],
    ['BK034', '中国哲学简史', '冯友兰', '北京大学出版社', 48.00, 60, '哲学', '中国哲学入门经典，系统梳理先秦诸子到近代哲学的发展脉络。'],

    // ========== 历史类（3本） ==========
    ['BK035', '万历十五年', '黄仁宇', '生活·读书·新知三联书店', 42.00, 85, '历史', '以万历十五年为切入点，揭示明朝官僚体制的深层问题。'],
    ['BK036', '明朝那些事儿（全集）', '当年明月', '浙江人民出版社', 128.00, 120, '历史', '以幽默通俗的语言讲述明朝三百年的兴衰，让历史不再枯燥。'],
    ['BK037', '全球通史', '斯塔夫里阿诺斯', '北京大学出版社', 98.00, 40, '历史', '全球视野下的文明发展史，打破欧洲中心论的历史观念。'],

    // ========== 心理类（3本） ==========
    ['BK038', '被讨厌的勇气', '岸见一郎/古贺史健', '机械工业出版社', 42.00, 95, '心理', '阿德勒心理学通俗读物，教会我们如何获得真正的自由和幸福。'],
    ['BK039', '自卑与超越', '阿尔弗雷德·阿德勒', '中国友谊出版公司', 36.00, 75, '心理', '个体心理学奠基之作，探讨自卑感的来源及其对人生发展的影响。'],
    ['BK040', '非暴力沟通', '马歇尔·卢森堡', '华夏出版社', 45.00, 100, '心理', '学会用非暴力的方式表达自己、倾听他人，改善人际关系。'],
  ];

  const insertMany = db.transaction((items: typeof books) => {
    for (const b of items) {
      insertBook.run(...b, now);
    }
  });
  insertMany(books);

  console.log('[BusinessDB] 种子书籍数据已插入（40 本书，涵盖技术/文学/科幻/社科/商业/哲学/历史/心理八大分类）');
}

// ============= 同步 FTS5 索引（种子数据插入后执行一次） =============

const ftsCount = (db.prepare('SELECT COUNT(*) as count FROM books_fts').get() as { count: number }).count;
if (ftsCount === 0) {
  syncFts5FromBooks();
  console.log(`[BusinessDB] ✅ FTS5 索引入库完成（${ftsCount} 条 → ${(db.prepare('SELECT COUNT(*) as count FROM books_fts').get() as { count: number }).count} 条）`);
}

// ============= CJK 字符预处理 =============
// 在中文字符之间插入空格，使得 unicode61 分词器能正确分词
// 保留 ASCII 单词和数字的连续性

function cjkPreprocess(text: string | null): string {
  if (!text) return '';
  // 匹配 CJK 字符、中文标点，在它们前后插入空格
  return text
    .replace(/([\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff，。！？；：""''（）【】《》—…])/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============= 余弦相似度 =============

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Embedding 序列化 / 反序列化
function serializeEmbedding(emb: Float32Array): Buffer {
  return Buffer.from(emb.buffer);
}

function deserializeEmbedding(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

// ============= FTS5 同步辅助 =============

/** 将所有 books 行的预处理文本同步到 FTS5 表 */
export function syncFts5FromBooks(): void {
  const books = db.prepare('SELECT id, title, author, publisher, category, description FROM books').all() as (Book & { id: number })[];
  const stmt = db.prepare('INSERT INTO books_fts(rowid, title, author, publisher, category, description) VALUES (?, ?, ?, ?, ?, ?)');
  const tx = db.transaction((items: typeof books) => {
    for (const b of items) {
      stmt.run(
        b.id,
        cjkPreprocess(b.title),
        cjkPreprocess(b.author),
        cjkPreprocess(b.publisher),
        cjkPreprocess(b.category),
        cjkPreprocess(b.description),
      );
    }
  });
  tx(books);
}

const orderCount = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number }).count;
if (orderCount === 0) {
  const now = new Date().toISOString();
  const insertOrder = db.prepare(`
    INSERT INTO orders (order_no, user_id, total_amount, status, created_at, paid_at, shipped_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_no, book_id, quantity, unit_price)
    VALUES (?, ?, ?, ?)
  `);

  // ========== alice (U001) 的订单（7笔，各种状态） ==========
  // 已完成的历史订单
  insertOrder.run('ORD20260401001', 'U001', 79.00, 'completed', '2026-04-01T10:00:00Z', '2026-04-01T10:05:00Z', '2026-04-02T08:00:00Z');
  insertItem.run('ORD20260401001', 'BK001', 1, 79.00);

  insertOrder.run('ORD20260410001', 'U001', 128.00, 'completed', '2026-04-10T14:00:00Z', '2026-04-10T14:03:00Z', '2026-04-11T09:00:00Z');
  insertItem.run('ORD20260410001', 'BK007', 1, 128.00);

  insertOrder.run('ORD20260515001', 'U001', 138.00, 'completed', '2026-05-15T09:30:00Z', '2026-05-15T09:35:00Z', '2026-05-16T10:00:00Z');
  insertItem.run('ORD20260515001', 'BK020', 1, 45.00);
  insertItem.run('ORD20260515001', 'BK004', 1, 93.00);

  // 当前月份（2026年6月）的订单
  insertOrder.run('ORD20260603001', 'U001', 93.00, 'shipped', '2026-06-03T15:00:00Z', '2026-06-03T15:02:00Z', '2026-06-04T08:00:00Z');
  insertItem.run('ORD20260603001', 'BK004', 1, 93.00);

  insertOrder.run('ORD20260615001', 'U001', 205.00, 'shipped', '2026-06-15T11:00:00Z', '2026-06-15T11:03:00Z', '2026-06-16T09:00:00Z');
  insertItem.run('ORD20260615001', 'BK021', 1, 68.00);
  insertItem.run('ORD20260615001', 'BK022', 1, 32.00);
  insertItem.run('ORD20260615001', 'BK005', 3, 35.00);

  // 最近的订单（待付款 + 刚付完款）
  insertOrder.run('ORD20260622001', 'U001', 80.00, 'pending', '2026-06-22T20:15:00Z', null, null);
  insertItem.run('ORD20260622001', 'BK009', 1, 38.00);
  insertItem.run('ORD20260622001', 'BK012', 1, 42.00);

  insertOrder.run('ORD20260625001', 'U001', 111.00, 'paid', '2026-06-25T18:30:00Z', '2026-06-25T18:32:00Z', null);
  insertItem.run('ORD20260625001', 'BK035', 1, 42.00);
  insertItem.run('ORD20260625001', 'BK028', 1, 69.00);

  // ========== bob (U002) 的订单 ==========
  insertOrder.run('ORD20260501001', 'U002', 35.00, 'pending', '2026-05-01T09:00:00Z', null, null);
  insertItem.run('ORD20260501001', 'BK005', 1, 35.00);

  insertOrder.run('ORD20260503001', 'U002', 93.00, 'paid', '2026-05-03T16:00:00Z', '2026-05-03T16:02:00Z', null);
  insertItem.run('ORD20260503001', 'BK004', 1, 93.00);

  // ========== carol (U003) 的订单（含退款） ==========
  insertOrder.run('ORD20260420001', 'U003', 89.00, 'shipped', '2026-04-20T11:00:00Z', '2026-04-20T11:05:00Z', '2026-04-21T08:00:00Z');
  insertItem.run('ORD20260420001', 'BK002', 1, 89.00);

  db.prepare(`
    INSERT INTO refunds (refund_no, order_no, user_id, reason, status, refund_amount, created_at, processed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('RF20260425001', 'ORD20260420001', 'U003', '买错了，想要 Python 相关的书', 'approved', 89.00, '2026-04-25T10:00:00Z', '2026-04-26T09:00:00Z');

  console.log('[BusinessDB] 种子订单和退款数据已插入（alice 7笔 / bob 2笔 / carol 1笔，含1条退款）');
}

// ============= 类型定义 =============

export interface BizUser {
  id: number;
  user_id: string;
  username: string;
  password_hash: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface Book {
  id: number;
  book_id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  price: number;
  stock: number;
  category: string | null;
  description: string | null;
  created_at: string;
}

export interface Order {
  id: number;
  order_no: string;
  user_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

export interface OrderItem {
  id: number;
  order_no: string;
  book_id: string;
  quantity: number;
  unit_price: number;
}

export interface Refund {
  id: number;
  refund_no: string;
  order_no: string;
  user_id: string;
  reason: string | null;
  status: string;
  refund_amount: number;
  created_at: string;
  processed_at: string | null;
}

// ============= 用户操作 =============

export function findUserByUsername(username: string): BizUser | undefined {
  return db.prepare('SELECT * FROM biz_users WHERE username = ?').get(username) as BizUser | undefined;
}

export function findUserByUserId(userId: string): BizUser | undefined {
  return db.prepare('SELECT * FROM biz_users WHERE user_id = ?').get(userId) as BizUser | undefined;
}

export function createUser(data: {
  user_id: string;
  username: string;
  password: string;
  email?: string;
  phone?: string;
}): BizUser {
  const password_hash = bcrypt.hashSync(data.password, 10);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO biz_users (user_id, username, password_hash, email, phone, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.user_id, data.username, password_hash, data.email || null, data.phone || null, now);
  return findUserByUserId(data.user_id)!;
}

export function verifyPassword(user: BizUser, password: string): boolean {
  return bcrypt.compareSync(password, user.password_hash);
}

// ============= 书籍操作 =============

export function searchBooks(keyword: string): Book[] {
  const q = `%${keyword}%`;
  return db.prepare(`
    SELECT * FROM books
    WHERE title LIKE ? OR author LIKE ? OR category LIKE ? OR description LIKE ?
    ORDER BY stock DESC
  `).all(q, q, q, q) as Book[];
}

export function getBookById(bookId: string): Book | undefined {
  return db.prepare('SELECT * FROM books WHERE book_id = ?').get(bookId) as Book | undefined;
}

export function getAllBooks(): Book[] {
  return db.prepare('SELECT * FROM books ORDER BY category, title').all() as Book[];
}

export function getBooksByCategory(category: string): Book[] {
  return db.prepare('SELECT * FROM books WHERE category = ? ORDER BY title').all(category) as Book[];
}

// ============= Embedding 向量操作 =============

/** 获取所有已有 embedding 的书籍（用于批量检测初始化状态） */
export function getBooksWithoutEmbedding(): Book[] {
  return db.prepare('SELECT * FROM books WHERE embedding IS NULL').all() as Book[];
}

/** 获取所有书籍的 embedding（用于语义检索时的向量计算） */
export function getAllBookEmbeddings(): (Book & { embedding_vec: Float32Array })[] {
  const rows = db.prepare('SELECT * FROM books WHERE embedding IS NOT NULL').all() as (Book & { embedding: Buffer })[];
  return rows.map(b => ({
    ...b,
    embedding_vec: deserializeEmbedding(b.embedding),
  }));
}

/** 保存书籍的 embedding 向量 */
export function saveBookEmbedding(bookId: string, emb: Float32Array): void {
  db.prepare('UPDATE books SET embedding = ? WHERE book_id = ?').run(serializeEmbedding(emb), bookId);
}

// ============= FTS5 全文检索 =============

/** FTS5 全文检索，返回带 BM25 分数的书籍列表 */
export function searchBooksFTS5(keyword: string): (Book & { _score: number })[] {
  if (!keyword.trim()) return [];

  // 对查询词做同样的 CJK 预处理
  const preprocessed = cjkPreprocess(keyword);
  if (!preprocessed) return [];

  try {
    return db.prepare(`
      SELECT b.*, rank as _score
      FROM books_fts f
      JOIN books b ON b.id = f.rowid
      WHERE books_fts MATCH ?
        AND b.embedding IS NOT NULL
      ORDER BY rank
      LIMIT 10
    `).all(preprocessed) as (Book & { _score: number })[];
  } catch {
    return [];
  }
}

// ============= 语义向量检索 =============

/** 基于 embedding 余弦相似度检索 Top-K 书籍 */
export function searchBooksSemantic(queryEmbedding: Float32Array, topK: number = 5): (Book & { _score: number })[] {
  const books = getAllBookEmbeddings();
  if (books.length === 0) return [];

  const scored = books.map(b => ({
    ...b,
    _score: cosineSimilarity(queryEmbedding, b.embedding_vec),
  }));

  return scored
    .sort((a, b) => b._score - a._score)
    .slice(0, topK)
    .map(({ embedding_vec, embedding, ...rest }) => rest);
}

// ============= 混合检索（FTS5 + Embedding） =============

export interface HybridSearchResult extends Book {
  _score: number;
  _source: 'fts5' | 'embedding' | 'both';
}

/**
 * 混合检索：融合 FTS5 全文匹配和 Embedding 语义匹配
 * - queryEmbedding: 用户查询的 embedding 向量（未提供时纯 FTS5）
 * - keyword: 用户原始查询关键词（可能为空）
 * - topK: 返回结果数
 */
export function searchBooksHybrid(
  keyword: string,
  queryEmbedding?: Float32Array,
  topK: number = 5
): HybridSearchResult[] {
  // 用于去重的 map
  const resultMap = new Map<string, HybridSearchResult>();
  const MAX_FTS5_SCORE = 100; // FTS5 rank 归一化常数（rank 越小越好，范围约 -10 到 0）

  // 第一路：FTS5 关键词匹配
  if (keyword.trim()) {
    const fts5Results = searchBooksFTS5(keyword);
    for (const b of fts5Results) {
      // FTS5 rank 越小分数越高，归一化到 0-1
      const normalizedScore = Math.min(1, Math.max(0, (MAX_FTS5_SCORE + b._score) / MAX_FTS5_SCORE));
      resultMap.set(b.book_id, {
        ...b,
        _score: normalizedScore,
        _source: 'fts5',
      });
      delete (resultMap.get(b.book_id) as any)._score_inner;
    }
  }

  // 第二路：Embedding 语义匹配
  if (queryEmbedding) {
    const semResults = searchBooksSemantic(queryEmbedding, topK * 2);
    for (const b of semResults) {
      const existing = resultMap.get(b.book_id);
      if (existing) {
        // 已存在于 FTS5 结果：加权融合（FTS5 占 0.3，Embedding 占 0.7）
        existing._score = existing._score * 0.3 + b._score * 0.7;
        existing._source = 'both';
      } else {
        resultMap.set(b.book_id, {
          ...b,
          _score: b._score,
          _source: 'embedding',
        });
      }
    }
  }

  // 排序、截断、返回
  return [...resultMap.values()]
    .sort((a, b) => b._score - a._score)
    .slice(0, topK);
}

// ============= 订单操作 =============

export function getOrdersByUserId(userId: string): (Order & { items: (OrderItem & { book: Book })[] })[] {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Order[];
  return orders.map(order => buildOrderWithItems(order));
}

export function getOrderById(orderNo: string, userId?: string): (Order & { items: (OrderItem & { book: Book })[] }) | undefined {
  let order: Order | undefined;
  if (userId) {
    order = db.prepare('SELECT * FROM orders WHERE order_no = ? AND user_id = ?').get(orderNo, userId) as Order | undefined;
  } else {
    order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo) as Order | undefined;
  }
  if (!order) return undefined;

  return buildOrderWithItems(order);
}

// 获取用户最近 N 天内的订单（排除 pending/cancelled/refunding 状态，用于退款卡片）
// 同时排除已存在退款记录的订单（双重防护）
// 默认查询 15 天内，区分 7 天内（无理由免填）和 7-15 天（需填理由）
export function getRecentOrdersByUserId(userId: string, days: number = 15): (Order & { items: (OrderItem & { book: Book })[] } & { is_within_7days: boolean })[] {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();

  // 排除：pending、cancelled、refunding 状态
  // 排除：已存在退款申请的订单（通过 LEFT JOIN refunds 双重保险）
  const orders = db.prepare(`
    SELECT o.* FROM orders o
    LEFT JOIN refunds r ON r.order_no = o.order_no
    WHERE o.user_id = ?
      AND o.created_at >= ?
      AND o.status NOT IN ('pending', 'cancelled', 'refunding')
      AND r.order_no IS NULL
    ORDER BY o.created_at DESC
  `).all(userId, sinceIso) as Order[];

  return orders.map(order => ({
    ...buildOrderWithItems(order),
    is_within_7days: order.created_at >= sevenDaysAgoIso,
  }));
}

// 构建订单+明细+书籍的完整结构
function buildOrderWithItems(order: Order): Order & { items: (OrderItem & { book: Book })[] } {
  const items = db.prepare(`
    SELECT oi.*, b.* FROM order_items oi
    JOIN books b ON b.book_id = oi.book_id
    WHERE oi.order_no = ?
  `).all(order.order_no) as any[];

  const mappedItems = items.map(it => ({
    ...it,
    book: {
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
    }
  }));
  return { ...order, items: mappedItems };
}

// ============= 退款操作 =============

export function createRefund(data: {
  order_no: string;
  user_id: string;
  reason: string;
  refund_amount: number;
}): Refund {
  const now = new Date().toISOString();
  const refund_no = `RF${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(`
    INSERT INTO refunds (refund_no, order_no, user_id, reason, status, refund_amount, created_at, processed_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, NULL)
  `).run(refund_no, data.order_no, data.user_id, data.reason, data.refund_amount, now);
  // 同步更新订单状态为 refunding，防止重复退款申请
  db.prepare(`UPDATE orders SET status = 'refunding' WHERE order_no = ?`).run(data.order_no);
  return db.prepare('SELECT * FROM refunds WHERE refund_no = ?').get(refund_no) as Refund;
}

export function getRefundsByUserId(userId: string): Refund[] {
  return db.prepare('SELECT * FROM refunds WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Refund[];
}

export function getRefundByNo(refundNo: string): Refund | undefined {
  return db.prepare('SELECT * FROM refunds WHERE refund_no = ?').get(refundNo) as Refund | undefined;
}

// ============= 统计（供 AI 工具使用） =============

export function getOrderStatusText(status: string): string {
  const map: Record<string, string> = {
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
