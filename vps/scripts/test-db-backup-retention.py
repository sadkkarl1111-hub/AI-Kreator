import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("retention", Path(__file__).with_name("db_backup_retention.py"))
retention = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retention)


def fixture(root, day):
    name = f"kreator-ai-db-202610{day:02d}T230000Z.dump"
    data = f"test snapshot {day}".encode()
    (root / name).write_bytes(data)
    digest = hashlib.sha256(data).hexdigest()
    (root / (name + ".sha256")).write_text(f"{digest}  {name}\n", encoding="ascii")
    (root / (name + ".json")).write_text(json.dumps({"dump": name, "bytes": len(data), "sha256": digest, "status": "restore_verified"}), encoding="utf-8")
    return name


class RetentionTest(unittest.TestCase):
    def test_keeps_fourteen_newest_and_preserves_other_backups(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            names = [fixture(root, day) for day in range(1, 18)]
            (root / "database.dump").write_text("manual backup")
            (root / "historical-full-backup").mkdir()
            (root / "historical-full-backup" / "database.dump").write_text("keep")
            result = retention.prune(root, names[-1], 14)
            self.assertEqual(result["kept"], 14)
            self.assertEqual(set(result["removed"]), set(names[:3]))
            for name in names[:3]:
                self.assertFalse((root / name).exists())
                self.assertFalse((root / (name + ".sha256")).exists())
                self.assertFalse((root / (name + ".json")).exists())
            self.assertTrue((root / "database.dump").exists())
            self.assertTrue((root / "historical-full-backup" / "database.dump").exists())

    def test_failed_or_corrupted_new_copy_never_deletes_old_copies(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            names = [fixture(root, day) for day in range(1, 17)]
            (root / names[-1]).write_bytes(b"x" * (root / names[-1]).stat().st_size)
            with self.assertRaises(ValueError):
                retention.prune(root, names[-1], 14)
            self.assertTrue(all((root / name).exists() for name in names))
            names[-1] = fixture(root, 16)
            (root / (names[-1] + ".json")).unlink()
            with self.assertRaises(ValueError):
                retention.prune(root, names[-1], 14)
            self.assertTrue(all((root / name).exists() for name in names))

    def test_symlinks_and_path_traversal_cannot_delete_external_files(self):
        with tempfile.TemporaryDirectory() as folder:
            parent = Path(folder).resolve()
            root = parent / "daily"
            root.mkdir()
            latest = fixture(root, 17)
            outside = parent / "outside.dump"
            outside.write_text("must remain")
            link = root / "kreator-ai-db-20261001T230000Z.dump"
            try:
                link.symlink_to(outside)
                alias = parent / "alias"
                alias.symlink_to(root, target_is_directory=True)
            except OSError:
                self.skipTest("Symlink creation is unavailable")
            retention.prune(root, latest, 1)
            self.assertEqual(outside.read_text(), "must remain")
            self.assertTrue(link.is_symlink())
            with self.assertRaises(ValueError):
                retention.prune(alias, latest, 1)
            with self.assertRaises(ValueError):
                retention.prune(root, "../outside.dump", 1)
            with self.assertRaises(ValueError):
                retention.prune(root, latest, 0)


if __name__ == "__main__":
    unittest.main()
