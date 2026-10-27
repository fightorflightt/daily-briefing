import {readFile, writeFile, readdir, mkdir, rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const categories = {
  ai:['AI Builder','GitHub 精选','产品灵感','技术资讯'],
  zhengce:['全国视野','福建视野','泉州视野','数字经济'],
  fupan:['每日成长复盘','每周行动清单','每周政策与岗位复盘','每周成长周报','每月总结'],
};
const aliases = {'Follow Builders':'AI Builder','AI变现':'AI Builder','AI 变现':'AI Builder','GitHub精选':'GitHub 精选'};
export function beijingDate() {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function assertDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date) throw new Error('日期格式或日期无效');
}
export function parseNews(source, category, date) {
  const marker = source.match(/<!--\s*生成核验[：:]\s*(\{[^\n]*\})\s*-->/);
  if (!marker) throw new Error(`${category} 缺少生成核验信息，停止同步`);
  const meta = JSON.parse(marker[1]);
  if (meta.date !== date || meta.validation?.status !== 'passed' || !['complete','complete_with_limitations'].includes(meta.result)) throw new Error(`${category} 日期或校验状态未通过`);
  const headerDate = source.match(/^# .*?(\d{4})年(\d{2})月(\d{2})日/m);
  if (!headerDate || headerDate.slice(1).join('-') !== date) throw new Error(`${category} 正文日期不一致`);
  const rows = [], headings = new Set();
  let subcategory, current;
  function finish() {
    if (!current) return;
    const body = current.lines.join('\n').trim().replace(/^摘要[：:]\s*/, '');
    if (!body) throw new Error(`${category} 存在未完成的空正文：${current.title}`);
    rows.push({subcategory, title:current.title, body, urls:[...new Set(current.urls)], metadata:current.metadata});
    current = undefined;
  }
  for (const line of source.split('\n')) {
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      finish(); subcategory = aliases[heading[1].trim()] || heading[1].trim();
      if (!categories[category].includes(subcategory)) throw new Error(`无法识别栏目：${subcategory}`);
      headings.add(subcategory); continue;
    }
    const title = line.match(/^\*\*(.+?)\*\*\s*$/);
    if (title) {
      finish();
      if (!subcategory) throw new Error('条目缺少栏目');
      current = {title:title[1].replace(/^(标题|产品[／/]功能|工具[／/]能力)[：:]\s*/, '').trim(), lines:[], urls:[], metadata:''};
      continue;
    }
    if (!current) continue;
    const machine = line.match(/^<!--\s*机器核验[：:]\s*(.*?)\s*-->$/);
    if (machine) {
      current.metadata = machine[1].split('；').filter(x => !/^质量评分[：:]/.test(x)).join('；'); continue;
    }
    if (/^\s*<!--/.test(line) || /^#{1,4} /.test(line)) continue;
    const urls = [...line.matchAll(/https?:\/\/[^\s)<>]+/g)].map(x => x[0]);
    for (const url of urls) {
      const parsed = new URL(url);
      if (parsed.username || parsed.password) throw new Error('来源链接包含认证信息，停止同步');
      current.urls.push(url);
    }
    if (/^(源链接|来源 URL)[：:]/.test(line) || /^https?:\/\/\S+\s*$/.test(line)) continue;
    if (line.trim()) current.lines.push(line.trim());
  }
  finish();
  const required = category === 'fupan' ? ['每日成长复盘'] : categories[category];
  if (required.some(x => !headings.has(x))) throw new Error(`${category} 缺少必要栏目`);
  const expected = meta.counts?.[category];
  const verified = meta.validation?.reader?.[category];
  if (!expected || !verified) throw new Error(`${category} 缺少条目核验数量`);
  for (const group of new Set([...headings,...Object.keys(expected)])) {
    if (rows.filter(x => x.subcategory === group).length !== expected[group]) throw new Error(`${category}/${group} 条目数量不符`);
  }
  if (verified.count !== rows.length) throw new Error(`${category} 与工作台读取数量不一致`);
  return {rows,meta};
}
export async function buildEdition(vault, date) {
  assertDate(date);
  const snapshots = await Promise.all(Object.keys(categories).map(async category => {
    const filename = path.join(vault,'6-资讯',category,`${date}.md`);
    const source = await readFile(filename,'utf8');
    return {category,filename,source,...parseNews(source,category,date)};
  }));
  const edition = {date, source:'已通过本地资讯质量校验的当日文件', sourceHashes:{}, limitations:{}};
  for (const snapshot of snapshots) {
    const {category,source,rows,meta} = snapshot;
    edition[category] = rows;
    edition.sourceHashes[category] = createHash('sha256').update(source).digest('hex');
    const key = {ai:'builder',zhengce:'policy',fupan:'review'}[category];
    edition.limitations[category] = meta.coverage?.[key]?.limitations || [];
    if (meta.result === 'complete_with_limitations' && !edition.limitations[category].length) edition.limitations[category] = ['本次资讯按可核验来源生成；未覆盖来源及访问限制已记录在本地日报。'];
  }
  // Only publish selected content, never the full metadata or local source paths.
  if (/(?:\/Users\/|\/tmp\/|file:\/\/)/.test(JSON.stringify(edition))) throw new Error('公开数据中出现本地路径，停止同步');
  return {edition,snapshots};
}
export async function exportWorkbench(vault, date, output = path.join(siteRoot,'data','workbench')) {
  const {edition,snapshots} = await buildEdition(vault,date);
  // Validate every source before changing any website data, then check for concurrent edits.
  for (const snapshot of snapshots) if (await readFile(snapshot.filename,'utf8') !== snapshot.source) throw new Error('源文件已被其他任务修改，停止同步');
  await mkdir(output,{recursive:true});
  const serialized = JSON.stringify(edition,null,2)+'\n';
  const filename = path.join(output,`${date}.json`);
  let previous;
  try { previous = await readFile(filename,'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous && previous !== serialized) throw new Error('网站已存在不同的当日资讯，停止自动覆盖，请人工核对');
  const changed = previous !== serialized;
  if (changed) {
    const staging = `${filename}.${process.pid}.pending`;
    await writeFile(staging,serialized,{flag:'wx'}); await rename(staging,filename);
  }
  const dates = (await readdir(output)).filter(x => /^\d{4}-\d{2}-\d{2}\.json$/.test(x)).map(x => x.slice(0,-5)).sort().reverse();
  const archive = JSON.stringify({dates},null,2)+'\n';
  const archiveFile = path.join(output,'archive.json');
  let oldArchive;
  try { oldArchive = await readFile(archiveFile,'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (oldArchive !== archive) {
    const staging = `${archiveFile}.${process.pid}.pending`;
    await writeFile(staging,archive,{flag:'wx'}); await rename(staging,archiveFile);
  }
  return {changed,counts:Object.fromEntries(Object.keys(categories).map(key => [key,edition[key].length]))};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [vault,date = beijingDate()] = process.argv.slice(2);
  if (!vault) throw new Error('用法：node scripts/export-workbench.mjs <笔记库绝对路径> [YYYY-MM-DD]');
  console.log(JSON.stringify(await exportWorkbench(vault,date)));
}
