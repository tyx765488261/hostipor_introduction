const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  testConnection,
  addCustomer,
  getAllCustomers,
  getArticlesBySection,
  getAllArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  normFields
} = require('./database');

let multer = null;
try { multer = require('multer'); } catch (e) { multer = null; }

const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const DEFAULT_PORT = 8080;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

const ALLOWED_EXT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' };
let upload = null;
if (multer) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const rand = crypto.randomBytes(12).toString('hex');
      const ts = Date.now();
      cb(null, `img_${ts}_${rand}${ext}`);
    }
  });
  upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ALLOWED_EXT[ext]) cb(null, true);
      else cb(new Error('仅支持 jpg/png/gif/webp/bmp 格式图片，单个文件≤8MB'));
    }
  });
}

app.post('/api/upload', (req, res) => {
  if (!upload) {
    return res.status(500).json({ success: false, message: 'multer 未安装，请先执行 npm install multer' });
  }
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || '上传失败' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要上传的文件' });
    }
    const url = '/uploads/' + req.file.filename;
    res.json({ success: true, url, filename: req.file.filename, size: req.file.size });
  });
});

const SECTION_MAP = {
  hot: '精彩内容',
  department: '热门推荐（科室）',
  hospital: '医院推荐'
};

const presetAnswers = {
  '不孕': '不孕症是指夫妻在未采取避孕措施，性生活正常，经过12个月以上未能成功妊娠。女性不孕常见原因包括：排卵障碍、输卵管堵塞、子宫内膜异位症等。建议您到正规生殖医院进行全面检查，明确病因后对症治疗。',
  '不育': '男性不育是指夫妇同居未采取避孕措施两年以上，女方检查正常，男方检查异常而致女方不能怀孕。常见原因包括：精子数量少、精子活力低、精子畸形率高等。建议进行精液常规检查、内分泌检查等。',
  '试管婴儿': '试管婴儿即体外受精-胚胎移植技术（IVF-ET），是指将卵子和精子取出体外，在培养液中使其受精，然后将胚胎移植回母体子宫内发育成胎儿的过程。适用于输卵管堵塞、严重少弱精症等患者。成功率一般在40%-50%左右。',
  '人工授精': '人工授精是将精子通过非性交方式注入女性生殖道内，使其受孕的一种技术。适用于男性少弱精、性功能障碍，女性宫颈因素不孕等。分为丈夫精液人工授精（AIH）和供精人工授精（AID）。',
  '多囊卵巢': '多囊卵巢综合征（PCOS）是一种常见的内分泌代谢疾病，主要表现为月经不调、多毛、肥胖、不孕等。治疗方法包括：调整生活方式、药物调节月经周期、促排卵治疗等。',
  '输卵管': '输卵管堵塞是女性不孕的常见原因之一。常见检查方法包括：输卵管通液术、子宫输卵管造影术（HSG）、腹腔镜检查等。治疗方法包括：输卵管通液治疗、手术治疗等，严重者可考虑试管婴儿。',
  '精子': '精子质量是影响受孕的重要因素。正常精子标准：精液量2-6ml，精子浓度≥1500万/ml，前向运动精子≥32%，正常形态精子≥4%。建议禁欲3-7天进行精液检查。',
  '月经': '月经不调是指月经周期、经期、经量等方面的异常。可能影响排卵从而导致不孕。常见原因包括：内分泌紊乱、子宫肌瘤、子宫内膜异位症等。建议进行激素六项检查明确诊断。',
  '孕前': '孕前检查非常重要，建议夫妻双方在计划怀孕前3-6个月进行。检查项目包括：血常规、尿常规、肝肾功能、传染病筛查、遗传病筛查、生殖系统检查等。',
  '怀孕': '备孕期间建议：保持良好的生活习惯，戒烟戒酒，规律作息，均衡饮食，适当运动，保持心情舒畅。女性建议提前3个月补充叶酸。排卵期同房可提高受孕几率。'
};

app.post('/api/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || question.trim() === '') {
      return res.json({ answer: '请输入您的问题，我将为您解答相关问题。' });
    }
    let answer = null;
    for (const keyword in presetAnswers) {
      if (question.includes(keyword)) {
        answer = presetAnswers[keyword];
        break;
      }
    }
    if (!answer) {
      try {
        const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(question + ' 生殖健康 医疗')}`;
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 5000
        });
        const $ = cheerio.load(response.data);
        const content = $('.result-op, .result').first().text().trim();
        if (content && content.length > 50) {
          answer = content.substring(0, 300) + '... (信息仅供参考，建议您咨询专业医生获取更详细的建议。';
        }
      } catch (searchError) {
        console.error('Search error:', searchError.message);
      }
    }
    if (!answer) {
      answer = `关于「${question}」相关问题，建议您到正规生殖医院进行咨询检查。生殖医学中心拥有专业的医疗团队和先进的医疗设备，可以为您提供个性化的诊疗方案。您也可以填写下方的表单，我们的专业人员会尽快与您联系。`;
    }
    res.json({ answer });
  } catch (error) {
    console.error('Ask API error:', error);
    res.status(500).json({ error: '服务器处理请求时出错' });
  }
});

app.post('/api/customer', async (req, res) => {
  try {
    const { name, gender, phone } = req.body;
    if (!name || !gender || !phone) {
      return res.status(400).json({ success: false, message: '请填写完整信息' });
    }
    const nameRegex = /^[\u4e00-\u9fa5a-zA-Z]{2,20}$/;
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!nameRegex.test(name)) {
      return res.status(400).json({ success: false, message: '姓名格式不正确（2-20个字符）' });
    }
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: '请输入正确的手机号码' });
    }
    if (gender !== '男' && gender !== '女') {
      return res.status(400).json({ success: false, message: '请选择性别' });
    }
    const createTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const id = await addCustomer(name, gender, phone, createTime);
    res.json({ success: true, message: '提交成功，我们的专业人员会尽快与您联系！', id });
  } catch (error) {
    console.error('Customer API error:', error);
    res.status(500).json({ success: false, message: '服务器错误，请稍后重试' });
  }
});

app.get('/api/customers', async (req, res) => {
  try {
    const customers = await getAllCustomers();
    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

app.get('/api/articles', async (req, res) => {
  try {
    const { section } = req.query;
    let data;
    if (section && ['hot', 'department', 'hospital'].includes(section)) {
      data = await getArticlesBySection(section);
    } else {
      data = await getAllArticles();
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get articles error:', error);
    res.status(500).json({ success: false, message: error.message || '服务器错误' });
  }
});

app.post('/api/articles/init-defaults', async (req, res) => {
  try {
    const current = await getAllArticles();
    if (current.length > 0) {
      return res.json({ success: false, message: '数据已存在（共 ' + current.length + ' 条），如需重置请先清空 articles 表' });
    }
    const defaults = [
      { section: 'hot', sub_type: 'hot_topic', title: '试管婴儿技术全解析：从检查到成功怀孕的完整流程', summary: '全面了解试管婴儿的适应症、治疗流程、费用及成功率，帮助您做出明智的选择。', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=ivf%20laboratory%20medical%20embryologist%20professional%20clinic%20hospital&image_size=landscape_16_9', tag_label: 'HOT 热点', tag_color: 'red', sort_order: 1, is_hot: 1 },
      { section: 'hot', sub_type: 'hot_topic', title: '科学备孕指南：孕前准备、饮食调理、生活习惯全攻略', summary: '孕前3-6个月开始调理，夫妻双方共同准备，提高受孕几率。', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=pregnancy%20planning%20medical%20consultation%20couple%20hospital%20professional&image_size=square_hd', tag_label: '备孕', tag_color: 'blue', sort_order: 2, is_hot: 1 },
      { section: 'hot', sub_type: 'hot_topic', title: '不孕不育的常见原因与科学治疗方案解读', summary: '男女双方因素各占约40%，不明原因约20%，建议夫妻同诊同治。', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=infertility%20medical%20clinic%20doctor%20consultation%20professional%20hospital&image_size=square_hd', tag_label: '不孕不育', tag_color: 'blue', sort_order: 3, is_hot: 1 },
      { section: 'hot', sub_type: 'article', title: '女性最佳生育年龄是多少？高龄备孕注意事项', summary: '发布时间 2026-08-08', tag_label: '备孕', tag_color: 'blue', sort_order: 1 },
      { section: 'hot', sub_type: 'article', title: '精子质量差怎么办？提高精子活力的方法', summary: '发布时间 2026-08-07', tag_label: '男性健康', tag_color: 'blue', sort_order: 2 },
      { section: 'hot', sub_type: 'article', title: '多囊卵巢综合征能自然怀孕吗？治疗方法介绍', summary: '发布时间 2026-08-06', tag_label: '妇科', tag_color: 'green', sort_order: 3 },
      { section: 'hot', sub_type: 'article', title: '输卵管堵塞的症状有哪些？检查方法详解', summary: '发布时间 2026-08-05', tag_label: '输卵管', tag_color: 'orange', sort_order: 4 },
      { section: 'hot', sub_type: 'article', title: '人工授精和试管婴儿的区别 适应症对比', summary: '发布时间 2026-08-04', tag_label: '人工授精', tag_color: 'purple', sort_order: 5 },
      { section: 'hot', sub_type: 'article', title: '孕期产检时间表 各个阶段检查项目汇总', summary: '发布时间 2026-08-03', tag_label: '孕期', tag_color: 'blue', sort_order: 6 },
      { section: 'hot', sub_type: 'article', title: '月经不调影响怀孕吗？调经助孕的方法', summary: '发布时间 2026-08-02', tag_label: '内分泌', tag_color: 'blue', sort_order: 7 },
      { section: 'hot', sub_type: 'article', title: '孕前检查项目清单 男女双方检查大全', summary: '发布时间 2026-08-01', tag_label: '优生优育', tag_color: 'green', sort_order: 8 },
      { section: 'department', sub_type: '生殖医学中心', title: '生殖医学中心', summary: '试管婴儿、人工授精、不孕不育诊疗、胚胎培养技术', tag_label: '👩‍⚕️', tag_color: 'pink', sort_order: 1 },
      { section: 'department', sub_type: '男科', title: '男科', summary: '男性不育症、少弱精症、精索静脉曲张、性功能障碍', tag_label: '👨‍⚕️', tag_color: 'blue', sort_order: 2 },
      { section: 'department', sub_type: '妇科', title: '妇科', summary: '子宫肌瘤、卵巢囊肿、子宫内膜异位症、妇科炎症', tag_label: '🏥', tag_color: 'green', sort_order: 3 },
      { section: 'department', sub_type: '内分泌科', title: '内分泌科', summary: '多囊卵巢、月经不调、排卵障碍、甲状腺疾病', tag_label: '🔬', tag_color: 'orange', sort_order: 4 },
      { section: 'department', sub_type: '中医科', title: '中医科', summary: '中医调理备孕、调经助孕、胎停育调理、体质调养', tag_label: '💊', tag_color: 'purple', sort_order: 5 },
      { section: 'department', sub_type: '遗传咨询科', title: '遗传咨询科', summary: '染色体检查、遗传病筛查、产前诊断、优生咨询', tag_label: '🧬', tag_color: 'red', sort_order: 6 },
      { section: 'department', sub_type: '检验科', title: '检验科', summary: '精液分析、激素六项、染色体检测、免疫抗体检查', tag_label: '🧪', tag_color: 'cyan', sort_order: 7 },
      { section: 'department', sub_type: '产前诊断中心', title: '产前诊断中心', summary: '唐氏筛查、无创DNA、羊水穿刺、超声排畸检查', tag_label: '❤️', tag_color: 'yellow', sort_order: 8 },
      { section: 'hospital', sub_type: '综合三甲', title: '北京协和医院生殖医学中心', summary: '国家重点学科，国内生殖医学领域权威机构', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=beijing%20union%20medical%20college%20hospital%20exterior%20modern&image_size=landscape_4_3', location: '北京市东城区', level: '三级甲等', sort_order: 1, extra_tags: '国家重点学科,试管成功率高' },
      { section: 'hospital', sub_type: '综合三甲', title: '北京大学第三医院生殖医学中心', summary: '中国大陆首例试管婴儿诞生地，国际先进水平', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=peking%20university%20third%20hospital%20modern%20medical%20center&image_size=landscape_4_3', location: '北京市海淀区', level: '三级甲等', sort_order: 2, extra_tags: '中国大陆首例试管,国际先进水平' },
      { section: 'hospital', sub_type: '综合三甲', title: '上海瑞金医院生殖医学中心', summary: '上海交通大学医学院附属，综合实力雄厚', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=shanghai%20ruijin%20hospital%20modern%20building%20medical&image_size=landscape_4_3', location: '上海市黄浦区', level: '三级甲等', sort_order: 3, extra_tags: '综合实力强,专家团队' },
      { section: 'hospital', sub_type: '综合三甲', title: '广州中山一院生殖医学中心', summary: '华南地区生殖医学龙头，技术精湛', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=guangzhou%20sun%20yat-sen%20university%20hospital%20medical&image_size=landscape_4_3', location: '广州市越秀区', level: '三级甲等', sort_order: 4, extra_tags: '华南地区领先,技术精湛' },
      { section: 'hospital', sub_type: '专科三甲', title: '华西第二医院生殖医学中心', summary: '四川大学华西附属，西南地区首选', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=chengdu%20huaxi%20second%20hospital%20modern%20womens%20hospital&image_size=landscape_4_3', location: '成都市锦江区', level: '三级甲等', sort_order: 5, extra_tags: '西南地区首选,学科齐全' },
      { section: 'hospital', sub_type: '专科三甲', title: '浙江大学医学院附属妇产科医院', summary: '华东地区知名妇产专科医院，服务优质', image_url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=zhejiang%20university%20womens%20hospital%20modern%20medical&image_size=landscape_4_3', location: '杭州市上城区', level: '三级甲等', sort_order: 6, extra_tags: '华东地区知名,服务优质' },
    ];
    let ok = 0;
    for (const a of defaults) {
      try { await createArticle(a); ok++; } catch (_) {}
    }
    res.json({ success: true, message: '已成功初始化 ' + ok + ' 条默认数据', inserted: ok });
  } catch (error) {
    console.error('Init defaults error:', error);
    res.status(500).json({ success: false, message: error.message || '初始化失败' });
  }
});

app.get('/api/articles/:id', async (req, res) => {
  try {
    const data = await getArticleById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

app.post('/api/articles', async (req, res) => {
  try {
    console.log('[POST /api/articles] body=', req.body);
    const clean = normFields(req.body);
    if (!clean.section || !['hot', 'department', 'hospital'].includes(clean.section)) {
      return res.status(400).json({ success: false, message: '版块参数错误' });
    }
    if (!clean.title) {
      return res.status(400).json({ success: false, message: '标题必填' });
    }
    const id = await createArticle(clean);
    res.json({ success: true, message: '创建成功', id });
  } catch (error) {
    console.error('Create article error:', error);
    res.status(500).json({ success: false, message: '服务器错误：' + error.message });
  }
});

app.put('/api/articles/:id', async (req, res) => {
  try {
    console.log('[PUT /api/articles/' + req.params.id + '] body=', req.body);
    const clean = normFields(req.body);
    console.log('[PUT /api/articles/' + req.params.id + '] clean=', clean);
    const rows = await updateArticle(req.params.id, clean);
    if (rows === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    const latest = await getArticleById(req.params.id);
    res.json({ success: true, message: '更新成功', data: latest });
  } catch (error) {
    console.error('Update article error:', error);
    res.status(500).json({ success: false, message: '服务器错误：' + error.message });
  }
});

app.delete('/api/articles/:id', async (req, res) => {
  try {
    const rows = await deleteArticle(req.params.id);
    if (rows === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('Delete article error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

app.get('/article/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'article.html'));
});

app.get('/hospital/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hospital.html'));
});

app.get('/api/articles/full/:id', async (req, res) => {
  try {
    const data = await getArticleById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: '文章不存在' });
    }
    if (!data.content || !String(data.content).trim()) {
      const SECTION_AUTO = {
        hot: genHotDetail(data),
        department: genDeptDetail(data),
        hospital: genHospitalDetail(data)
      };
      data.content = SECTION_AUTO[data.section] || data.summary || '暂无详细介绍。';
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get full article error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

function genHotDetail(a) {
  const title = a.title || '生殖健康科普';
  const summary = a.summary || '';
  return `
<h2>概述</h2>
<p>${summary}</p>
<h3>一、常见问题解答</h3>
<ul>
  <li><strong>什么人群需要关注？</strong> 建议备孕夫妻、有相关症状或家族史的人群定期进行相关筛查。</li>
  <li><strong>需要做哪些检查？</strong> 常规包括激素六项、超声检查、输卵管评估（女方）、精液常规（男方）等，具体遵医嘱。</li>
  <li><strong>一般治疗周期？</strong> 因人而异，多数在 3~12 个月内可获得明确诊断和阶段性结果。</li>
</ul>
<h3>二、生活方式建议</h3>
<p>合理膳食，均衡摄入优质蛋白、蔬果、谷物；戒烟限酒，避免熬夜；保持适度有氧运动，每周 3~5 次，每次 30 分钟以上；保持良好心态，避免过度焦虑。</p>
<h3>三、就医提示</h3>
<p>本文为健康科普，不能替代专业医生的诊断与治疗。如有相关症状或备孕超过 1 年未孕（高龄 6 个月），请尽早到正规医院生殖医学中心就诊，做到早发现、早干预、早治疗。</p>
<p style="text-align:right;color:#999;margin-top:30px;">—— 全民生殖健康普及网 科普专栏</p>`;
}
function genDeptDetail(a) {
  const name = a.title || '科室';
  const summary = a.summary || '';
  return `
<h2>${name} · 科室介绍</h2>
<p>${summary}</p>
<h3>诊疗范围</h3>
<ul>
  <li>常见病与多发病的规范诊断与治疗</li>
  <li>相关并发症的多学科联合管理</li>
  <li>个体化检查方案制定与健康随访</li>
</ul>
<h3>特色服务</h3>
<ul>
  <li>专家团队坐诊，经验丰富</li>
  <li>设备先进，检查结果准确可靠</li>
  <li>全程预约制，减少等候时间</li>
  <li>隐私保护，一人一诊</li>
</ul>
<h3>就诊小贴士</h3>
<p>建议就诊前整理好既往病史、检查报告、用药清单；如需做性激素类检查请于月经第 2~4 天（空腹）到场；如为初次就诊建议夫妻双方同来。</p>
<p style="text-align:right;color:#999;margin-top:30px;">—— 信息来源：${name} 官方公开资料整理</p>`;
}
function genHospitalDetail(a) {
  const name = a.title || '医院';
  const level = a.level || '';
  const location = a.location || '地址请咨询医院';
  const tags = (a.extra_tags || '').split(/[,，]/).map(s=>s.trim()).filter(Boolean);
  const summary = a.summary || '';
  return `
<h2>${name}${level ? ' · ' + level : ''}</h2>
<p>${summary}</p>
<h3>基本信息</h3>
<table style="width:100%;border-collapse:collapse;margin:10px 0;">
  <tbody>
    <tr><td style="width:25%;padding:8px 12px;border:1px solid #e3f0fb;background:#f5faff;font-weight:bold;">医院名称</td><td style="padding:8px 12px;border:1px solid #e3f0fb;">${name}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #e3f0fb;background:#f5faff;font-weight:bold;">医院等级</td><td style="padding:8px 12px;border:1px solid #e3f0fb;">${level || '待补充'}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #e3f0fb;background:#f5faff;font-weight:bold;">所在地址</td><td style="padding:8px 12px;border:1px solid #e3f0fb;">${location}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #e3f0fb;background:#f5faff;font-weight:bold;">特色标签</td><td style="padding:8px 12px;border:1px solid #e3f0fb;">${tags.length ? tags.join('、') : '暂无'}</td></tr>
  </tbody>
</table>
<h3>就医前须知</h3>
<ul>
  <li>就诊前请提前通过官方渠道预约挂号，避免空跑</li>
  <li>携带好身份证、医保卡、既往病历和检查报告</li>
  <li>如需做抽血、激素检查请提前按医嘱空腹</li>
  <li>异地就医患者建议提前了解医保报销政策</li>
</ul>
<h3>免责声明</h3>
<p>本站提供的医院信息仅供参考就医指引，不作为诊疗依据；具体科室排班、挂号规则、费用等请以医院官方最新公告为准。</p>
<p style="text-align:right;color:#999;margin-top:30px;">—— 全民生殖健康普及网 · 医院推荐</p>`;
}

app.get('/admin', async (req, res) => {
  try {
    const customers = await getAllCustomers();
    let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>客户信息管理</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Microsoft YaHei", Arial, sans-serif; margin: 0; background: #eef4fb; }
    .topbar { background: linear-gradient(135deg,#4a90e2,#357abd); padding: 16px 32px; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display:flex; justify-content: space-between; align-items: center; }
    .topbar h1 { font-size: 20px; margin:0; }
    .topbar a { color: white; text-decoration: none; background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 6px; font-size: 14px; margin-left:10px; }
    .topbar a:hover { background: rgba(255,255,255,0.35); }
    .container { max-width: 1200px; margin: 24px auto; background: white; padding: 24px; border-radius: 10px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    h2 { color: #357abd; margin: 0 0 16px 0; }
    .stat { color: #666; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #eaeef3; font-size: 14px; }
    th { background: #f2f7fc; color: #357abd; font-weight: 600; }
    tr:hover td { background: #f9fbfe; }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>🏥 全民生殖健康普及网 管理后台</h1>
    <div>
      <a href="/admin-articles">📝 文章内容管理</a>
      <a href="/">🏠 返回主页</a>
    </div>
  </div>
  <div class="container">
    <h2>客户信息管理</h2>
    <p class="stat">共 ${customers.length} 条记录</p>
    <table>
      <thead><tr><th>ID</th><th>姓名</th><th>性别</th><th>电话</th><th>填表时间</th></tr></thead>
      <tbody>`;
    if (customers.length === 0) {
      html += `<tr><td colspan="5" style="text-align:center;color:#999;padding:30px;">暂无数据</td></tr>`;
    }
    customers.forEach(c => {
      html += `<tr><td>${c.id}</td><td>${c.name}</td><td>${c.gender}</td><td>${c.phone}</td><td>${c.create_time}</td></tr>`;
    });
    html += `</tbody></table></div></body></html>`;
    res.send(html);
  } catch (e) {
    res.status(500).send('数据库连接错误：' + e.message + '<br>请确认 MySQL 已启动并执行 init_db.sql');
  }
});

app.get('/admin-articles', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-articles.html'));
});

const buildStaticScript = path.join(__dirname, 'scripts', 'build-static.js');
const DIST_DIR = path.join(__dirname, 'dist');
app.use('/dist', express.static(DIST_DIR));
let buildInProgress = false;
let lastBuildResult = null;
app.get('/api/build-static', async (req, res) => {
  if (buildInProgress) {
    return res.json({ success: false, message: '正在构建中，请稍后再试...' });
  }
  buildInProgress = true;
  lastBuildResult = null;
  const logs = [];
  const captureLog = (...args) => logs.push(args.map(x => typeof x === 'string' ? x : (x && x.message || JSON.stringify(x))).join(' '));
  try {
    const buildFn = require(buildStaticScript);
    const result = await buildFn({ log: captureLog });
    lastBuildResult = result;
    buildInProgress = false;
    res.json({ success: true, logs: logs, result: {
      count: result.count, files: result.files.slice(0, 10), dist: result.dist, total: result.files.length
    }});
  } catch (e) {
    buildInProgress = false;
    res.json({ success: false, message: String(e && e.message || e), logs: logs });
  }
});
app.get('/api/build-status', (req, res) => {
  res.json({ success: true, building: buildInProgress, last: lastBuildResult });
});

function tryListen(app, port, maxTries = 20) {
  return new Promise((resolve, reject) => {
    let tryPort = port;
    let tries = 0;
    const tryNext = () => {
      tries++;
      if (tries > maxTries) return reject(new Error('没有可用端口'));
      const server = app.listen(tryPort, '0.0.0.0');
      server.once('listening', () => resolve({ server, port: tryPort }));
      server.once('error', (e) => {
        if ((e.code === 'EADDRINUSE' || e.code === 'EACCES') && tries < maxTries) {
          tryPort++;
          tryNext();
        } else {
          reject(e);
        }
      });
    };
    tryNext();
  });
}

(async function boot() {
  const dbOk = await testConnection();
  try {
    const { server, port } = await tryListen(app, DEFAULT_PORT);
    server.on('error', (e) => { console.error(e); });
    console.log(`\n=====================================`);
    console.log(`全民生殖健康普及网 已启动`);
    console.log(`主页面:    http://localhost:${port}`);
    console.log(`客户管理:  http://localhost:${port}/admin`);
    console.log(`文章管理:  http://localhost:${port}/admin-articles`);
    if (!dbOk) {
      console.log(`⚠️  MySQL 未连接：使用本地JSON模式，客户/文章数据保存到 data/ 目录`);
      console.log(`   配置MySQL密码请编辑 database.js 第 7-16 行`);
    }
    console.log(`=====================================\n`);
  } catch (e) {
    console.error('启动失败:', e.message);
    process.exit(1);
  }
})();
