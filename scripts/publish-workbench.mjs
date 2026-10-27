import {execFileSync} from 'node:child_process';
import {mkdir, rmdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {exportWorkbench, siteRoot, beijingDate} from './export-workbench.mjs';

const [vault,date = beijingDate()] = process.argv.slice(2);
if (!vault) throw new Error('用法：node scripts/publish-workbench.mjs <笔记库绝对路径> [YYYY-MM-DD]');
if (date !== beijingDate()) throw new Error('自动发布只允许执行当天的北京时间日期');
const git = (...args) => execFileSync('git',args,{cwd:siteRoot,encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe']}).trimEnd();
const lock = path.join(git('rev-parse','--absolute-git-dir'),'workbench-publish.lock');
await mkdir(lock).catch(error => { throw new Error(error.code === 'EEXIST' ? '已有网站同步任务或遗留锁，停止并报告；请核对后处理' : error.message); });
try {
  if (git('branch','--show-current') !== 'main') throw new Error('发布必须位于 main 分支');
  if (!/^https:\/\/github\.com\/fightorflightt\/daily-briefing(?:\.git)?\/?$|^git@github\.com:fightorflightt\/daily-briefing\.git$/.test(git('remote','get-url','origin'))) throw new Error('远程仓库不是已授权的网站');
  if (git('status','--porcelain')) throw new Error('网站工作区有未提交改动，停止同步并报告');
  git('fetch','origin','main');
  if (git('rev-list','--count','origin/main..HEAD') !== '0') throw new Error('存在未推送提交，需要人工核对后发布');
  git('merge','--ff-only','origin/main');
  const result = await exportWorkbench(vault,date);
  const allowed = new Set([`data/workbench/${date}.json`,'data/workbench/archive.json']);
  const changed = git('status','--porcelain','--untracked-files=all').split('\n').filter(Boolean).map(x => x.slice(3));
  if (changed.some(x => !allowed.has(x))) throw new Error('发现非本次发布文件的改动，停止提交并报告');
  if (changed.length) {
    git('add','--',...changed);
    git('commit','-m',`docs: 同步${date}的AI资讯、政策公告和每日复盘`);
    git('push','origin','main');
  }
  const commit = git('rev-parse','HEAD');
  const receipt = path.join(git('rev-parse','--absolute-git-dir'),'workbench-publish-receipt.json');
  let confirmed = false;
  try { const saved = JSON.parse(await readFile(receipt,'utf8')); confirmed = saved.date === date && saved.commit === commit && saved.websiteVerified; } catch {}
  if (changed.length || !confirmed) {
    const url = `https://fightorflightt.github.io/daily-briefing/data/workbench/${date}.json`;
    const local = JSON.parse(await readFile(path.join(siteRoot,'data','workbench',`${date}.json`),'utf8'));
    let verified = false;
    // Bounded deployment verification only; never create a retry job or regenerate sources.
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const response = await fetch(`${url}?commit=${commit}`,{signal:AbortSignal.timeout(15000),cache:'no-store'});
        if (response.ok && JSON.stringify(await response.json()) === JSON.stringify(local)) { verified = true; break; }
      } catch {}
      if (attempt < 5) await new Promise(resolve => setTimeout(resolve,10000));
    }
    if (!verified) throw new Error('代码已推送，网站尚未更新到本次结果；请检查现有 Pages 部署，不要重复生成资讯');
    await writeFile(receipt,JSON.stringify({date,commit,websiteVerified:true})+'\n');
  }
  console.log(JSON.stringify({...result,commit,websiteVerified:true,url:`https://fightorflightt.github.io/daily-briefing/#${date}/ai`}));
} finally { await rmdir(lock); }
