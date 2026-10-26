import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('sync_source', Path(__file__).with_name('sync-daily-source.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DailySourceTest(unittest.TestCase):
    def test_recovers_persisted_day_preserves_note_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            database = root / 'collector.db'
            with sqlite3.connect(database) as conn:
                conn.executescript('CREATE TABLE feeds(id TEXT, mp_name TEXT); CREATE TABLE articles(id TEXT, title TEXT, url TEXT, mp_id TEXT, status INTEGER, create_time INTEGER);')
                conn.execute('INSERT INTO feeds VALUES (?, ?)', ('MP_WXS_1', '公众号甲'))
                start = int(module.dt.datetime(2026, 10, 26, tzinfo=module.SHANGHAI).timestamp())
                for key, seconds, status, url in [('today', 0, 1, 'https://mp.weixin.qq.com/s/today'), ('last-minute', 86399, 1, 'https://mp.weixin.qq.com/s/last'), ('yesterday', -1, 1, 'https://mp.weixin.qq.com/s/old'), ('tomorrow', 86400, 1, 'https://mp.weixin.qq.com/s/next'), ('deleted', 1, 0, 'https://mp.weixin.qq.com/s/deleted'), ('invalid', 2, 1, 'https://example.com/')]:
                    conn.execute('INSERT INTO articles VALUES (?, ?, ?, ?, ?, ?)', (key, key, url, 'MP_WXS_1', status, start + seconds))
            note = root / '6-资讯/gongzhonghao/2026-10-26.md'
            note.parent.mkdir(parents=True)
            original = '# 公众号资讯｜2026-10-26\n\n本次新增 0 篇。\n'
            note.write_text(original)
            result = module.sync_source(root, database, '2026-10-26')
            self.assertEqual((result['valid_articles'], result['appended']), (2, 2))
            self.assertTrue(note.read_text().startswith(original))
            before = note.read_bytes()
            self.assertEqual(module.sync_source(root, database, '2026-10-26')['appended'], 0)
            self.assertEqual(note.read_bytes(), before)
            with sqlite3.connect(database) as conn:
                self.assertEqual(conn.execute('SELECT count(*) FROM articles').fetchone()[0], 6)


if __name__ == '__main__':
    unittest.main()
