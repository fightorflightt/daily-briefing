import {readFile, writeFile, readdir, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const [vault, requestedDate] = process.argv.slice(2);
if (!vault) throw new Error('用法：node scripts/export.mjs <笔记库绝对路径> [YYYY-MM-DD]');
const date = requestedDate || new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日期格式必须是 YYYY-MM-DD');
const source = await readFile(path.join(vault, '6-资讯', 'gongzhonghao', `${date}.md`), 'utf8');
const rows = [], urls = new Set();
for (const line of source.split('\n')) {
  const match = line.match(/^\s*-\s+(.+?)[｜|]\s*(https:\/\/mp\.weixin\.qq\.com\/s\/[^\s]+)\s*$/);
  if (!match) continue;
  const parts = match[1].split('｜');
  const type = parts.length > 1 ? parts.pop().trim() : '公众号';
  const title = parts.join('｜').trim();
  const url = match[2];
  if (urls.has(url)) continue;
  urls.add(url); rows.push({type, title, url});
}
if (!rows.length) throw new Error('日报没有可发布文章，保留上一期版面并报告。');
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
await mkdir(out, {recursive:true});
const edition = {date, updatedAt:new Date().toISOString(), note:'本页为同步新增的公众号文章目录，保留原文链接；日期表示资讯记录日期，不代表文章原始发布日期。', gongzhonghao:rows};
await writeFile(path.join(out, `${date}.json`), JSON.stringify(edition, null, 2) + '\n');
const dates = (await readdir(out)).filter(x => /^\d{4}-\d{2}-\d{2}\.json$/.test(x)).map(x => x.slice(0,-5)).sort().reverse();
await writeFile(path.join(out, 'archive.json'), JSON.stringify({dates}, null, 2) + '\n');
await writeFile(path.join(out, 'latest.json'), await readFile(path.join(out, `${dates[0]}.json`)));
console.log(`${date}：已导出 ${rows.length} 篇公众号文章，历史 ${dates.length} 期。`);
