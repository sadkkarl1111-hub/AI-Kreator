#!/usr/bin/env python3
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from release_tool import allowed, extract, verify_checksum, verify_compose

COMMIT = 'a' * 40


class ReleaseTests(unittest.TestCase):
    def test_allowed_paths_exclude_secrets_and_traversal(self):
        for name in ['dist/index.html', 'dist/assets/app.js', 'vps/server/src/server.ts', 'vps/server/test/ok.test.mjs', 'vps/docker-compose.yml']:
            self.assertTrue(allowed(name), name)
        for name in ['/etc/passwd', '../etc/passwd', 'dist/../../etc/passwd', 'dist/.env', 'vps/server/src/.env.production', 'dist/secret.pem', 'dist/id_ed25519', 'dist\\file', 'dist//file', 'vps/server/node_modules/x', 'vps/.env', 'vps/server/dist/server.js']:
            self.assertFalse(allowed(name), name)

    def package(self, root, extra=None, commit=COMMIT):
        archive = root / 'release.tar.gz'
        files = {'release.json': json.dumps({'format': 1, 'commit': commit}), 'dist/index.html': 'HTML', 'dist/assets/app.js': 'JS', 'dist/_seo/index.html': 'SEO', 'vps/server/Dockerfile': 'FROM node:24-alpine', 'vps/server/package.json': '{}', 'vps/server/package-lock.json': '{}', 'vps/server/tsconfig.json': '{}', 'vps/docker-compose.yml': 'services:', 'vps/apache/seo-routes.conf': 'config'}
        with tarfile.open(archive, 'w:gz') as target:
            for name, text in files.items():
                data = text.encode()
                member = tarfile.TarInfo(name); member.size = len(data)
                target.addfile(member, io.BytesIO(data))
            if extra:
                target.addfile(extra, io.BytesIO(b'x') if extra.size else None)
        return archive

    def test_extracts_complete_release_and_matches_commit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); output = root / 'output'; output.mkdir()
            archive = self.package(root)
            self.assertEqual(extract(archive, output, COMMIT)['commit'], COMMIT)
            self.assertEqual((output / 'dist/index.html').read_text(), 'HTML')

    def test_checks_entire_archive_before_writing_anything(self):
        for name, kind in [('dist/link', tarfile.SYMTYPE), ('dist/hard', tarfile.LNKTYPE), ('../escape', tarfile.REGTYPE), ('dist/.env', tarfile.REGTYPE), ('dist/index.html', tarfile.REGTYPE)]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory); output = root / 'output'; output.mkdir()
                member = tarfile.TarInfo(name); member.type = kind; member.linkname = '/etc/passwd'
                archive = self.package(root, member)
                with self.assertRaises(ValueError): extract(archive, output, COMMIT)
                self.assertEqual(list(output.iterdir()), [])

    def test_rejects_wrong_commit_and_incomplete_package(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); output = root / 'output'; output.mkdir()
            with self.assertRaises(ValueError): extract(self.package(root, commit='b' * 40), output, COMMIT)
            with tarfile.open(root / 'empty.tar.gz', 'w:gz'): pass
            with self.assertRaises(ValueError): extract(root / 'empty.tar.gz', output, COMMIT)

    def test_checksum_rejects_corruption_and_wrong_filename(self):
        import hashlib
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); archive = self.package(root); checksum = root / 'sum'
            digest = hashlib.sha256(archive.read_bytes()).hexdigest()
            checksum.write_text(f'{digest}  {archive.name}\n')
            verify_checksum(archive, checksum)
            archive.write_bytes(b'corrupted')
            with self.assertRaises(ValueError): verify_checksum(archive, checksum)
            checksum.write_text(f'{digest}  other.tar.gz\n')
            with self.assertRaises(ValueError): verify_checksum(archive, checksum)

    def test_compose_locks_ports_and_major_database_versions(self):
        value = {'services': {name: {'ports': [{'host_ip': '127.0.0.1', 'target': target, 'published': port}]} for name, target, port in [('api', 3000, '3101'), ('postgres', 5432, '5432'), ('redis', 6379, '6379')]}}
        value['services']['postgres']['image'] = 'postgres:16-alpine'
        value['services']['redis']['image'] = 'redis:7-alpine'
        verify_compose(value)
        value['services']['postgres']['ports'][0]['host_ip'] = '0.0.0.0'
        with self.assertRaises(ValueError): verify_compose(value)
        value['services']['postgres']['ports'][0]['host_ip'] = '127.0.0.1'
        value['services']['postgres']['image'] = 'postgres:17-alpine'
        with self.assertRaises(ValueError): verify_compose(value)


if __name__ == '__main__': unittest.main()
