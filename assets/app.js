/* ===== 机器学习知识库 & 题库 SPA ===== */
const App = (() => {
  const appEl = document.getElementById('app');
  let index = null;            // lectures.json
  const lectureCache = {};     // id -> lecture data
  let searchIndex = null;      // built lazily

  /* ---------- utils ---------- */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // very small markdown-ish renderer (keeps $...$ math intact for KaTeX)
  function mdToHtml(src) {
    if (!src) return '';
    if (Array.isArray(src)) src = src.join('\n');
    const lines = String(src).split('\n');
    let html = '', listType = null, inCode = false, code = '';
    const flushList = () => { if (listType) { html += `</${listType}>`; listType = null; } };
    const inline = (t) => esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // restore $...$ that esc() touched (only < > & inside math are rare; keep simple)
      ;
    for (let raw of lines) {
      const line = raw.replace(/\s+$/, '');
      if (line.trim().startsWith('```')) {
        if (inCode) { html += `<pre><code>${esc(code)}</code></pre>`; code = ''; inCode = false; }
        else { flushList(); inCode = true; }
        continue;
      }
      if (inCode) { code += raw + '\n'; continue; }
      if (!line.trim()) { flushList(); continue; }
      let m;
      if ((m = line.match(/^>\s?(.*)/))) { flushList(); html += `<div class="note">${inline(m[1])}</div>`; continue; }
      if ((m = line.match(/^[-*]\s+(.*)/))) {
        if (listType !== 'ul') { flushList(); html += '<ul>'; listType = 'ul'; }
        html += `<li>${inline(m[1])}</li>`; continue;
      }
      if ((m = line.match(/^\d+\.\s+(.*)/))) {
        if (listType !== 'ol') { flushList(); html += '<ol>'; listType = 'ol'; }
        html += `<li>${inline(m[1])}</li>`; continue;
      }
      if ((m = line.match(/^#{2,4}\s+(.*)/))) { flushList(); html += `<h4>${inline(m[1])}</h4>`; continue; }
      flushList();
      html += `<p>${inline(line)}</p>`;
    }
    flushList();
    if (inCode) html += `<pre><code>${esc(code)}</code></pre>`;
    return html;
  }

  function renderMath(scope) {
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(scope || document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true },
          ],
          throwOnError: false,
        });
      } catch (e) { /* noop */ }
    }
  }

  async function getIndex() {
    if (index) return index;
    index = await fetch('./data/lectures.json').then(r => r.json());
    return index;
  }
  async function getLecture(id) {
    if (lectureCache[id]) return lectureCache[id];
    try {
      const data = await fetch(`./data/${id}.json`).then(r => r.ok ? r.json() : null);
      lectureCache[id] = data;
      return data;
    } catch (e) { return null; }
  }
  async function getAllLectures() {
    const idx = await getIndex();
    const all = await Promise.all(idx.lectures.map(l => getLecture(l.id)));
    return idx.lectures.map((meta, i) => ({ meta, data: all[i] })).filter(x => x.data);
  }

  /* ---------- views ---------- */
  async function viewHome() {
    const idx = await getIndex();
    const all = await getAllLectures();
    let totalKp = 0, totalQ = 0;
    const counts = {};
    all.forEach(({ meta, data }) => {
      const kp = (data.knowledgePoints || []).length;
      const q = (data.questions || []).length;
      totalKp += kp; totalQ += q; counts[meta.id] = { kp, q };
    });
    const cards = idx.lectures.map(l => {
      const c = counts[l.id] || { kp: 0, q: 0 };
      return `<a class="card" href="#/lecture/${l.id}">
        <div class="c-top"><span class="c-icon">${l.icon || '📘'}</span>
          <div><div class="c-order">第 ${l.order} 讲</div><h3 class="c-title">${esc(l.title)}</h3></div></div>
        <div class="c-en">${esc(l.en || '')}</div>
        <div class="c-desc">${esc(l.desc || '')}</div>
        <div class="c-meta"><span>知识点 <b>${c.kp}</b></span><span>题目 <b>${c.q}</b></span></div>
      </a>`;
    }).join('');
    appEl.innerHTML = `
      <section class="hero">
        <h1>${esc(idx.course)}</h1>
        <div class="sub">${esc(idx.subtitle)} · 授课老师 ${esc(idx.instructor)}</div>
        <div class="hero-stats">
          <div class="stat"><b>${idx.lectures.length}</b><span>讲次</span></div>
          <div class="stat"><b>${totalKp}</b><span>知识点</span></div>
          <div class="stat"><b>${totalQ}</b><span>题目</span></div>
        </div>
        <p class="sub">点击讲次查看知识点讲解，或前往 <a href="#/quiz">题库练习</a> 自测。</p>
      </section>
      <h2 class="section-title">📖 课程讲次</h2>
      <div class="grid">${cards}</div>`;
  }

  async function viewLecture(id) {
    const idx = await getIndex();
    const meta = idx.lectures.find(l => l.id === id);
    const data = await getLecture(id);
    if (!meta || !data) { appEl.innerHTML = `<div class="empty">未找到该讲次内容。<br><a href="#/">返回首页</a></div>`; return; }
    const kps = data.knowledgePoints || [];
    const toc = kps.map((k, i) => `<a href="#kp-${i}" data-toc="${i}">${i + 1}. ${esc(k.title)}</a>`).join('');
    const body = kps.map((k, i) => `
      <div class="kp" id="kp-${i}">
        <h3><span class="kp-num">${i + 1}</span>${esc(k.title)}</h3>
        <div class="kp-body">${mdToHtml(k.content)}</div>
        ${(k.tags && k.tags.length) ? `<div class="tags">${k.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>`).join('');
    const qCount = (data.questions || []).length;
    appEl.innerHTML = `
      <div class="lec-head">
        <div class="crumb"><a href="#/">首页</a> / 第 ${meta.order} 讲</div>
        <h1>${meta.icon || ''} ${esc(data.title || meta.title)}</h1>
        <div class="en">${esc(data.subtitle || meta.en || '')}</div>
        ${data.summary ? `<div class="summary">${mdToHtml(data.summary)}</div>` : ''}
      </div>
      <div class="lec-layout">
        <nav class="toc">${toc}<div class="kp-foot"><a class="pill active" href="#/quiz/${id}">📝 本讲练习 (${qCount})</a></div></nav>
        <div class="kp-list">${body || '<div class="empty">本讲内容整理中…</div>'}</div>
      </div>`;
    renderMath(appEl);
    setupToc(kps.length);
  }

  function setupToc(n) {
    const links = [...appEl.querySelectorAll('.toc a[data-toc]')];
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          const i = en.target.id.replace('kp-', '');
          links.forEach(a => a.classList.toggle('active', a.dataset.toc === i));
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    appEl.querySelectorAll('.kp').forEach(el => obs.observe(el));
  }

  /* ---------- quiz ---------- */
  let quizState = { lec: 'all', type: 'all', diff: 'all', questions: [], answers: {} };

  async function viewQuiz(presetLec) {
    const idx = await getIndex();
    const all = await getAllLectures();
    const pool = [];
    all.forEach(({ meta, data }) => {
      (data.questions || []).forEach(q => pool.push({ ...q, _lec: meta.id, _lecTitle: meta.title, _order: meta.order }));
    });
    if (presetLec) quizState.lec = presetLec;
    quizState._pool = pool;

    const lecOpts = ['<option value="all">全部讲次</option>']
      .concat(idx.lectures.map(l => `<option value="${l.id}" ${quizState.lec === l.id ? 'selected' : ''}>第${l.order}讲 ${esc(l.title)}</option>`)).join('');

    appEl.innerHTML = `
      <div class="lec-head"><h1>📝 题库练习</h1><div class="en">共 ${pool.length} 道题 · 选择讲次与条件后开始自测</div></div>
      <div class="quiz-toolbar">
        <select id="qLec">${lecOpts}</select>
        <select id="qType">
          <option value="all">全部题型</option>
          <option value="single">单选</option>
          <option value="multiple">多选</option>
          <option value="truefalse">判断</option>
          <option value="short">简答</option>
        </select>
        <select id="qDiff">
          <option value="all">全部难度</option>
          <option value="easy">简单</option>
          <option value="medium">中等</option>
          <option value="hard">困难</option>
        </select>
        <span class="grow"></span>
        <button id="qShuffle">🔀 乱序</button>
        <button id="qStart" class="btn-primary">开始 / 筛选</button>
      </div>
      <div id="quizArea"></div>`;

    const sync = () => { quizState.lec = qLec.value; quizState.type = qType.value; quizState.diff = qDiff.value; };
    const qLec = document.getElementById('qLec'), qType = document.getElementById('qType'), qDiff = document.getElementById('qDiff');
    qType.value = quizState.type; qDiff.value = quizState.diff;
    document.getElementById('qStart').onclick = () => { sync(); buildQuiz(false); };
    document.getElementById('qShuffle').onclick = () => { sync(); buildQuiz(true); };
    buildQuiz(false);
  }

  function buildQuiz(shuffle) {
    let qs = quizState._pool.filter(q =>
      (quizState.lec === 'all' || q._lec === quizState.lec) &&
      (quizState.type === 'all' || q.type === quizState.type) &&
      (quizState.diff === 'all' || q.difficulty === quizState.diff));
    if (shuffle) qs = shuffleArr(qs.slice());
    quizState.questions = qs; quizState.answers = {};
    const area = document.getElementById('quizArea');
    if (!qs.length) { area.innerHTML = `<div class="empty">没有符合条件的题目，换个筛选试试。</div>`; return; }
    area.innerHTML = `
      <div class="quiz-summary" id="quizSummary">本组共 <b>${qs.length}</b> 道题。作答后点「显示答案」查看解析，或答完点「提交全部」统计得分。
        <div class="q-actions"><button id="submitAll" class="btn-primary">提交全部 ✅</button><button id="revealAll">显示全部答案</button></div>
      </div>
      ${qs.map((q, i) => renderQuestion(q, i)).join('')}`;
    qs.forEach((q, i) => bindQuestion(q, i));
    document.getElementById('submitAll').onclick = submitAll;
    document.getElementById('revealAll').onclick = () => quizState.questions.forEach((q, i) => revealQuestion(q, i));
    renderMath(area);
  }

  const LETTERS = 'ABCDEFGH';
  function renderQuestion(q, i) {
    const typeLabel = { single: '单选', multiple: '多选', truefalse: '判断', short: '简答' }[q.type] || '题目';
    const diffLabel = { easy: '简单', medium: '中等', hard: '困难' }[q.difficulty] || '';
    let bodyHtml = '';
    if (q.type === 'short') {
      bodyHtml = `<div class="short-ans"><textarea id="ta-${i}" placeholder="在此作答（自我检测，不评分）…"></textarea></div>`;
    } else if (q.type === 'truefalse') {
      bodyHtml = ['正确', '错误'].map((t, k) =>
        `<div class="opt" data-q="${i}" data-k="${k === 0}"><span class="opt-key">${k === 0 ? '✓' : '✗'}</span><span>${t}</span></div>`).join('');
    } else {
      bodyHtml = (q.options || []).map((o, k) =>
        `<div class="opt" data-q="${i}" data-k="${LETTERS[k]}"><span class="opt-key">${LETTERS[k]}</span><span>${esc(o)}</span></div>`).join('');
    }
    return `
      <div class="q-card" id="q-${i}">
        <div class="q-meta">
          <span class="badge type">${typeLabel}</span>
          ${diffLabel ? `<span class="badge ${q.difficulty}">${diffLabel}</span>` : ''}
          <span class="badge lec">第${q._order}讲 ${esc(q._lecTitle)}</span>
        </div>
        <div class="q-stem"><span class="qn">${i + 1}.</span>${esc(q.stem)}</div>
        <div class="q-opts">${bodyHtml}</div>
        <div class="q-actions">
          <button data-reveal="${i}">显示答案</button>
        </div>
        <div class="explain" id="ex-${i}"></div>
      </div>`;
  }

  function bindQuestion(q, i) {
    const card = document.getElementById(`q-${i}`);
    if (q.type !== 'short') {
      card.querySelectorAll('.opt').forEach(opt => {
        opt.onclick = () => {
          const k = opt.dataset.k;
          if (q.type === 'multiple') {
            const set = new Set(quizState.answers[i] || []);
            set.has(k) ? set.delete(k) : set.add(k);
            quizState.answers[i] = [...set];
            opt.classList.toggle('selected');
          } else {
            quizState.answers[i] = (q.type === 'truefalse') ? (k === 'true') : k;
            card.querySelectorAll('.opt').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
          }
        };
      });
    }
    card.querySelector(`[data-reveal="${i}"]`).onclick = () => revealQuestion(q, i);
  }

  function normAns(q) {
    if (q.type === 'multiple') return [].concat(q.answer).map(String).sort().join('');
    if (q.type === 'truefalse') return String(q.answer);
    return String(q.answer);
  }
  function userAns(q, i) {
    const a = quizState.answers[i];
    if (a == null) return null;
    if (q.type === 'multiple') return [].concat(a).map(String).sort().join('');
    return String(a);
  }

  function revealQuestion(q, i) {
    const card = document.getElementById(`q-${i}`);
    const ex = document.getElementById(`ex-${i}`);
    if (q.type !== 'short') {
      const correctKeys = q.type === 'multiple' ? [].concat(q.answer).map(String)
        : q.type === 'truefalse' ? [String(q.answer)] : [String(q.answer)];
      card.querySelectorAll('.opt').forEach(o => {
        const k = o.dataset.k;
        const isCorrect = correctKeys.includes(k);
        const isPicked = o.classList.contains('selected');
        o.classList.remove('selected');
        if (isCorrect) o.classList.add('correct');
        else if (isPicked) o.classList.add('wrong');
      });
    }
    const ansText = q.type === 'truefalse' ? (q.answer ? '正确' : '错误')
      : q.type === 'multiple' ? [].concat(q.answer).join('、')
      : q.type === 'short' ? '' : q.answer;
    ex.innerHTML = `
      ${q.type === 'short'
        ? `<div class="ex-head">参考答案</div><div>${mdToHtml(q.answer)}</div>`
        : `<div class="ex-head">正确答案：<span class="ex-ans">${esc(ansText)}</span></div>`}
      ${q.explanation ? `<div class="ex-head" style="margin-top:8px">解析</div><div>${mdToHtml(q.explanation)}</div>` : ''}`;
    ex.classList.add('show');
    renderMath(ex);
  }

  function submitAll() {
    let correct = 0, graded = 0;
    quizState.questions.forEach((q, i) => {
      revealQuestion(q, i);
      if (q.type === 'short') return;
      graded++;
      if (userAns(q, i) !== null && userAns(q, i) === normAns(q)) correct++;
    });
    const sum = document.getElementById('quizSummary');
    const pct = graded ? Math.round(correct / graded * 100) : 0;
    sum.innerHTML = `成绩：客观题答对 <b>${correct}</b> / ${graded}（${pct}%）${quizState.questions.some(q=>q.type==='short')?'，简答题请对照参考答案自评。':''}
      <div class="q-actions"><button id="retry" class="btn-primary">重做本组</button></div>`;
    document.getElementById('retry').onclick = () => buildQuiz(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function shuffleArr(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((i + 1) * pseudo()); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  let _seed = 1;
  function pseudo() { _seed = (_seed * 9301 + 49297) % 233280; return _seed / 233280; }

  /* ---------- search ---------- */
  async function buildSearch() {
    if (searchIndex) return searchIndex;
    const all = await getAllLectures();
    const items = [];
    all.forEach(({ meta, data }) => {
      (data.knowledgePoints || []).forEach((k, i) => {
        items.push({ kind: '知识点', lec: meta.title, title: k.title, text: (k.title + ' ' + (Array.isArray(k.content) ? k.content.join(' ') : k.content || '')).toLowerCase(), href: `#/lecture/${meta.id}` });
      });
      (data.questions || []).forEach(q => {
        items.push({ kind: '题目', lec: meta.title, title: q.stem, text: (q.stem || '').toLowerCase(), href: `#/quiz/${meta.id}` });
      });
      items.push({ kind: '讲次', lec: meta.title, title: meta.title + ' ' + (meta.en||''), text: (meta.title + ' ' + (meta.en||'') + ' ' + (meta.desc||'')).toLowerCase(), href: `#/lecture/${meta.id}` });
    });
    searchIndex = items;
    return items;
  }
  async function doSearch(qstr) {
    const box = document.getElementById('searchResults');
    const q = qstr.trim().toLowerCase();
    if (!q) { box.hidden = true; return; }
    const items = await buildSearch();
    const hits = items.filter(it => it.text.includes(q)).slice(0, 30);
    box.hidden = false;
    box.innerHTML = hits.length ? hits.map(h =>
      `<a class="sr-item" href="${h.href}"><div class="sr-kind">${h.kind} · ${esc(h.lec)}</div><div class="sr-title">${esc(h.title.slice(0, 70))}</div></a>`
    ).join('') : `<div class="sr-empty">没有找到「${esc(qstr)}」</div>`;
  }

  /* ---------- router ---------- */
  async function route() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const parts = hash.split('/').filter(Boolean); // e.g. ['lecture','l2']
    document.getElementById('searchResults').hidden = true;
    setActiveNav(parts[0] || 'home');
    appEl.innerHTML = `<div class="loading">加载中…</div>`;
    try {
      if (!parts.length || parts[0] === 'home') return void await viewHome();
      if (parts[0] === 'lectures') return void await viewHome();
      if (parts[0] === 'lecture') return void await viewLecture(parts[1]);
      if (parts[0] === 'quiz') return void await viewQuiz(parts[1] || null);
      await viewHome();
    } catch (e) {
      appEl.innerHTML = `<div class="empty">加载出错：${esc(e.message)}<br><a href="#/">返回首页</a></div>`;
      console.error(e);
    }
    window.scrollTo(0, 0);
  }

  function setActiveNav(key) {
    const map = { '': 'home', 'home': 'home', 'lectures': 'lectures', 'lecture': 'lectures', 'quiz': 'quiz' };
    const active = map[key] || 'home';
    document.querySelectorAll('.topnav a').forEach(a => a.classList.toggle('active', a.dataset.nav === active));
  }

  /* ---------- theme ---------- */
  function initTheme() {
    const saved = localStorage.getItem('ml-theme');
    const t = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
    const btn = document.getElementById('themeToggle');
    btn.textContent = t === 'dark' ? '☀️' : '🌙';
    btn.onclick = () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('ml-theme', next);
      btn.textContent = next === 'dark' ? '☀️' : '🌙';
    };
  }

  function init() {
    initTheme();
    const si = document.getElementById('globalSearch');
    let t; si.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => doSearch(si.value), 150); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-box')) document.getElementById('searchResults').hidden = true;
    });
    window.addEventListener('hashchange', route);
    route();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  return {};
})();
