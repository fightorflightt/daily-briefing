# 公众号夜读

只发布公众号文章标题、公众号名称和原始链接，支持日期回看与搜索。每天北京时间23:00由本机Codex自动化发布当天已经同步的公众号日报。

网站：https://fightorflightt.github.io/daily-briefing/

导出命令：`node scripts/export.mjs <笔记库绝对路径> [YYYY-MM-DD]`。

来源仅限 `6-资讯/gongzhonghao/YYYY-MM-DD.md`，由已有微信读书 weread_mp 流程采集。文件缺失或无有效文章时保留上一期并报告。

定时发布需要生成机上的Codex自动化能运行、网络可用且当天公众号日报已生成。已发布页面可以随时在其他设备访问。
