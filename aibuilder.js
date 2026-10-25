const sourceContent = document.querySelector('#sources');
const sourceSearch = document.querySelector('#search');
const groups = [['x', 'X Builder'], ['youtube', 'YouTube 博主 / 频道'], ['podcast', '播客'], ['blog', '官方博客']];
let sources = [];
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function renderSources() {
  const query = sourceSearch.value.trim().toLowerCase();
  const rows = sources.filter(x => `${x.name} ${x.platform} ${x.homepage} ${x.notes}`.toLowerCase().includes(query));
  // Keep the shared channel's one external link available when searching for Lightcone.
  const shared = rows.find(x => x.sharedWith);
  let includesSharedReference = false;
  if (shared && !rows.some(x => x.id === shared.sharedWith)) {
    const owner = sources.find(x => x.id === shared.sharedWith);
    if (owner) { rows.push(owner); includesSharedReference = true; }
  }
  document.querySelector('#source-count').textContent = query ? `显示 ${rows.length} / ${sources.length} 条${includesSharedReference ? '（含共用频道引用）' : ''}` : `共 ${sources.length} 条信息源`;
  sourceContent.innerHTML = groups.map(([key, title]) => {
    const items = rows.filter(x => x.group === key);
    if (!items.length) return '';
    return `<section class="source-group" id="${key}" aria-labelledby="heading-${key}"><h3 id="heading-${key}">${title}<span class="group-count">${items.length}</span></h3><table class="source-table"><caption class="visually-hidden">${title}的固定主页与采集说明</caption><thead><tr><th scope="col">博主 / 频道</th><th scope="col">平台</th><th scope="col">固定主页</th><th scope="col">特点 / 采集说明</th></tr></thead><tbody>${items.map(x => `<tr${x.id ? ` id="source-${esc(x.id)}"` : ''}><th scope="row" data-label="博主 / 频道">${esc(x.name)}</th><td data-label="平台">${esc(x.platform)}</td><td data-label="固定主页">${x.sharedWith ? `<span class="shared-channel">与 Y Combinator 共用频道</span><a href="#source-${esc(x.sharedWith)}">见 Y Combinator 主页 ↑</a>` : `<a href="${esc(x.homepage)}" target="_blank" rel="noopener noreferrer">${esc(x.homepage)}</a>`}</td><td data-label="特点 / 采集说明">${esc(x.notes)}</td></tr>`).join('')}</tbody></table></section>`;
  }).join('') || '<p class="message">没有符合搜索条件的信息源。</p>';
}
async function loadSources() {
  sourceContent.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('data/aibuilder.json', {cache: 'no-cache'});
    if (!response.ok) throw new Error('信息源暂时不可用');
    const data = await response.json();
    if (!Array.isArray(data.sources)) throw new Error('信息源格式不可用');
    sources = data.sources;
    renderSources();
  } catch {
    sourceContent.innerHTML = '<p class="message" role="status">信息源暂时无法打开，请刷新重试，或<a href="data/aibuilder.json">打开完整信息源数据</a>。</p>';
  } finally { sourceContent.setAttribute('aria-busy', 'false'); }
}
async function loadDates() {
  try {
    const response = await fetch('data/archive.json', {cache: 'no-cache'});
    if (!response.ok) return;
    const archive = await response.json();
    const dates = [...new Set(archive.dates)].filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort((a, b) => b.localeCompare(a));
    if (dates.length) document.querySelector('#dates').innerHTML = dates.map(date => `<a href="index.html#${date}">${date}</a>`).join('');
  } catch { /* The latest-issue link remains available if the archive is unavailable. */ }
}
sourceSearch.addEventListener('input', renderSources);
loadSources();
loadDates();
