let edition;
const content = document.querySelector('#content');
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function render() {
  const query = document.querySelector('#search').value.trim().toLowerCase();
  const rows = edition.gongzhonghao.filter(x => `${x.title} ${x.type}`.toLowerCase().includes(query));
  content.innerHTML = `<div class="section-title"><h3>公众号文章</h3><span class="count">${rows.length} / ${edition.gongzhonghao.length} 篇</span></div><p class="edition-note">${esc(edition.note)}</p>` + rows.map(x => `<article class="item"><div class="tag">${esc(x.type)}</div><div><h4><a class="article-title" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a></h4><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">阅读原文 ↗</a></div></article>`).join('') + (rows.length ? '' : '<p class="loading">没有符合条件的文章。</p>');
}
async function load(url) {
  const response = await fetch(url, {cache:'no-cache'});
  if (!response.ok) throw new Error('版面暂时无法打开');
  const next = await response.json();
  if (!Array.isArray(next.gongzhonghao)) throw new Error('版面数据不可用');
  edition = next;
  document.querySelector('#issue-date').textContent = edition.date;
  render();
}
async function init() {
  try {
    await load('data/latest.json');
    const response = await fetch('data/archive.json', {cache:'no-cache'});
    if (!response.ok) throw new Error('历史目录暂时无法打开');
    const archive = await response.json();
    const select = document.querySelector('#issue-select');
    for (const date of archive.dates) {
      const option = document.createElement('option');
      option.value = date; option.textContent = date; select.append(option);
    }
    select.value = edition.date;
    select.onchange = () => load(`data/${select.value}.json`).catch(() => {content.textContent = '该日期暂时无法打开，请刷新重试。';});
    document.querySelector('#search').oninput = render;
  } catch { content.textContent = '版面暂时无法打开，请稍后刷新。'; }
}
init();
