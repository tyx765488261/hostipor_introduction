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
  html = html.replace(/<span class="detail-tag t-blue">[^<]*<\/span>/, a.tag_label ? `<span class="detail-tag ${tagCls}" style="background:${tagHex}!important;">${esc(a.tag_label)}</span>` : `<span class="detail-tag ${tagCls}"></span>`);
  html = replaceInId(html, 'detail-title', esc(a.title));
  html = replaceInId(html, 'detail-meta', `
      <span>📅 发布时间：${fmtDate(a.created_at)}</span>
      <span>🔄 更新时间：${fmtDate(a.updated_at || a.created_at)}</span>
      ${a.is_hot ? '<span style="color:#357abd;">🔥 热门推荐</span>' : ''}
  `);
  const heroImg = a.image_url
    ? `<img class="detail-hero-img" src="${esc(a.image_url)}" alt="${esc(a.title)}" onerror="this.onerror=null;this.src='';this.style.background='#e3f2fd';">`
    : `<img class="detail-hero-img" src="" alt="${esc(a.title)}" style="background:#e3f2fd;">`;
  html = html.replace(/<img class="detail-hero-img"[^>]*>/, heroImg);
  const summaryBox = (a.summary && a.summary.trim())
    ? `<div class="detail-summary-box">💡 ${esc(a.summary)}</div>`
    : `<div class="detail-summary-box">💡 ${esc(a.title)}${sectionName ? '（' + sectionName + '专栏）' : ''}，结合专业医学指南与临床共识整理，为备孕与生殖健康人群提供科学参考。</div>`;
  html = html.replace(/<div class="detail-summary-box">[^<]*<\/div>/, summaryBox);

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
        ${a.tag_label ? `<span class="detail-tag ${tagCls}" style="background:${tagHex}!important;">${esc(a.tag_label)}</span>` : `<span class="detail-tag ${tagCls}"></span>`}
        <h1 class="detail-title">${esc(a.title)}</h1>
        <div class="detail-meta">
          <span>📅 发布时间：${fmtDate(a.created_at)}</span>
          <span>🔄 更新时间：${fmtDate(a.updated_at || a.created_at)}</span>
          ${a.is_hot ? '<span style="color:#357abd;">🔥 热门推荐</span>' : ''}
        </div>
        ${heroImg}
        ${summaryBox}
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
  const idPattern = new RegExp(`<([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)\\s+id="${id}"([^>]*)>`, 'i');
  const m = html.match(idPattern);
  if (!m) return html;
  const tag = m[1].toLowerCase();
  const selfClosingTags = new Set(['img','br','hr','input','meta','link','br','wbr','area','base','col','embed','source','track','wbr']);
  if (selfClosingTags.has(tag)) return html.replace(idPattern, `<${m[1]}${m[2]} id="${id}"${m[3]}>${content}`);
  const openStart = m.index;
  const openEnd = openStart + m[0].length;
  const innerTagRe = new RegExp(`<\\/?${tag}[\\s>]|<\\/${tag}>`, 'gi');
  innerTagRe.lastIndex = openEnd;
  let depth = 1;
  let search;
  let lastEnd = -1;
  while ((search = innerTagRe.exec(html)) !== null) {
    const token = search[0].toLowerCase();
    if (token.startsWith('</')) { depth -= 1; if (depth === 0) { lastEnd = search.index; break; } }
    else { depth += 1; }
  }
  if (lastEnd === -1) return html;
  const closeTokenLen = `</${tag}>`.length;
  return html.substring(0, openStart) + `<${m[1]}${m[2]} id="${id}"${m[3]}>` + content + `</${tag}>` + html.substring(lastEnd + closeTokenLen);
}

/* ========================== 渲染医院详情页 ========================== */
function renderHospitalPage(h, allHospitals) {
  let html = readPublic('hospital.html');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(h.name || h.title)} - 全民生殖健康普及网</title>`);
  const name = h.name || h.title;
  const tags = (h.extra_tags || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const related = (allHospitals || []).filter(x => x.id !== h.id).slice(0, 8);
  const tagCls = TAG_CLASS[h.tag_color] || 't-blue';

  html = replaceInId(html, 'crumb-title', esc(name));

  const heroImg = h.image_url
    ? `<img class="detail-hero-img" src="${esc(h.image_url)}" alt="${esc(name)}" onerror="this.onerror=null;this.src='';this.style.background='#e3f2fd';">`
    : `<img class="detail-hero-img" src="" alt="${esc(name)}" style="background:#e3f2fd;">`;
  const summaryBox = (h.summary && h.summary.trim())
    ? `<div class="detail-summary-box">💡 ${esc(h.summary)}</div>`
    : `<div class="detail-summary-box">💡 ${esc(name)}${h.level ? '（' + esc(h.level) + '）' : ''}，在生殖医学与不孕不育诊疗领域具备丰富的临床经验与专业技术实力，为患者提供规范优质的诊疗服务。</div>`;
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
        ${h.tag_label ? `<span class="detail-tag ${tagCls}">${esc(h.tag_label)}</span>` : `<span class="detail-tag ${tagCls}"></span>`}
        <h1 class="detail-title">${esc(name)}</h1>
        <div class="detail-meta">
          ${h.level ? `<span>🏅 等级：${esc(h.level)}</span>` : ''}
          ${h.location ? `<span>📍 地址：${esc(h.location)}</span>` : ''}
          <span>📅 更新时间：${fmtDate(h.updated_at || h.created_at)}</span>
        </div>
        ${heroImg}
        ${summaryBox}
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
  const tagText = tags.length ? tags.join('、') : '生殖专科特色';
  const intro1 = h.summary || `${name}${level ? '（' + level + '）' : ''}是在${tagText}方面具有特色优势的专业医疗机构，配备先进的医疗设备和经验丰富的专家团队，为患者提供规范、专业、全流程的生殖健康诊疗服务。`;
  const strengths = `
    <p>中心在生殖医学与不孕不育诊疗领域具备以下突出优势，尤其擅长以下几类复杂疑难病例的诊治：</p>
    <ul>
      <li>👩‍⚕️ <b>高龄与卵巢低反应助孕</b>：擅长 35 岁以上高龄女性、反复促排卵失败、卵巢储备功能下降（DOR）患者的个体化方案设计，累计为大量高龄家庭成功助孕。</li>
      <li>🔬 <b>反复胚胎着床失败（RIF）</b>：建立子宫内膜容受性评估、宫腔镜排查、免疫因素筛查、胚胎筛选的综合诊治路径，显著提高反复失败患者的最终妊娠率。</li>
      <li>💊 <b>复发性流产（RSA）精准保胎</b>：多学科联合（生殖免疫、妇科内分泌、遗传、男科），建立病因分型→个体化干预→孕后全程管理的闭环方案，显著降低再次流产风险。</li>
      <li>🧬 <b>遗传咨询与第三代试管（PGT）</b>：对染色体易位、单基因遗传病、高龄非整倍体筛查等病例提供专业遗传咨询，联合 PGT-A / PGT-M / PGT-SR 技术阻断出生缺陷。</li>
      <li>👨‍⚕️ <b>男性不育显微手术</b>：擅长梗阻性无精症的显微输精管吻合、附睾/睾丸取精（micro-TESE），以及精索静脉曲张显微结扎等男科高难度手术，让部分「无精症」患者实现自然受孕或试管助孕。</li>
      <li>🩺 <b>生殖微创与妇科内镜</b>：大量开展宫腹腔镜联合手术处理输卵管积水、宫腔粘连、子宫内膜息肉、子宫纵隔、卵巢巧克力囊肿等影响怀孕的器质性病变，创伤小、恢复快、妊娠率高。</li>
      <li>⚖️ <b>多囊卵巢综合征（PCOS）综合管理</b>：减重 + 内分泌调节 + 诱导排卵 + 试管的分步管理方案，对顽固性不排卵、胰岛素抵抗的 PCOS 患者效果显著。</li>
      <li>🧠 <b>生殖心理与全流程关怀</b>：重视患者心理疏导，配备专业心理咨询与健康管理师，提供从首诊、促排、取卵、移植到孕 12 周的全周期陪伴式服务。</li>
    </ul>`;
  const experts = `
    <p>中心拥有一支结构合理、经验丰富的专家团队：</p>
    <ul>
      <li>由主任医师 / 教授、副主任医师、主治医师、胚胎学家、遗传咨询师、生殖护理师组成的多学科团队；</li>
      <li>核心专家均具备 15–30 年以上临床经验，多名专家担任全国及省级生殖医学专业委员会委员；</li>
      <li>博士 / 硕士学历占比高，梯队完整，年门诊量、取卵周期数、移植周期数均处于地区或全国领先水平；</li>
      <li>与国内外知名生殖中心保持长期学术交流，定期参加 ASRM / ESHRE 等国际会议，技术理念与国际前沿同步。</li>
    </ul>
    <p>中心高度重视规范化诊治，严格遵循《人类辅助生殖技术规范》及行业最新指南，坚持「以患者为中心，循证医学为依据」，个体化评估每一对夫妻的病情，制定最合适的助孕方案，避免过度医疗和不必要的花费。</p>`;
  const labs = `
    <p>辅助生殖的成功率与实验室水平、胚胎培养环境高度相关。中心配备高标准的胚胎实验室和系列先进设备：</p>
    <ul>
      <li>✅ <b>层流净化胚胎实验室</b>：恒温恒湿、空气洁净度达百级标准，最大限度降低胚胎培养过程的环境风险；</li>
      <li>✅ <b>时差成像培养系统（Time-lapse）</b>：24 小时不间断动态观察胚胎发育，无需频繁开箱观察，减少胚胎应激，更精准筛选高潜能胚胎；</li>
      <li>✅ <b>ICSI 显微操作系统</b>：顶级倒置显微镜 + 显微操作臂，精准完成单精子注射、胚胎辅助孵化、活检等精细操作；</li>
      <li>✅ <b>PGT 检测平台</b>：配备 NGS（下一代测序）设备，联合专业遗传诊断实验室，完成胚胎植入前的染色体 / 基因检测；</li>
      <li>✅ <b>精子处理与冷冻系统</b>：专业密度梯度离心、上游法优选精子；程序降温仪 + 气相液氮罐，保证精子、卵子、胚胎的长期安全冷冻保存；</li>
      <li>✅ <b>超声监测设备</b>：高端彩色多普勒超声，配合 3D / 4D 探头，精准评估窦卵泡计数、子宫内膜容受性、血流参数等关键指标；</li>
      <li>✅ <b>信息化全流程追溯</b>：条码身份核对 + 双人复核 + 电子病历系统，确保患者、配子、胚胎的身份 100% 准确，杜绝差错。</li>
    </ul>`;
  return `
    <h2>医院简介</h2>
    <p>${esc(intro1)}</p>
    <p>中心集医疗、教学、科研为一体，致力于为患者提供一站式生殖健康诊疗服务，涵盖从孕前检查、辅助生殖技术、生殖内分泌疾病诊疗到术后随访和保胎管理的全流程，帮助更多家庭实现生育愿望。</p>
    <h3>特色诊疗项目</h3>
    <ul>
      <li>试管婴儿技术（第一代 IVF / 第二代 ICSI / 第三代 PGT）</li>
      <li>夫精人工授精（AIH）、供精人工授精（AID）及相关咨询</li>
      <li>女性不孕：输卵管堵塞、多囊卵巢综合征、子宫内膜异位症、排卵障碍等</li>
      <li>男性不育：少弱精症、无精症、精索静脉曲张、性功能障碍等</li>
      <li>复发性流产（RSA）精准诊断与个体化保胎</li>
      <li>生殖内分泌疾病：月经不调、闭经、高泌乳素血症、早发性卵巢功能不全</li>
      <li>生殖微创手术（宫腹腔镜联合、输卵管疏通、卵巢囊肿剔除等）</li>
      ${tags.length ? `<li>特色方向：${tags.map(esc).join('、')}</li>` : ''}
    </ul>
    <h3>专科优势与擅长领域</h3>${strengths}
    <h3>专家团队与技术实力</h3>${experts}
    <h3>先进设备与实验室保障</h3>${labs}
    <h3>挂号与就医须知</h3>
    <ul>
      <li>就诊前请通过医院官方 APP / 微信公众号 / 官方电话提前预约挂号，避免空跑</li>
      <li>首次就诊建议夫妻双方同来；男方如需精液检查，请禁欲 3–7 天</li>
      <li>携带好身份证、医保卡、既往病历、检查报告（尤其是近半年的）</li>
      <li>抽血、激素六项、AMH、B 超监测排卵等检查，请遵医嘱提前准备（部分需空腹）</li>
      <li>进入辅助生殖周期后，请严格按医嘱复诊时间用药和检查，切勿自行停药</li>
      <li>异地就医患者建议提前了解医保报销政策，并保留好发票、诊断证明、费用清单</li>
    </ul>
    <h3>联系与交通指引</h3>
    <table style="width:100%;border-collapse:collapse;margin:10px 0;"><tbody>
      ${loc ? `<tr><td style="width:25%;padding:8px 12px;border:1px solid #e3f0fb;background:#f5faff;font-weight:bold;">所在地址</td><td style="padding:8px 12px;border:1px solid #e3f0fb;">📍 ${esc(loc)}</td></tr>` : ''}
      <tr><td style="padding:8px 12px;border:1px solid #e3f0fb;background:#f5faff;font-weight:bold;">门诊时间</td><td style="padding:8px 12px;border:1px solid #e3f0fb;">🕘 周一至周五 8:00–17:00；周六 8:00–12:00（节假日以官方公告为准）</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e3f0fb;background:#f5faff;font-weight:bold;">挂号方式</td><td style="padding:8px 12px;border:1px solid #e3f0fb;">📱 医院官方 APP / 微信公众号 / 电话预约 / 现场自助机（推荐线上预约）</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e3f0fb;background:#f5faff;font-weight:bold;">咨询电话</td><td style="padding:8px 12px;border:1px solid #e3f0fb;">📞 请通过医院官方公布的热线或在线客服查询获取</td></tr>
    </tbody></table>
    <h3>温馨提示</h3>
    <p>知名专家号源一般比较紧张，建议提前 1–2 周通过官方渠道预约；预约成功后请提前 30 分钟到院报到；如临时改约请至少提前 1 天操作，避免浪费宝贵号源。</p>
    <h3>免责声明</h3>
    <p>本站提供的本医院信息（含地址、门诊时间、诊疗项目等）均从公开资料整理，仅供就医参考指引，不作为诊疗依据；具体科室排班、挂号规则、费用与治疗方案，请以医院官方最新公告和面诊医生意见为准。</p>
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
