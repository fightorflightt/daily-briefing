"""Append today's already-collected WeRead articles to the raw daily note.

Reads the existing collector database without running another collector or
changing its data. Dates refer to collection time in Asia/Shanghai.
"""
import argparse
import datetime as dt
import fcntl
import json
import re
import sqlite3
from pathlib import Path
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo('Asia/Shanghai')
ARTICLE_URL = re.compile(r'https://mp\.weixin\.qq\.com/s/[A-Za-z0-9_~-]+')


def sync_source(vault, database, date):
    day = dt.date.fromisoformat(date)
    start = dt.datetime.combine(day, dt.time.min, SHANGHAI)
    end = start + dt.timedelta(days=1)
    database = Path(database).resolve(strict=True)
    with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True) as conn:
        records = conn.execute(
            '''SELECT a.title, a.url, COALESCE(f.mp_name, '公众号')
               FROM articles a LEFT JOIN feeds f ON f.id = a.mp_id
               WHERE a.status = 1 AND a.mp_id LIKE 'MP_WXS_%'
                 AND a.create_time >= ? AND a.create_time < ?
               ORDER BY a.create_time, a.id''',
            (int(start.timestamp()), int(end.timestamp())),
        ).fetchall()
    unique = {}
    for title, url, source in records:
        if title and url and ARTICLE_URL.fullmatch(url):
            unique.setdefault(url, (' '.join(title.splitlines()), ' '.join(source.splitlines())))
    result = {'date': date, 'database_rows': len(records), 'valid_articles': len(unique), 'appended': 0}
    if not unique:
        return result
    target = Path(vault) / '6-资讯' / 'gongzhonghao' / f'{date}.md'
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('a+', encoding='utf-8') as note:
        fcntl.flock(note, fcntl.LOCK_EX)
        note.seek(0)
        previous = note.read()
        existing = set(ARTICLE_URL.findall(previous))
        missing = [(url, *info) for url, info in unique.items() if url not in existing]
        if not missing:
            return result
        timestamp = dt.datetime.now(SHANGHAI).strftime('%Y-%m-%d %H:%M')
        header = '' if previous else f'# 公众号资讯｜{date}\n\n> 日期表示北京时间入库日期，不代表原始发布日期。\n'
        section = (f'\n\n## 已入库记录补全（{timestamp}）\n\n'
                   f'按现有微信读书采集数据库的北京时间入库日期核对：当天有效记录 {len(unique)} 篇，'
                   f'本次补记 {len(missing)} 篇。本次同步新增数不等于当天累计总数。'
                   '仅恢复已保存的标题、来源与原文链接；未补抓正文或推断原始发布时间。\n\n')
        note.write(header + section + '\n'.join(f'- {title}｜{source}｜{url}' for url, title, source in missing) + '\n')
        result['appended'] = len(missing)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('vault')
    parser.add_argument('database')
    parser.add_argument('date', nargs='?', default=dt.datetime.now(SHANGHAI).date().isoformat())
    args = parser.parse_args()
    print(json.dumps(sync_source(args.vault, args.database, args.date), ensure_ascii=False))
