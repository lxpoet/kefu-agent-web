/**
 * 增量数据填充脚本
 * 用途：在不删除现有 business.db 的前提下，追加新书籍和 alice 的近期订单
 * 运行：npx tsx scripts/seed-extra.ts
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'business.db');

console.log(`[SeedExtra] 打开数据库: ${dbPath}`);
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// ============= 新书籍数据 =============
// 仅追加种子数据中不存在的书（BK016-BK040）
const extraBooks: [string, string, string, string, number, number, string, string][] = [
  // 技术
  ['BK016', 'Rust 程序设计', 'Steve Klabnik', '电子工业出版社', 99.00, 25, '技术', 'Rust 官方团队核心成员编写，系统讲解 Rust 所有权、生命周期和并发模型。'],
  // 文学
  ['BK017', '红楼梦', '曹雪芹', '人民文学出版社', 78.00, 100, '文学', '中国古典四大名著之首，以贾宝玉和林黛玉的爱情悲剧为主线，展现封建社会的衰落。'],
  ['BK018', '1984', '乔治·奥威尔', '上海译文出版社', 36.00, 85, '文学', '反乌托邦经典之作，"老大哥在看着你"，对极权主义的深刻批判。'],
  ['BK019', '挪威的森林', '村上春树', '上海译文出版社', 39.00, 110, '文学', '村上春树代表作，一段关于青春、爱情与死亡的动人故事。'],
  // 科幻
  ['BK020', '银河帝国：基地', '艾萨克·阿西莫夫', '江苏文艺出版社', 45.00, 65, '科幻', '科幻史上最伟大的系列开篇，哈里·谢顿创立心理史学，预言银河帝国的灭亡。'],
  ['BK021', '沙丘', '弗兰克·赫伯特', '江苏凤凰文艺出版社', 68.00, 55, '科幻', '史诗级科幻巨著，沙漠星球厄拉科斯上的权力斗争与生态寓言。'],
  ['BK022', '流浪地球', '刘慈欣', '四川科学技术出版社', 32.00, 90, '科幻', '刘慈欣短篇代表作，太阳即将毁灭，人类带着地球去流浪。'],
  ['BK023', '你一生的故事', '特德·姜', '译林出版社', 38.00, 60, '科幻', '降临原作，语言学与物理学交织的科幻杰作，探讨自由意志与宿命。'],
  ['BK024', '神经漫游者', '威廉·吉布森', '江苏教育出版社', 42.00, 40, '科幻', '赛博朋克开山之作，定义了网络空间的概念，影响了《黑客帝国》等无数作品。'],
  // 社科
  ['BK025', '乌合之众', '古斯塔夫·勒庞', '中央编译出版社', 29.00, 80, '社科', '群体心理学经典，剖析群体行为的非理性特征及其对社会的影响。'],
  ['BK026', '枪炮、病菌与钢铁', '贾雷德·戴蒙德', '中信出版社', 62.00, 45, '社科', '普利策奖获奖作品，解释不同大陆文明发展差异的深层原因。'],
  ['BK027', '思考，快与慢', '丹尼尔·卡尼曼', '中信出版社', 58.00, 70, '社科', '诺贝尔经济学奖得主著作，揭示人类思维的系统1和系统2运作机制。'],
  // 商业
  ['BK028', '原则', '瑞·达利欧', '中信出版社', 69.00, 55, '商业', '桥水基金创始人的生活和工作原则，时间检验的成功法则。'],
  ['BK029', '从0到1', '彼得·蒂尔', '中信出版社', 42.00, 75, '商业', 'PayPal创始人的创业哲学，如何建立垄断性企业的全新思考。'],
  ['BK030', '精益创业', '埃里克·莱斯', '中信出版社', 49.00, 65, '商业', '最小可行产品（MVP）方法论，现代互联网创业的圣经。'],
  ['BK031', '创新者的窘境', '克莱顿·克里斯坦森', '中信出版社', 56.00, 50, '商业', '颠覆性创新理论的奠基之作，解释领先企业为何会被后来者打败。'],
  // 哲学
  ['BK032', '苏菲的世界', '乔斯坦·贾德', '作家出版社', 38.00, 90, '哲学', '以小说形式讲述西方哲学史，从苏格拉底到萨特的智慧之旅。'],
  ['BK033', '存在与时间', '海德格尔', '商务印书馆', 88.00, 20, '哲学', '20世纪最重要哲学著作之一，探讨"此在"与存在的意义。'],
  ['BK034', '中国哲学简史', '冯友兰', '北京大学出版社', 48.00, 60, '哲学', '中国哲学入门经典，系统梳理先秦诸子到近代哲学的发展脉络。'],
  // 历史
  ['BK035', '万历十五年', '黄仁宇', '生活·读书·新知三联书店', 42.00, 85, '历史', '以万历十五年为切入点，揭示明朝官僚体制的深层问题。'],
  ['BK036', '明朝那些事儿（全集）', '当年明月', '浙江人民出版社', 128.00, 120, '历史', '以幽默通俗的语言讲述明朝三百年的兴衰，让历史不再枯燥。'],
  ['BK037', '全球通史', '斯塔夫里阿诺斯', '北京大学出版社', 98.00, 40, '历史', '全球视野下的文明发展史，打破欧洲中心论的历史观念。'],
  // 心理
  ['BK038', '被讨厌的勇气', '岸见一郎/古贺史健', '机械工业出版社', 42.00, 95, '心理', '阿德勒心理学通俗读物，教会我们如何获得真正的自由和幸福。'],
  ['BK039', '自卑与超越', '阿尔弗雷德·阿德勒', '中国友谊出版公司', 36.00, 75, '心理', '个体心理学奠基之作，探讨自卑感的来源及其对人生发展的影响。'],
  ['BK040', '非暴力沟通', '马歇尔·卢森堡', '华夏出版社', 45.00, 100, '心理', '学会用非暴力的方式表达自己、倾听他人，改善人际关系。'],
];

// ============= 插入新书籍 =============
const now = new Date().toISOString();
const insertBook = db.prepare(`
  INSERT OR IGNORE INTO books (book_id, title, author, publisher, price, stock, category, description, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let addedBooks = 0;
const bookIds: string[] = [];

const txBooks = db.transaction(() => {
  for (const b of extraBooks) {
    const info = insertBook.run(...b, now);
    if (info.changes > 0) {
      addedBooks++;
      bookIds.push(b[0]);
    }
  }
});
txBooks();
console.log(`[SeedExtra] ✅ 新增 ${addedBooks} 本书籍（共 25 本待追加，已跳过重复）`);

// ============= 同步 FTS5 索引（仅新增的书籍） =============
if (addedBooks > 0) {
  const syncFts = db.prepare(`
    INSERT OR IGNORE INTO books_fts (rowid, title, author, publisher, category, description)
    SELECT b.id, b.title, b.author, b.publisher, b.category, b.description
    FROM books b WHERE b.book_id IN (${bookIds.map(() => '?').join(',')})
  `);
  syncFts.run(...bookIds);
  console.log(`[SeedExtra] ✅ FTS5 索引已同步 ${addedBooks} 条`);
}

// ============= alice 的新订单 =============
const insertOrder = db.prepare(`
  INSERT OR IGNORE INTO orders (order_no, user_id, total_amount, status, created_at, paid_at, shipped_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertItem = db.prepare(`
  INSERT OR IGNORE INTO order_items (order_no, book_id, quantity, unit_price)
  VALUES (?, ?, ?, ?)
`);

type OrderDef = {
  orderNo: string;
  status: string;
  total: number;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  items: [string, number, number][];
};

const aliceOrders: OrderDef[] = [
  {
    orderNo: 'ORD20260515001', status: 'completed', total: 138.00,
    createdAt: '2026-05-15T09:30:00Z', paidAt: '2026-05-15T09:35:00Z', shippedAt: '2026-05-16T10:00:00Z',
    items: [['BK020', 1, 45.00], ['BK004', 1, 93.00]],
  },
  {
    orderNo: 'ORD20260603001', status: 'shipped', total: 93.00,
    createdAt: '2026-06-03T15:00:00Z', paidAt: '2026-06-03T15:02:00Z', shippedAt: '2026-06-04T08:00:00Z',
    items: [['BK004', 1, 93.00]],
  },
  {
    orderNo: 'ORD20260615001', status: 'shipped', total: 205.00,
    createdAt: '2026-06-15T11:00:00Z', paidAt: '2026-06-15T11:03:00Z', shippedAt: '2026-06-16T09:00:00Z',
    items: [['BK021', 1, 68.00], ['BK022', 1, 32.00], ['BK005', 3, 35.00]],
  },
  {
    orderNo: 'ORD20260622001', status: 'pending', total: 80.00,
    createdAt: '2026-06-22T20:15:00Z', paidAt: null, shippedAt: null,
    items: [['BK009', 1, 38.00], ['BK012', 1, 42.00]],
  },
  {
    orderNo: 'ORD20260625001', status: 'paid', total: 111.00,
    createdAt: '2026-06-25T18:30:00Z', paidAt: '2026-06-25T18:32:00Z', shippedAt: null,
    items: [['BK035', 1, 42.00], ['BK028', 1, 69.00]],
  },
];

let addedOrders = 0;
const txOrders = db.transaction(() => {
  for (const o of aliceOrders) {
    const info = insertOrder.run(o.orderNo, 'U001', o.total, o.status, o.createdAt, o.paidAt, o.shippedAt);
    if (info.changes > 0) {
      addedOrders++;
      for (const [bookId, qty, price] of o.items) {
        insertItem.run(o.orderNo, bookId, qty, price);
      }
    }
  }
});
txOrders();
console.log(`[SeedExtra] ✅ 新增 ${addedOrders} 笔 alice 订单（共 5 笔待追加，已跳过重复）`);

// ============= 最终统计 =============
const bookCount = db.prepare('SELECT COUNT(*) as c FROM books').get() as { c: number };
const orderCount = db.prepare('SELECT COUNT(*) as c FROM orders').get() as { c: number };
const aliceOrderCount = db.prepare('SELECT COUNT(*) as c FROM orders WHERE user_id = ?').get('U001') as { c: number };
const categoryStats = db.prepare('SELECT category, COUNT(*) as c FROM books GROUP BY category ORDER BY c DESC').all() as { category: string; c: number }[];

console.log(`\n[SeedExtra] 📊 最终统计：`);
console.log(`  书籍总数：${bookCount.c} 本`);
console.log(`  订单总数：${orderCount.c} 笔（alice: ${aliceOrderCount.c} 笔）`);
console.log(`  分类分布：`);
categoryStats.forEach((r) => console.log(`    ${r.category}: ${r.c} 本`));

db.close();
console.log(`\n[SeedExtra] 🎉 数据填充完成！`);
