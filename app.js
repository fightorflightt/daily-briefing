let edition;
let loadVersion = 0;
let category = 'gongzhonghao';
let dates = [];
let archives = [];
const content = document.querySelector('#content');
const dateList = document.querySelector('#dates');
const search = document.querySelector('#search');
const tabs = [...document.querySelectorAll('[role="tab"]')];
const labels = {gongzhonghao:'公众号', ai:'AI资讯', zhengce:'政策公告', fupan:'每日复盘'};
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function safeUrl(value) {
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; }
}
function link(url, title) {
  const href = safeUrl(url);
  return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>` : esc(title);
}
async function readJson(url) {
  const response = await fetch(url, {cache:'no-cache',signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('资讯暂时无法打开');
  return response.json();
}
function selectTab() {
  for (const tab of tabs) {
    const active = tab.dataset.category === category;
    tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
  }
  content.setAttribute('aria-labelledby', `tab-${category}`);
}
function render() {
  selectTab();
  const result = category === 'gongzhonghao' ? edition?.gongzhonghao : edition?.workbench;
  if (!result?.data) {
    const text = result?.failed ? '加载失败，请点击日期重试。' : '当天尚未同步此分类。';
    content.innerHTML = `<p class="message" role="status">${esc(labels[category])}：${text}</p>`;
    return;
  }
  const data = result.data;
  const allRows = category === 'gongzhonghao' ? data.gongzhonghao : data[category];
  const query = search.value.trim().toLowerCase();
  const rows = allRows.filter(x => [x.title, x.type, x.subcategory, x.body].join(' ').toLowerCase().includes(query));
  const summary = category === 'gongzhonghao' && data.summary ? `<section class="daily-summary" aria-label="当日总结"><p>${esc(data.summary)}</p></section>` : '';
  const count = `<p class="count" role="status">${query ? `找到 ${rows.length} 条，共 ${allRows.length} 条` : `共 ${rows.length} 条`}</p>`;
  let body = '';
  if (category === 'gongzhonghao') {
    body = rows.map(x => `<article class="item">${link(x.url, x.title)}<span class="source">${esc(x.type)}</span></article>`).join('');
  } else {
    const groups = [...new Set(rows.map(x => x.subcategory))];
    body = groups.map(group => `<section class="news-group"><h3>${esc(group)}</h3>${rows.filter(x => x.subcategory === group).map(x => `<article class="item"><h4>${esc(x.title)}</h4>${x.metadata ? `<span class="source">${esc(x.metadata)}</span>` : ''}<p class="article-body">${esc(x.body)}</p><div class="article-links">${x.urls.map((url,i) => link(url, x.urls.length === 1 ? '查看原文' : `来源 ${i+1}`)).join('')}</div></article>`).join('')}</section>`).join('');
  }
  const limits = data.limitations?.[category] || [];
  const coverage = limits.length ? `<details class="coverage-note"><summary>来源覆盖说明</summary>${limits.map(x => `<p>${esc(x)}</p>`).join('')}</details>` : '';
  content.innerHTML = summary + count + body + (rows.length ? '' : `<p class="message">${query ? '没有符合搜索条件的资讯。' : '当天已核验，本分类没有可收录内容。'}</p>`) + coverage;
}
async function load(date) {
  const version = ++loadVersion;
  edition = undefined;
  document.querySelector('#issue-date').textContent = date;
  content.setAttribute('aria-busy', 'true');
  content.innerHTML = '<p class="message" role="status">正在加载资讯…</p>';
  for (const button of dateList.querySelectorAll('button')) {
    if (button.dataset.date === date) button.setAttribute('aria-current', 'date');
    else button.removeAttribute('aria-current');
  }
  const results = await Promise.all(archives.map(async archive => {
    if (!archive.dates.includes(date)) return {failed:archive.failed};
    try {
      const data = await readJson(`${archive.path}/${date}.json`);
      const keys = archive.key === 'gongzhonghao' ? ['gongzhonghao'] : ['ai','zhengce','fupan'];
      if (data.date !== date || keys.some(key => !Array.isArray(data[key]))) throw new Error('日期或分类数据不可用');
      return {data};
    } catch { return {failed:true}; }
  }));
  if (version !== loadVersion) return;
  edition = Object.fromEntries(archives.map((archive,i) => [archive.key,results[i]]));
  render();
  content.setAttribute('aria-busy', 'false');
}
function route() {
  const [rawDate, rawCategory] = location.hash.slice(1).split('/');
  const date = dates.includes(rawDate) ? rawDate : dates[0];
  category = Object.hasOwn(labels, rawCategory) ? rawCategory : 'gongzhonghao';
  selectTab();
  const result = category === 'gongzhonghao' ? edition?.gongzhonghao : edition?.workbench;
  if (document.querySelector('#issue-date').textContent === date && edition && !result?.failed) render();
  else load(date);
}
function navigate(date, nextCategory) {
  const hash = `${date}/${nextCategory}`;
  if (location.hash.slice(1) === hash) route();
  else location.hash = hash;
}
async function init() {
  try {
    const definitions = [{key:'gongzhonghao',path:'data'},{key:'workbench',path:'data/workbench'}];
    const results = await Promise.allSettled(definitions.map(x => readJson(`${x.path}/archive.json`)));
    archives = definitions.map((x,i) => ({...x, failed:results[i].status === 'rejected', dates:results[i].status === 'fulfilled' && Array.isArray(results[i].value.dates) ? results[i].value.dates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : []}));
    dates = [...new Set(archives.flatMap(x => x.dates))].sort((a,b) => b.localeCompare(a));
    if (!dates.length) throw new Error('暂未发布资讯');
    for (const date of dates) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.date = date; button.textContent = date;
      button.onclick = () => navigate(date, category);
      dateList.append(button);
    }
    search.oninput = () => { if (edition) render(); };
    tabs.forEach((tab,index) => {
      tab.onclick = () => navigate(document.querySelector('#issue-date').textContent, tab.dataset.category);
      tab.onkeydown = event => {
        let next;
        if (event.key === 'ArrowRight') next = (index+1)%tabs.length;
        if (event.key === 'ArrowLeft') next = (index+tabs.length-1)%tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length-1;
        if (next === undefined) return;
        event.preventDefault(); tabs[next].focus(); tabs[next].click();
      };
    });
    window.addEventListener('hashchange', route);
    route();
  } catch {
    document.querySelector('#issue-date').textContent = '每日资讯';
    content.innerHTML = '<p class="message" role="status">资讯目录暂时无法打开，请稍后刷新。</p>';
    content.setAttribute('aria-busy', 'false');
  }
}
init();
