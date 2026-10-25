let edition;
let loadVersion = 0;
const content = document.querySelector('#content');
const dateList = document.querySelector('#dates');
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function render() {
  const query = document.querySelector('#search').value.trim().toLowerCase();
  const rows = edition.gongzhonghao.filter(x => `${x.title} ${x.type}`.toLowerCase().includes(query));
  content.innerHTML = `<p class="count" role="status">${query ? `找到 ${rows.length} 篇，共 ${edition.gongzhonghao.length} 篇` : `共 ${rows.length} 篇`}</p>` + rows.map(x => `<article class="item"><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a><span class="source">${esc(x.type)}</span></article>`).join('') + (rows.length ? '' : '<p class="message">没有符合条件的文章。</p>');
}
async function load(date) {
  const version = ++loadVersion;
  content.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(`data/${date}.json`, {cache:'no-cache'});
    if (!response.ok) throw new Error('文章暂时无法打开');
    const next = await response.json();
    if (!Array.isArray(next.gongzhonghao)) throw new Error('文章数据不可用');
    if (version !== loadVersion) return;
    edition = next;
    document.querySelector('#issue-date').textContent = edition.date;
    for (const button of dateList.querySelectorAll('button')) {
      if (button.dataset.date === date) button.setAttribute('aria-current', 'date');
      else button.removeAttribute('aria-current');
    }
    render();
  } catch {
    if (version === loadVersion) content.innerHTML = '<p class="message" role="status">该日期暂时无法打开，请点击日期重试。</p>';
  } finally {
    if (version === loadVersion) content.setAttribute('aria-busy', 'false');
  }
}
async function init() {
  try {
    const response = await fetch('data/archive.json', {cache:'no-cache'});
    if (!response.ok) throw new Error('目录暂时无法打开');
    const archive = await response.json();
    const dates = [...new Set(archive.dates)].filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort((a, b) => b.localeCompare(a));
    if (!dates.length) throw new Error('暂未发布文章');
    for (const date of dates) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.date = date; button.textContent = date;
      button.onclick = () => load(date);
      dateList.append(button);
    }
    document.querySelector('#search').oninput = () => { if (edition) render(); };
    await load(dates[0]);
  } catch { document.querySelector('#issue-date').textContent = '公众号文章'; content.innerHTML = '<p class="message" role="status">文章目录暂时无法打开，请稍后刷新。</p>'; content.setAttribute('aria-busy', 'false'); }
}
init();
