const fs = require('fs');
const path = require('path');
let mysql = null;
try { mysql = require('mysql2/promise'); } catch (e) { mysql = null; }

const MYSQL_CONFIG = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '123456',
  database: 'article',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

let pool = null;
let mode = 'json';

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');

// ============= JSON 后备存储（MySQL连不上时自动启用） =============
function readJson(file, init) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(init, null, 2), 'utf-8');
    return JSON.parse(JSON.stringify(init));
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return JSON.parse(JSON.stringify(init));
  }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

const DEFAULT_ARTICLES = [
  // 精彩内容 - 热点卡片
  { id: 1, section: 'hot', sub_type: 'hot_topic', title: '试管婴儿技术全解析：从检查到成功怀孕的完整流程', summary: '全面了解试管婴儿的适应症、治疗流程、费用及成功率，帮助您做出明智的选择。', content: null, image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=ivf%20laboratory%20medical%20embryologist%20professional%20clinic%20hospital&image_size=landscape_16_9', tag_label: 'HOT 热点', tag_color: 'red', location: null, level: null, sort_order: 1, is_hot: 1, extra_tags: null, created_at: '2026-08-01 00:00:00', updated_at: '2026-08-01 00:00:00' },
  { id: 2, section: 'hot', sub_type: 'hot_topic', title: '科学备孕指南：孕前准备、饮食调理、生活习惯全攻略', summary: '孕前3-6个月开始调理，夫妻双方共同准备，提高受孕几率。', content: null, image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=pregnancy%20planning%20medical%20consultation%20couple%20hospital%20professional&image_size=square_hd', tag_label: '备孕', tag_color: 'blue', location: null, level: null, sort_order: 2, is_hot: 1, extra_tags: null, created_at: '2026-08-01 00:00:00', updated_at: '2026-08-01 00:00:00' },
  { id: 3, section: 'hot', sub_type: 'hot_topic', title: '不孕不育的常见原因与科学治疗方案解读', summary: '男女双方因素各占约40%，不明原因约20%，建议夫妻同诊同治。', content: null, image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=infertility%20medical%20clinic%20doctor%20consultation%20professional%20hospital&image_size=square_hd', tag_label: '不孕不育', tag_color: 'blue', location: null, level: null, sort_order: 3, is_hot: 1, extra_tags: null, created_at: '2026-08-01 00:00:00', updated_at: '2026-08-01 00:00:00' },
  // 精彩内容 - 文章
  { id: 10, section: 'hot', sub_type: 'article', title: '女性最佳生育年龄是多少？高龄备孕注意事项', summary: '发布时间 2026-08-08', tag_label: '备孕', tag_color: 'blue', sort_order: 1 },
  { id: 11, section: 'hot', sub_type: 'article', title: '精子质量差怎么办？提高精子活力的方法', summary: '发布时间 2026-08-07', tag_label: '男性健康', tag_color: 'blue', sort_order: 2 },
  { id: 12, section: 'hot', sub_type: 'article', title: '多囊卵巢综合征能自然怀孕吗？治疗方法介绍', summary: '发布时间 2026-08-06', tag_label: '妇科', tag_color: 'green', sort_order: 3 },
  { id: 13, section: 'hot', sub_type: 'article', title: '输卵管堵塞的症状有哪些？检查方法详解', summary: '发布时间 2026-08-05', tag_label: '输卵管', tag_color: 'orange', sort_order: 4 },
  { id: 14, section: 'hot', sub_type: 'article', title: '人工授精和试管婴儿的区别 适应症对比', summary: '发布时间 2026-08-04', tag_label: '人工授精', tag_color: 'purple', sort_order: 5 },
  { id: 15, section: 'hot', sub_type: 'article', title: '孕期产检时间表 各个阶段检查项目汇总', summary: '发布时间 2026-08-03', tag_label: '孕期', tag_color: 'blue', sort_order: 6 },
  { id: 16, section: 'hot', sub_type: 'article', title: '月经不调影响怀孕吗？调经助孕的方法', summary: '发布时间 2026-08-02', tag_label: '内分泌', tag_color: 'blue', sort_order: 7 },
  { id: 17, section: 'hot', sub_type: 'article', title: '孕前检查项目清单 男女双方检查大全', summary: '发布时间 2026-08-01', tag_label: '优生优育', tag_color: 'green', sort_order: 8 },
  // 科室
  { id: 30, section: 'department', sub_type: '生殖医学中心', title: '生殖医学中心', summary: '试管婴儿、人工授精、不孕不育诊疗、胚胎培养技术', tag_label: '👩‍⚕️', tag_color: 'pink', sort_order: 1 },
  { id: 31, section: 'department', sub_type: '男科', title: '男科', summary: '男性不育症、少弱精症、精索静脉曲张、性功能障碍', tag_label: '👨‍⚕️', tag_color: 'blue', sort_order: 2 },
  { id: 32, section: 'department', sub_type: '妇科', title: '妇科', summary: '子宫肌瘤、卵巢囊肿、子宫内膜异位症、妇科炎症', tag_label: '🏥', tag_color: 'green', sort_order: 3 },
  { id: 33, section: 'department', sub_type: '内分泌科', title: '内分泌科', summary: '多囊卵巢、月经不调、排卵障碍、甲状腺疾病', tag_label: '🔬', tag_color: 'orange', sort_order: 4 },
  { id: 34, section: 'department', sub_type: '中医科', title: '中医科', summary: '中医调理备孕、调经助孕、胎停育调理、体质调养', tag_label: '💊', tag_color: 'purple', sort_order: 5 },
  { id: 35, section: 'department', sub_type: '遗传咨询科', title: '遗传咨询科', summary: '染色体检查、遗传病筛查、产前诊断、优生咨询', tag_label: '🧬', tag_color: 'red', sort_order: 6 },
  { id: 36, section: 'department', sub_type: '检验科', title: '检验科', summary: '精液分析、激素六项、染色体检测、免疫抗体检查', tag_label: '🧪', tag_color: 'cyan', sort_order: 7 },
  { id: 37, section: 'department', sub_type: '产前诊断中心', title: '产前诊断中心', summary: '唐氏筛查、无创DNA、羊水穿刺、超声排畸检查', tag_label: '❤️', tag_color: 'yellow', sort_order: 8 },
  // 医院
  { id: 60, section: 'hospital', sub_type: '综合三甲', title: '北京协和医院生殖医学中心', summary: '', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=beijing%20union%20medical%20college%20hospital%20exterior%20modern&image_size=landscape_4_3', location: '北京市东城区', level: '三级甲等', sort_order: 1, extra_tags: '国家重点学科,试管成功率高' },
  { id: 61, section: 'hospital', sub_type: '综合三甲', title: '北京大学第三医院生殖医学中心', summary: '', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=peking%20university%20third%20hospital%20modern%20medical%20center&image_size=landscape_4_3', location: '北京市海淀区', level: '三级甲等', sort_order: 2, extra_tags: '中国大陆首例试管,国际先进水平' },
  { id: 62, section: 'hospital', sub_type: '综合三甲', title: '上海瑞金医院生殖医学中心', summary: '', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=shanghai%20ruijin%20hospital%20modern%20building%20medical&image_size=landscape_4_3', location: '上海市黄浦区', level: '三级甲等', sort_order: 3, extra_tags: '综合实力强,专家团队' },
  { id: 63, section: 'hospital', sub_type: '综合三甲', title: '广州中山一院生殖医学中心', summary: '', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=guangzhou%20sun%20yat-sen%20university%20hospital%20medical&image_size=landscape_4_3', location: '广州市越秀区', level: '三级甲等', sort_order: 4, extra_tags: '华南地区领先,技术精湛' },
  { id: 64, section: 'hospital', sub_type: '专科三甲', title: '华西第二医院生殖医学中心', summary: '', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=chengdu%20huaxi%20second%20hospital%20modern%20womens%20hospital&image_size=landscape_4_3', location: '成都市锦江区', level: '三级甲等', sort_order: 5, extra_tags: '西南地区首选,学科齐全' },
  { id: 65, section: 'hospital', sub_type: '专科三甲', title: '浙江大学医学院附属妇产科医院', summary: '', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=zhejiang%20university%20womens%20hospital%20modern%20medical&image_size=landscape_4_3', location: '杭州市上城区', level: '三级甲等', sort_order: 6, extra_tags: '华东地区知名,服务优质' },
];

function ensureArticlesInit() {
  const d = readJson(ARTICLES_FILE, { articles: [], nextId: 1 });
  if (!d.articles || d.articles.length === 0) {
    const maxId = Math.max(...DEFAULT_ARTICLES.map(a => a.id || 0), 0);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    d.articles = DEFAULT_ARTICLES.map(a => Object.assign({ created_at: now, updated_at: now }, a));
    d.nextId = maxId + 1;
    writeJson(ARTICLES_FILE, d);
  }
  return d;
}

// ============= 模式选择 =============
async function testConnection() {
  if (!mysql) {
    console.log('mysql2 模块未安装，使用 JSON 文件存储模式');
    mode = 'json';
    ensureArticlesInit();
    return false;
  }
  try {
    pool = mysql.createPool(MYSQL_CONFIG);
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    mode = 'mysql';
    console.log('✅ MySQL 数据库连接成功：article');
    return true;
  } catch (e) {
    console.log('⚠️  MySQL 连接失败：', e.message.split('\n')[0]);
    console.log('   自动切换为 JSON 文件存储模式（可正常访问网站）');
    console.log('   如需启用MySQL，请编辑 database.js 第 7-16 行的连接配置');
    if (pool) { try { await pool.end(); } catch (_) {} pool = null; }
    mode = 'json';
    ensureArticlesInit();
    return false;
  }
}

// ============= Customers =============
async function addCustomer(name, gender, phone, createTime) {
  if (mode === 'mysql') {
    const [result] = await pool.execute(
      'INSERT INTO customers (name, gender, phone, create_time) VALUES (?, ?, ?, ?)',
      [name, gender, phone, createTime]
    );
    return result.insertId;
  } else {
    const d = readJson(CUSTOMERS_FILE, { customers: [], nextId: 1 });
    const id = d.nextId;
    d.customers.push({ id, name, gender, phone, create_time: createTime });
    d.nextId = id + 1;
    writeJson(CUSTOMERS_FILE, d);
    return id;
  }
}
async function getAllCustomers() {
  if (mode === 'mysql') {
    const [rows] = await pool.execute('SELECT * FROM customers ORDER BY create_time DESC');
    return rows;
  } else {
    const d = readJson(CUSTOMERS_FILE, { customers: [], nextId: 1 });
    return d.customers.slice().sort((a, b) => new Date(b.create_time) - new Date(a.create_time));
  }
}

// ============= Articles =============
async function getArticlesBySection(section) {
  if (mode === 'mysql') {
    const [rows] = await pool.execute(
      'SELECT * FROM articles WHERE section = ? ORDER BY sort_order ASC, id ASC',
      [section]
    );
    return rows;
  } else {
    const d = ensureArticlesInit();
    return d.articles
      .filter(a => a.section === section)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id);
  }
}
async function getAllArticles() {
  if (mode === 'mysql') {
    const [rows] = await pool.execute(
      'SELECT * FROM articles ORDER BY section ASC, sort_order ASC, id ASC'
    );
    return rows;
  } else {
    const d = ensureArticlesInit();
    const secOrder = { hot: 1, department: 2, hospital: 3 };
    return d.articles.slice().sort((a, b) => {
      return (secOrder[a.section] || 0) - (secOrder[b.section] || 0)
        || (a.sort_order || 0) - (b.sort_order || 0)
        || a.id - b.id;
    });
  }
}
async function getArticleById(id) {
  id = Number(id);
  if (mode === 'mysql') {
    const [rows] = await pool.execute('SELECT * FROM articles WHERE id = ?', [id]);
    return rows[0] || null;
  } else {
    const d = ensureArticlesInit();
    return d.articles.find(a => a.id === id) || null;
  }
}
function normFields(data) {
  const out = {};
  const allowed = ['section', 'sub_type', 'title', 'summary', 'content', 'image_url',
    'tag_label', 'tag_color', 'location', 'level', 'sort_order', 'is_hot', 'extra_tags'];
  for (const k of allowed) {
    if (data[k] === undefined) continue;
    out[k] = (data[k] === '' || data[k] === null) ? null : data[k];
  }
  if (out.sort_order === undefined) out.sort_order = 0;
  if (out.sort_order !== null) out.sort_order = Number(out.sort_order) || 0;
  if (out.is_hot !== undefined) out.is_hot = out.is_hot ? 1 : 0;
  return out;
}
async function createArticle(data) {
  const clean = normFields(data);
  if (!clean.section || !clean.title) throw new Error('section和title必填');
  if (mode === 'mysql') {
    const keys = Object.keys(clean);
    const sql = `INSERT INTO articles (${keys.join(', ')}, created_at, updated_at) VALUES (${keys.map(()=>'?').join(', ')}, NOW(), NOW())`;
    const [result] = await pool.execute(sql, keys.map(k => clean[k]));
    return result.insertId;
  } else {
    const d = ensureArticlesInit();
    const id = d.nextId;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    d.articles.push(Object.assign({ id, created_at: now, updated_at: now }, clean));
    d.nextId = id + 1;
    writeJson(ARTICLES_FILE, d);
    return id;
  }
}
async function updateArticle(id, data) {
  id = Number(id);
  const clean = normFields(data);
  if (mode === 'mysql') {
    const [check] = await pool.execute('SELECT id FROM articles WHERE id = ? LIMIT 1', [id]);
    if (!check || check.length === 0) return 0;
    const keys = Object.keys(clean);
    if (keys.length === 0) return 1;
    keys.push('updated_at');
    const values = keys.map(k => k === 'updated_at' ? null : clean[k]);
    values.push(id);
    const sql = `UPDATE articles SET ${keys.map(k => k + (k === 'updated_at' ? ' = NOW()' : ' = ?')).join(', ')} WHERE id = ?`;
    await pool.execute(sql, values);
    return 1;
  } else {
    const d = ensureArticlesInit();
    const a = d.articles.find(x => x.id === id);
    if (!a) return 0;
    for (const k of Object.keys(clean)) a[k] = clean[k];
    a.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
    writeJson(ARTICLES_FILE, d);
    return 1;
  }
}
async function deleteArticle(id) {
  id = Number(id);
  if (mode === 'mysql') {
    const [check] = await pool.execute('SELECT id FROM articles WHERE id = ? LIMIT 1', [id]);
    if (!check || check.length === 0) return 0;
    await pool.execute('DELETE FROM articles WHERE id = ?', [id]);
    return 1;
  } else {
    const d = ensureArticlesInit();
    const before = d.articles.length;
    d.articles = d.articles.filter(a => a.id !== id);
    if (d.articles.length === before) return 0;
    writeJson(ARTICLES_FILE, d);
    return 1;
  }
}

module.exports = {
  MYSQL_CONFIG,
  testConnection,
  addCustomer,
  getAllCustomers,
  getArticlesBySection,
  getAllArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle
};
