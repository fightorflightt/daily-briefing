import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, readdir, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parseNews, exportWorkbench, categories} from './export-workbench.mjs';

const date = '2026-10-27';
function fixture(category, options = {}) {
  const groups = categories[category].filter(x => category !== 'fupan' || x === '每日成长复盘');
  const counts = Object.fromEntries(groups.map((x,i) => [x,i === 0 && !options.empty ? 1 : 0]));
  const meta = {date, result:'complete', counts:{[category]:counts}, validation:{status:'passed',reader:{[category]:{count:options.empty ? 0 : 1}}}};
  const body = groups.map((name,i) => `## ${name}\n\n${i === 0 && !options.empty ? '**标题：已核验资讯**\n摘要：保留完整正文。\n源链接：https://example.com/original\n<!-- 机器核验：信息日期：2026-10-27；来源主体：官方；质量评分：90/100 -->\n' : ''}`).join('\n');
  return `# 资讯 · 2026年10月27日\n<!-- 生成核验：${JSON.stringify(meta)} -->\n${body}`;
}
test('完整正文与原始来源保留，不导出评分或机器注释', () => {
  const result = parseNews(fixture('ai'),'ai',date);
  assert.equal(result.rows.length,1);
  assert.equal(result.rows[0].body,'保留完整正文。');
  assert.deepEqual(result.rows[0].urls,['https://example.com/original']);
  assert.equal(result.rows[0].metadata,'信息日期：2026-10-27；来源主体：官方');
});
test('有效空栏目可以发布，缺栏目、错误日期、未通过和数量不符均停止', () => {
  assert.deepEqual(parseNews(fixture('ai',{empty:true}),'ai',date).rows,[]);
  for (const source of [
    fixture('ai').replace('## 技术资讯','## 无效栏目'),
    fixture('ai').replace('2026年10月27日','2026年10月26日'),
    fixture('ai').replace('"passed"','"pending"'),
    fixture('ai').replace('"AI Builder":1','"AI Builder":2'),
    fixture('ai').replace('摘要：保留完整正文。',''),
  ]) assert.throws(() => parseNews(source,'ai',date));
});
test('正文与多条复盘来源不截断', () => {
  const source = fixture('fupan').replace('保留完整正文。','长'.repeat(350)).replace('源链接：https://example.com/original','https://example.com/one\nhttps://example.com/two');
  const {rows} = parseNews(source,'fupan',date);
  assert.equal(rows[0].body.length,350); assert.equal(rows[0].urls.length,2);
});
test('独立导出与重复执行不会覆盖公众号或历史；当日内容冲突时拒绝覆盖', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),'briefing-export-test-'));
  try {
    const vault = path.join(root,'vault'), output = path.join(root,'data','workbench');
    await mkdir(path.join(root,'data'),{recursive:true});
    await writeFile(path.join(root,'data',`${date}.json`),'existing wechat');
    for (const category of Object.keys(categories)) {
      await mkdir(path.join(vault,'6-资讯',category),{recursive:true});
      await writeFile(path.join(vault,'6-资讯',category,`${date}.md`),fixture(category));
    }
    assert.equal((await exportWorkbench(vault,date,output)).changed,true);
    const original = await readFile(path.join(output,`${date}.json`),'utf8');
    assert.equal((await exportWorkbench(vault,date,output)).changed,false);
    assert.equal(await readFile(path.join(root,'data',`${date}.json`),'utf8'),'existing wechat');
    await writeFile(path.join(vault,'6-资讯','ai',`${date}.md`),fixture('ai').replace('保留完整正文。','改写正文。'));
    await assert.rejects(exportWorkbench(vault,date,output),/停止自动覆盖/);
    assert.equal(await readFile(path.join(output,`${date}.json`),'utf8'),original);
  } finally { await rm(root,{recursive:true,force:true}); }
});
test('缺少任一源文件时不写出部分网页数据', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),'briefing-partial-test-'));
  try {
    const folder = path.join(root,'6-资讯','ai'); await mkdir(folder,{recursive:true});
    await writeFile(path.join(folder,`${date}.md`),fixture('ai'));
    const output = path.join(root,'output');
    await assert.rejects(exportWorkbench(root,date,output),/ENOENT/);
    assert.equal((await readdir(root)).includes('output'),false);
  } finally { await rm(root,{recursive:true,force:true}); }
});
