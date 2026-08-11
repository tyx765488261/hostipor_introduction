// ============= 公共工具 =============
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d).substring(0, 10);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function tagStyle(color, label) {
  if (!label) return '';
  const colors = {
    red: '#e74c3c', blue: '#4a90e2', green: '#27ae60',
    orange: '#f39c12', purple: '#8e44ad', pink: '#e84393',
    cyan: '#0097a7', yellow: '#f9a825'
  };
  const bg = colors[color] || '#4a90e2';
  const tc = color === 'yellow' ? '#333' : '#fff';
  return `<span style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:12px;color:${tc};background:${bg};margin-right:10px;">${escapeHtml(label)}</span>`;
}

// ============= 版块1: 精彩内容 =============
function renderHotSection(list) {
  const topics = list.filter(a => a.sub_type === 'hot_topic');
  const articles = list.filter(a => a.sub_type !== 'hot_topic');
  const A = id => `/article/${id}`;

  const topicsHtml = topics.length ? topics.map((a, i) => {
    const isBig = i === 0;
    const img = a.image_url || '';
    if (isBig) {
      return `<a href="${A(a.id)}" class="topic-card big-card">
        <img src="${escapeHtml(img)}" alt="${escapeHtml(a.title)}" onerror="this.src='https://via.placeholder.com/800x400/e3f2fd/1976d2?text=精彩内容'">
        <div class="topic-overlay">
          ${a.tag_label ? `<span class="hot-tag" style="background:#357abd;">${escapeHtml(a.tag_label)}</span>` : ''}
          <h3>${escapeHtml(a.title)}</h3>
          <p>${escapeHtml(a.summary || '')}</p>
        </div>
      </a>`;
    } else {
      return `<a href="${A(a.id)}" class="topic-card">
        <img src="${escapeHtml(img)}" alt="${escapeHtml(a.title)}" onerror="this.src='https://via.placeholder.com/400x300/e3f2fd/1976d2?text=知识卡片'">
        <div class="topic-info">
          ${tagStyle(a.tag_color, a.tag_label)}
          <h4>${escapeHtml(a.title)}</h4>
          <p class="meta">${escapeHtml(a.summary || '')}</p>
        </div>
      </a>`;
    }
  }).join('') : `<div style="grid-column:1/-1;color:#aaa;padding:20px;text-align:center;">暂无热点知识</div>`;
  document.getElementById('hotTopics').innerHTML = topicsHtml;

  const listHtml = articles.length ? articles.map(a => {
    const meta = (a.summary && a.summary.length < 50) ? a.summary : ('发布时间 ' + formatDate(a.created_at));
    return `<li class="article-item">
      <a href="${A(a.id)}">
        ${tagStyle(a.tag_color, a.tag_label)}
        <span class="article-title">${escapeHtml(a.title)}</span>
        <span class="article-date">${escapeHtml(meta)}</span>
      </a>
    </li>`;
  }).join('') : `<li class="article-item" style="color:#aaa;text-align:center;justify-content:center;">暂无文章</li>`;
  document.getElementById('articleList').innerHTML = listHtml;
}

// ============= 版块2: 热门推荐(科室) =============
const DEPT_ICONS = {
  '生殖医学中心': '👩‍⚕️', '男科': '👨‍⚕️', '妇科': '🏥', '内分泌科': '🔬',
  '中医科': '💊', '遗传咨询科': '🧬', '检验科': '🧪', '产前诊断中心': '❤️',
  '生殖中心': '👩‍⚕️', '不孕不育科': '🧬'
};
const ICON_COLORS = ['icon-pink','icon-blue','icon-green','icon-orange','icon-purple','icon-red','icon-cyan','icon-yellow'];

function renderDepartmentSection(list) {
  const html = list.length ? list.map((a, i) => {
    const icon = a.tag_label || DEPT_ICONS[a.sub_type || a.title] || '🏥';
    const iconColor = ICON_COLORS[i % ICON_COLORS.length];
    return `<a href="/article/${a.id}" class="dept-card">
      <div class="dept-icon ${iconColor}">${icon}</div>
      <h3>${escapeHtml(a.title)}</h3>
      <p>${escapeHtml(a.summary || '')}</p>
      <span class="more-info">了解详情 →</span>
    </a>`;
  }).join('') : `<div style="grid-column:1/-1;color:#aaa;padding:20px;text-align:center;">暂无科室数据</div>`;
  document.getElementById('deptGrid').innerHTML = html;
}

// ============= 版块3: 医院推荐 =============
function renderHospitalSection(list) {
  const html = list.length ? list.map(a => {
    const tags = (a.extra_tags ? a.extra_tags.split(/[,，]/).map(s=>s.trim()).filter(Boolean) : []);
    return `<a href="/article/${a.id}" class="hospital-card">
      <div class="hospital-img">
        <img src="${escapeHtml(a.image_url || '')}" alt="${escapeHtml(a.title)}" onerror="this.src='https://via.placeholder.com/500x380/e3f2fd/1976d2?text=医院推荐'">
        ${a.level ? `<span class="hospital-level" style="background:rgba(53,122,189,0.95);">${escapeHtml(a.level)}</span>` : ''}
      </div>
      <div class="hospital-info">
        <h3>${escapeHtml(a.title)}</h3>
        <p class="hospital-loc">📍 ${escapeHtml(a.location || '地址待补充')}</p>
        <div class="hospital-tags">
          ${tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    </a>`;
  }).join('') : `<div style="grid-column:1/-1;color:#aaa;padding:20px;text-align:center;">暂无医院推荐</div>`;
  document.getElementById('hospitalGrid').innerHTML = html;
}

// ============= 加载所有版块 =============
async function loadAllSections() {
  try {
    const [hot, dept, hosp] = await Promise.all([
      fetch('/api/articles?section=hot').then(r => r.json()),
      fetch('/api/articles?section=department').then(r => r.json()),
      fetch('/api/articles?section=hospital').then(r => r.json()),
    ]);
    if (hot.success) renderHotSection(hot.data);
    if (dept.success) renderDepartmentSection(dept.data);
    if (hosp.success) renderHospitalSection(hosp.data);
  } catch (e) {
    console.error('加载版块失败', e);
    ['hotTopics','articleList','deptGrid','hospitalGrid'].forEach(id => {
      document.getElementById(id).innerHTML = `<div style="color:#e53935;padding:20px;text-align:center;">数据加载失败，请检查 MySQL 和文章管理后台 <a href="/admin-articles" style="color:#357abd;">/admin-articles</a></div>`;
    });
  }
}

// ============= 咨询弹窗 =============
function openConsultModal() {
  document.getElementById('consultModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeConsultModal() {
  document.getElementById('consultModal').classList.remove('active');
  document.body.style.overflow = '';
}
document.getElementById('consultModal').addEventListener('click', function(e) {
  if (e.target === this) closeConsultModal();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeConsultModal();
});

function addMessage(text, isUser) {
  const chatMessages = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ' + (isUser ? 'user-message' : 'bot-message');
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = isUser ? '👤' : '🏥';
  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerHTML = text.replace(/\n/g, '<br>');
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(content);
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function addLoadingMessage() {
  const chatMessages = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message bot-message loading-msg';
  messageDiv.id = 'loadingMsg';
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '🏥';
  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerHTML = '<span>正在为您查询</span><span class="dots"><span>.</span><span>.</span><span>.</span></span>';
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(content);
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function removeLoadingMessage() {
  const m = document.getElementById('loadingMsg');
  if (m) m.remove();
}
async function sendQuestion() {
  const input = document.getElementById('questionInput');
  const sendBtn = document.querySelector('.send-btn');
  const question = input.value.trim();
  if (!question) return;
  addMessage(question, true);
  input.value = '';
  sendBtn.disabled = true;
  addLoadingMessage();
  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    removeLoadingMessage();
    const result = await response.json();
    addMessage(result.answer || result.message || '抱歉，暂时无法回答您的问题。', false);
  } catch (e) {
    removeLoadingMessage();
    addMessage('网络错误，请稍后再试。', false);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

document.getElementById('questionInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendQuestion();
  }
});

function handleKeyPress(e) {
  if (e.key === 'Enter') { e.preventDefault(); sendQuestion(); }
}

// ============= 预约表单 =============
async function submitForm(e) {
  if (e && e.preventDefault) e.preventDefault();
  return submitAppointment();
}
async function submitAppointment() {
  const name = document.getElementById('formName').value.trim();
  const gender = document.querySelector('input[name="formGender"]:checked');
  const phone = document.getElementById('formPhone').value.trim();
  const submitBtn = document.getElementById('submitBtn');
  const msg = document.getElementById('formMsg');

  msg.style.display = 'none';
  if (!name) return showFormMsg('请填写姓名', true);
  if (!gender) return showFormMsg('请选择性别', true);
  if (!/^1[3-9]\d{9}$/.test(phone)) return showFormMsg('请填写正确的11位手机号', true);

  submitBtn.disabled = true;
  submitBtn.textContent = '提交中...';
  try {
    const res = await fetch('/api/appointment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        gender: gender.value,
        phone
      })
    });
    const r = await res.json();
    if (r.success) {
      showFormMsg('✅ 预约信息提交成功！我们将尽快与您联系。', false);
      document.getElementById('formName').value = '';
      document.getElementById('formPhone').value = '';
      document.querySelectorAll('input[name="formGender"]').forEach(i => i.checked = false);
      setTimeout(() => { msg.style.display = 'none'; closeConsultModal(); }, 2200);
    } else {
      showFormMsg(r.message || '提交失败', true);
    }
  } catch (e) {
    showFormMsg('网络错误，请稍后再试', true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '提交预约';
  }
}
function showFormMsg(text, isErr) {
  const msg = document.getElementById('formMsg');
  msg.textContent = text;
  msg.style.color = isErr ? '#e53935' : '#27ae60';
  msg.style.display = 'block';
}
const _submitBtnEl = document.getElementById('submitBtn');
if (_submitBtnEl) _submitBtnEl.addEventListener('click', submitForm);

// ============= 页面锚点平滑滚动 =============
document.querySelectorAll('a.nav-item, a[href^="#"]').forEach(a => {
  a.addEventListener('click', function(e) {
    const href = this.getAttribute('href') || '';
    if (!href.startsWith('#')) return;
    const tgt = document.querySelector(href);
    if (!tgt) return;
    e.preventDefault();
    tgt.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('a.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll(`a.nav-item[href="${href}"]`).forEach(n => n.classList.add('active'));
  });
});
window.addEventListener('scroll', function() {
  const pos = window.scrollY + 100;
  const ids = ['hot-section','department-section','hospital-section'];
  let activeId = 'hot-section';
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && el.offsetTop <= pos) activeId = id;
  }
  document.querySelectorAll('a.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`a.nav-item[href="#${activeId}"]`).forEach(n => n.classList.add('active'));
});

// ============= 启动 =============
loadAllSections();
