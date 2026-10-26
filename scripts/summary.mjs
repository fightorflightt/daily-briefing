// 仅压缩收录标题，不补充未读取原文的措施、资格、期限或成效。
const topics = [
  [/对外投资.*限制.*规则/, '对外投资限制拟议规则'],
  [/电动自行车.*新规/, '电动自行车新规'],
  [/泉州市.*十五五.*生态环境保护规划/, '泉州“十五五”生态环境保护规划'],
  [/全国服务业大会/, '全国服务业大会部署落实'],
  [/人口与经济社会发展/, '人口与经济社会发展议题'],
  [/福建省政府.*会议/, '福建省政府会议'],
  [/扫黑除恶.*专项斗争/, '扫黑除恶专项斗争部署'],
  [/中央机关.*公开遴选.*公开选调/, '中央机关公开遴选和选调报名'],
  [/餐饮消费券.*核销/, '餐饮消费券核销'],
  [/泉州市.*送岗引才/, '泉州送岗引才活动报名'],
];
function topic(title) {
  for (const [pattern, label] of topics) if (pattern.test(title)) return label;
  return title.replace(/^标题[：:]\s*/, '').replace(/[！!~→]+$/g, '');
}
function take(rows, max) { return [...new Set(rows.map(x => topic(x.title)))].slice(0, max).join('、'); }
export function buildSummary(rows) {
  if (!rows.length) return '今天没有筛选出符合条件的公众号资讯。后续继续关注政策法规、重要会议部署和具体机会。';
  const policies = [], meetings = [], opportunities = [], other = [];
  for (const row of rows) {
    if (/补贴|奖补|资助|申报|消费券|招标|采购公告|项目征集|招商|产业扶持|公开遴选|公开选调|招录|招聘|送岗引才|人才引进|五险一金/.test(row.title)) opportunities.push(row);
    else if (/会议|常务会|大会|全会|发布会/.test(row.title)) meetings.push(row);
    else if (/政策|法规|条例|新规|办法|细则|意见|印发|规划|试点|规则/.test(row.title)) policies.push(row);
    else other.push(row);
  }
  // 优先保留直接反映工作部署的政府会议，其余会议仍在下面的完整列表。
  meetings.sort((a,b) => Number(/全国服务业大会|国务院常务会|福建省政府/.test(b.title)) - Number(/全国服务业大会|国务院常务会|福建省政府/.test(a.title)));
  const clauses = [];
  if (policies.length) clauses.push(`政策法规方面，关注${take(policies,3)}`);
  if (meetings.length) clauses.push(`会议部署方面，涉及${take(meetings,3)}`);
  if (opportunities.length) clauses.push(`机会信息包括${take(opportunities,3)}`);
  if (!clauses.length) clauses.push(`主要关注${take(other,3)}`);
  return `今天筛选出${rows.length}篇资讯。${clauses.join('；')}。`;
}
