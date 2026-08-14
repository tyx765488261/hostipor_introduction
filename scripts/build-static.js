/*
 * scripts/build-static.js
 * 功能：从真实数据（MySQL / JSON 文件）读取文章、医院、科室，
 *      生成完整的静态站点到 dist/ 目录（可直接部署到任意静态服务器）
 *
 * 用法：
 *   1) 命令行：node scripts/build-static.js
 *   2) 后台按钮：GET /api/build-static （在 server.js 里调用本脚本）
 *
 * 输出目录结构：
 *   dist/
 *     index.html
 *     article-1.html ... article-N.html （所有非医院文章）
 *     hospital-60.html ... hospital-N.html （所有医院）
 *     css/style.css
 *     js/app.js
 *     uploads/* （所有上传图片）
 */

const fs = require('fs');
const path = require('path');
const database = require(path.join(__dirname, '..', 'database.js'));

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const DIST = path.join(ROOT, 'dist');

const TAG_CLASS = { red: 't-blue', blue: 't-blue', green: 't-blue', orange: 't-blue', purple: 't-blue', pink: 't-blue', cyan: 't-blue', yellow: 't-blue' };
const TAG_STYLE_HEX = {
  red: '#e53935', blue: '#1976d2', green: '#2e7d32', orange: '#ef6c00',
  purple: '#7b1fa2', pink: '#c2185b', cyan: '#00838f', yellow: '#f9a825'
};
const SECTION_NAME = { hot: '精彩内容', department: '热门推荐', hospital: '医院推荐' };
const SECTION_ANCHOR = { hot: 'hot-section', department: 'knowledge-section', hospital: 'hospital-section' };

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d).substring(0, 10);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function readPublic(file) {
  return fs.readFileSync(path.join(PUBLIC, file), 'utf8');
}
function rmDir(p) {
  if (!fs.existsSync(p)) return;
  fs.readdirSync(p).forEach(n => {
    const full = path.join(p, n);
    if (fs.lstatSync(full).isDirectory()) rmDir(full); else fs.unlinkSync(full);
  });
  fs.rmdirSync(p);
}
function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  fs.readdirSync(src).forEach(n => {
    const s = path.join(src, n), d = path.join(dst, n);
    if (fs.lstatSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  });
}

/* ========================== 渲染首页 ========================== */
function renderIndex(hotList, hospitalList) {
  let html = readPublic('index.html');
  const topics = [];
  const articles = [];
  hotList.forEach(a => {
    if (a.sub_type === 'hot_topic') topics.push(a); else articles.push(a);
  });
  while (topics.length < 5 && articles.length) topics.push(articles.shift());

  const topicsHtml = topics.map((a, i) => {
    const isBig = i === 0;
    const img = a.image_url ? `<img src="${esc(a.image_url)}" alt="${esc(a.title)}" onerror="this.style.background='#e3f2fd'">` : `<img src="" alt="${esc(a.title)}" onerror="this.style.background='#e3f2fd'">`;
    const tagHex = TAG_STYLE_HEX[a.tag_color] || '#1976d2';
    if (isBig) {
      return `<a href="article-${a.id}.html" class="topic-card big-card">${img}
        <div class="topic-overlay">
          ${a.tag_label ? `<span class="hot-tag" style="background:#357abd;">${esc(a.tag_label)}</span>` : ''}
          <h3>${esc(a.title)}</h3><p>${esc(a.summary || '')}</p>
        </div></a>`;
    }
    return `<a href="article-${a.id}.html" class="topic-card">${img}
      <div class="topic-info">
        ${a.tag_label ? `<span style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:12px;color:${tagHex};background:#e3f2fd;margin-right:10px;">${esc(a.tag_label)}</span>` : ''}
        <h4>${esc(a.title)}</h4><p class="meta">${esc(a.summary || '')}</p>
      </div></a>`;
  }).join('');
  html = replaceSection(html, 'hotTopics', topicsHtml);

  // 知识普及列表：把 articles 剩余（hot-section 里的文章）和 department 合起来
  const deptList = (hotList.filter(a => a.section === 'department') || []).concat(articles);
  const listHtml = deptList.map(a => {
    const meta = (a.summary && a.summary.length < 50) ? a.summary : (fmtDate(a.created_at) || '');
    const tagHex = TAG_STYLE_HEX[a.tag_color] || '#1976d2';
    return `<li class="article-item">
      <a href="article-${a.id}.html">
        ${a.tag_label ? `<span style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:12px;color:${tagHex};background:#e3f2fd;margin-right:10px;">${esc(a.tag_label)}</span>` : ''}
        <span class="article-title">${esc(a.title)}</span>
        <span class="article-date">${esc(meta)}</span>
      </a></li>`;
  }).join('') || `<li class="article-item" style="color:#aaa;text-align:center;justify-content:center;">暂无文章</li>`;
  html = replaceSection(html, 'articleList', listHtml);

  const hospitalHtml = hospitalList.map(a => {
    const tags = (a.extra_tags || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
    return `<a href="hospital-${a.id}.html" class="hospital-card">
      <div class="hospital-img">
        <img src="${esc(a.image_url || '')}" alt="${esc(a.title)}" onerror="this.style.background='#e3f2fd'">
        ${a.level ? `<span class="hospital-level" style="background:rgba(53,122,189,0.95);">${esc(a.level)}</span>` : ''}
      </div>
      <div class="hospital-info">
        <h3>${esc(a.title)}</h3>
        ${a.location ? `<p class="hospital-loc">📍 ${esc(a.location)}</p>` : ''}
        ${tags.length ? `<div class="hospital-tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
    </a>`;
  }).join('') || `<div style="grid-column:1/-1;color:#aaa;padding:20px;text-align:center;">暂无医院推荐</div>`;
  html = replaceSection(html, 'hospitalGrid', hospitalHtml);

  return html;
}
function replaceSection(html, id, inner) {
  return html.replace(new RegExp(`(<(div|ul)[^>]*\\sid="${id}"[^>]*>)[\\s\\S]*?(<\\/\\2>)`, 'i'), (_, g1, __g2, g3) => `${g1}${inner}${g3}`);
}

/* ========================== 渲染文章详情页 ========================== */
function renderArticlePage(a, allArticles) {
  let html = readPublic('article.html');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(a.title)} - 全民生殖健康普及网</title>`);
  const sectionName = SECTION_NAME[a.section] || '文章';
  const anchor = SECTION_ANCHOR[a.section] || 'hot-section';
  const related = (allArticles || []).filter(x => x.section === a.section && x.id !== a.id).slice(0, 8);
  const tags = (a.extra_tags || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const tagCls = TAG_CLASS[a.tag_color] || 't-blue';
  const tagHex = TAG_STYLE_HEX[a.tag_color] || '#1976d2';

  html = replaceInId(html, 'crumb-section', `<a href="index.html#${anchor}">${sectionName}</a>`);
  html = replaceInId(html, 'crumb-title', esc(a.title));
  html = html.replace(/<span class="detail-tag t-blue">[^<]*<\/span>/, a.tag_label ? `<span class="detail-tag ${tagCls}" style="background:${tagHex}!important;">${esc(a.tag_label)}</span>` : '');
  html = replaceInId(html, 'detail-title', esc(a.title));
  html = replaceInId(html, 'detail-meta', `
      <span>📅 发布时间：${fmtDate(a.created_at)}</span>
      <span>🔄 更新时间：${fmtDate(a.updated_at || a.created_at)}</span>
      ${a.is_hot ? '<span style="color:#357abd;">🔥 热门推荐</span>' : ''}
  `);
  const heroImg = a.image_url
    ? `<img class="detail-hero-img" src="${esc(a.image_url)}" alt="${esc(a.title)}" onerror="this.style.background='#e3f2fd'">`
    : `<img class="detail-hero-img" src="" alt="${esc(a.title)}" style="background:#e3f2fd;">`;
  html = html.replace(/<img class="detail-hero-img"[^>]*>/, heroImg);
  const summary = a.summary ? `<div class="detail-summary-box">💡 ${esc(a.summary)}</div>` : '';
  html = html.replace(/<div class="detail-summary-box">[^<]*<\/div>/, summary);

  let infoTable = '';
  if (a.section === 'department') {
    infoTable = `<div class="info-table-wrap"><table class="info-table"><tbody>
      <tr><td>科室名称</td><td>${esc(a.title)}</td></tr>
      <tr><td>咨询入口</td><td><a href="index.html#consult-top" style="color:#357abd;">👉 点击前往在线咨询 / 预约登记</a></td></tr>
    </tbody></table></div>`;
  }

  const content = a.content || buildDefaultArticleContent(a);
  const mainArea = `
    <div class="detail-wrapper">
      <article class="detail-main">
        ${a.tag_label ? `<span class="detail-tag ${tagCls}" style="background:${tagHex}!important;">${esc(a.tag_label)}</span>` : ''}
        <h1 class="detail-title">${esc(a.title)}</h1>
        <div class="detail-meta">
          <span>📅 发布时间：${fmtDate(a.created_at)}</span>
          <span>🔄 更新时间：${fmtDate(a.updated_at || a.created_at)}</span>
          ${a.is_hot ? '<span style="color:#357abd;">🔥 热门推荐</span>' : ''}
        </div>
        ${heroImg}
        ${summary}
        ${infoTable}
        <div class="detail-body">${content}</div>
      </article>
      <aside>
        ${tags.length ? `<div class="side-card side-tag-group"><h4>🏷 相关标签</h4>${tags.map(t => `<span class="s-tag">${esc(t)}</span>`).join('')}</div>` : ''}
        ${related.length ? `<div class="side-card"><h4>🔗 相关${sectionName}</h4><ul class="related-list">
          ${related.map(r => `<li><a href="article-${r.id}.html">${esc(r.title)}</a></li>`).join('')}
        </ul></div>` : ''}
      </aside>
    </div>`;
  html = replaceInId(html, 'mainArea', mainArea);
  // 把动态脚本里的 fetch 执行路径屏蔽（静态页不应再依赖接口）
  html = html.replace(/localStorage\.getItem\('DYNAMIC_MODE'\) === '1'/, `false /* 静态导出页，固定不加载动态脚本 */`);
  return html;
}
function buildDefaultArticleContent(a) {
  const title = a.title;
  const summary = a.summary || '';
  const tags = (a.extra_tags || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
  return `
    <h2>概述</h2>
    <p>${esc(summary || title)}。</p>
    <h3>一、常见问题解答</h3>
    <ul>
      <li><strong>什么人群需要关注？</strong> 建议备孕夫妻、有相关症状或家族史的人群定期进行相关筛查。</li>
      <li><strong>需要做哪些检查？</strong> 常规包括激素六项、超声检查、输卵管评估（女方）、精液常规（男方）等，具体遵医嘱。</li>
      <li><strong>一般治疗周期？</strong> 因人而异，多数在 3~12 个月内可获得明确诊断和阶段性结果。</li>
    </ul>
    <h3>二、生活方式建议</h3>
    <p>合理膳食，均衡摄入优质蛋白、蔬果、谷物；戒烟限酒，避免熬夜；保持适度有氧运动，每周 3~5 次，每次 30 分钟以上；保持良好心态，避免过度焦虑。</p>
    ${tags.length ? `<h3>三、相关关键词</h3><p>${tags.map(t => `「${esc(t)}」`).join('、')} 相关人群建议结合本文内容进一步咨询专科医生。</p>` : ''}
    <h3>四、就医提示</h3>
    <p>本文为健康科普，不能替代专业医生的诊断与治疗。如有相关症状或备孕超过 1 年未孕（高龄 6 个月），请尽早到正规医院生殖医学中心就诊，做到早发现、早干预、早治疗。</p>
    <p style="text-align:right;color:#999;margin-top:30px;">—— 全民生殖健康普及网 科普专栏</p>
  `;
}
function replaceInId(html, id, content) {
  return html.replace(new RegExp(`(<[^>]*\\sid="${id}"[^>]*>)[\\s\\S]*?(<\\/[^>]*>)`, 'i'), (_, g1, g2) => `${g1}${content}${g2}`);
}

/* ========================== 渲染医院详情页 ========================== */
function renderHospitalPage(h, allHospitals) {
  let html = readPublic('hospital.html');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(h.name || h.title)} - 全民生殖健康普及网</title>`);
  const name = h.name || h.title;
  const tags = (h.extra_tags || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const related = (allHospitals || []).filter(x => x.id !== h.id).slice(0, 8);

  html = replaceInId(html, 'crumb-title', esc(name));

  const heroImg = h.image_url
    ? `<img class="detail-hero-img" src="${esc(h.image_url)}" alt="${esc(name)}" onerror="this.style.background='#e3f2fd'">`
    : `<img class="detail-hero-img" src="" alt="${esc(name)}" style="background:#e3f2fd;">`;
  const summary = (h.summary || '') ? `<div class="detail-summary-box">💡 ${esc(h.summary)}</div>` : '';
  const infoTable = `<div class="info-table-wrap"><table class="info-table"><tbody>
    <tr><td>医院名称</td><td>${esc(name)}</td></tr>
    ${h.level ? `<tr><td>医院等级</td><td>${esc(h.level)}</td></tr>` : ''}
    ${h.location ? `<tr><td>所在地址</td><td>📍 ${esc(h.location)}</td></tr>` : ''}
    ${tags.length ? `<tr><td>特色标签</td><td>${tags.map(t => `<span class="s-tag">${esc(t)}</span>`).join('')}</td></tr>` : ''}
  </tbody></table></div>`;

  const content = h.content || buildDefaultHospitalContent(h);
  const mainArea = `
    <div class="detail-wrapper">
      <article class="detail-main">
        <h1 class="detail-title">${esc(name)}</h1>
        <div class="detail-meta">
          ${h.level ? `<span>🏅 等级：${esc(h.level)}</span>` : ''}
          ${h.location ? `<span>📍 地址：${esc(h.location)}</span>` : ''}
          <span>📅 更新时间：${fmtDate(h.updated_at || h.created_at)}</span>
        </div>
        ${heroImg}
        ${summary}
        ${infoTable}
        <div class="detail-body">${content}</div>
      </article>
      <aside>
        ${tags.length ? `<div class="side-card side-tag-group"><h4>🏷 相关标签</h4>${tags.map(t => `<span class="s-tag">${esc(t)}</span>`).join('')}</div>` : ''}
        ${related.length ? `<div class="side-card"><h4>🏥 更多医院推荐</h4><ul class="related-list">
          ${related.map(r => `<li><a href="hospital-${r.id}.html">${esc(r.title || r.name)}</a></li>`).join('')}
        </ul></div>` : ''}
      </aside>
    </div>`;
  html = replaceInId(html, 'mainArea', mainArea);
  html = html.replace(/localStorage\.getItem\('DYNAMIC_MODE'\) === '1'/, `false /* 静态导出页，固定不加载动态脚本 */`);
  return html;
}
function buildDefaultHospitalContent(h) {
  const name = h.title || h.name;
  const level = h.level || '';
  const loc = h.location || '';
  const tags = (h.extra_tags || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
  return `
    <h2>${esc(name)}${level ? ' · ' + esc(level) : ''}</h2>
    <p>${esc(h.summary || loc + '优质生殖医疗机构。')}</p>
    <h3>基本信息</h3>
    <table style="width:100%;border-collapse:collapse;margin:10px 0;"><tbody>
      <tr><td style="width:25%;padding:8px 12px;border:1px solid #e3f0fb;background:#f5faff;font-weight:bold;">医院名称</td><td style="padding:8px 12px;border:1px solid #e3f0fb;">${esc(name)}</td></tr>
      ${level ? `<tr><td style="padding:8px 12px;border:1px solid #e3f0fb;background:#f5faff;font-weight:bold;">医院等级</td><td style="padding:8px 12px;border:1px solid #e3f0fb;">${esc(level)}</td></tr>` : ''}
      ${loc ? `<tr><td style="padding:8px 12px;border:1px solid #e3f0fb;background:#f5faff;font-weight:bold;">所在地址</td><td style="padding:8px 12px;border:1px solid #e3f0fb;">${esc(loc)}</td></tr>` : ''}
      ${tags.length ? `<tr><td style="padding:8px 12px;border:1px solid #e3f0fb;background:#f5faff;font-weight:bold;">特色标签</td><td style="padding:8px 12px;border:1px solid #e3f0fb;">${tags.map(esc).join('、')}</td></tr>` : ''}
    </tbody></table>
    <h3>就医前须知</h3>
    <ul>
      <li>就诊前请提前通过官方渠道预约挂号，避免空跑</li>
      <li>携带好身份证、医保卡、既往病历和检查报告</li>
      <li>如需做抽血、激素检查请提前按医嘱空腹</li>
      <li>异地就医患者建议提前了解医保报销政策</li>
    </ul>
    <h3>免责声明</h3>
    <p>本站提供的医院信息仅供参考就医指引，不作为诊疗依据；具体科室排班、挂号规则、费用等请以医院官方最新公告为准。</p>
    <p style="text-align:right;color:#999;margin-top:30px;">—— 全民生殖健康普及网 · 医院推荐</p>
  `;
}

/* ========================== 主流程 ========================== */
async function main(options = {}) {
  const log = options.log || console.log.bind(console);
  // 1. 初始化数据连接（MySQL 连不上就 JSON）
  await database.testConnection();
  // 2. 取数据
  let [hot, dept, hosp] = [[], [], []];
  try { hot = await database.getArticlesBySection('hot'); } catch (e) { log('读取 hot 失败：' + e.message); }
  try { dept = await database.getArticlesBySection('department'); } catch (e) { log('读取 department 失败：' + e.message); }
  try { hosp = await database.getArticlesBySection('hospital'); } catch (e) { log('读取 hospital 失败：' + e.message); }
  const allForArticle = hot.concat(dept).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const allArticles = hot.concat(dept);
  log(`📚 读取数据：知识篇 ${hot.length + dept.length} 篇（含科室），医院 ${hosp.length} 家`);
  // 3. 清空 + 重新创建 dist/
  rmDir(DIST);
  fs.mkdirSync(DIST, { recursive: true });
  // 4. 复制静态资源
  copyDir(path.join(PUBLIC, 'css'), path.join(DIST, 'css'));
  copyDir(path.join(PUBLIC, 'js'), path.join(DIST, 'js'));
  copyDir(path.join(PUBLIC, 'uploads'), path.join(DIST, 'uploads'));
  // 5. 渲染首页
  const indexHtml = renderIndex(allForArticle, hosp);
  fs.writeFileSync(path.join(DIST, 'index.html'), indexHtml, 'utf8');
  log('✅ 已写入 dist/index.html');
  // 6. 渲染所有非 hospital 的文章
  const articlesWritten = [];
  allArticles.forEach(a => {
    const out = path.join(DIST, `article-${a.id}.html`);
    fs.writeFileSync(out, renderArticlePage(a, allArticles), 'utf8');
    articlesWritten.push(`article-${a.id}.html`);
  });
  log(`✅ 已写入 ${articlesWritten.length} 篇文章详情页 (article-*.html)`);
  // 7. 渲染所有医院
  const hospWritten = [];
  hosp.forEach(h => {
    const out = path.join(DIST, `hospital-${h.id}.html`);
    fs.writeFileSync(out, renderHospitalPage(h, hosp), 'utf8');
    hospWritten.push(`hospital-${h.id}.html`);
  });
  log(`✅ 已写入 ${hospWritten.length} 家医院详情页 (hospital-*.html)`);
  // 8. 把后台管理页 admin-articles.html 也一起复制过去（可选），并让它在静态导出时的链接改成相对
  let adminHtml = readPublic('admin-articles.html');
  adminHtml = adminHtml.replace(/href="\/css\/style\.css"/, 'href="css/style.css"');
  adminHtml = adminHtml.replace(/src="\/js\/app\.js"/, 'src="js/app.js"');
  fs.writeFileSync(path.join(DIST, 'admin-articles.html'), adminHtml, 'utf8');
  log('✅ 已写入 dist/admin-articles.html （仅页面静态壳，实际操作需 HTTP 服务）');
  log(`\n🎉 静态站点已生成完毕，共 ${1 + articlesWritten.length + hospWritten.length + 1} 个 HTML 文件，输出目录：\n   ${DIST}`);
  log('   可直接双击 dist/index.html 查看，或复制到任意静态服务器 / CDN / GitHub Pages 部署。');
  return {
    ok: true,
    count: { index: 1, articles: articlesWritten.length, hospitals: hospWritten.length },
    files: ['index.html', ...articlesWritten, ...hospWritten, 'admin-articles.html'],
    dist: DIST
  };
}

if (require.main === module) {
  (async () => {
    try {
      await main();
      process.exit(0);
    } catch (e) {
      console.error('❌ 静态站点生成失败：', e);
      process.exit(1);
    }
  })();
}

module.exports = main;
