#!/usr/bin/env python3
"""Exercise the real deployment script with fake Docker/network commands.

All paths are rewritten into a private temporary directory; real rsync/tar
verify file restoration. No production paths or live containers are accessed.
Run on Linux as root (the script checks ownership and uses www-data).
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import test_release_tool as fixtures

COMMIT = fixtures.COMMIT

HERE = Path(__file__).resolve().parent
OLD_IMAGE = 'sha256:' + '1' * 64


@unittest.skipUnless(os.name == 'posix' and os.geteuid() == 0, 'Linux root test with www-data and rsync')
class TransactionTests(unittest.TestCase):
    def run_release(self, scenario, api=False):
        with tempfile.TemporaryDirectory(prefix='ai-kreator-transaction-') as directory:
            root = Path(directory)
            for name in ['source/vps/server/src', 'webroot/assets', 'inbox', 'bin']:
                (root / name).mkdir(parents=True)
            (root / 'inbox').chmod(0o700)
            (root / 'source/vps/server/src/server.ts').write_text('OLD SOURCE')
            (root / 'source/vps/server/.env').write_text('KEEP SERVER SECRET')
            (root / 'source/vps/.env').write_text('KEEP ROOT SECRET')
            (root / 'source/vps/docker-compose.yml').write_text('services:')
            (root / 'webroot/index.html').write_text('OLD INDEX')
            (root / 'webroot/assets/old.js').write_text('OLD HASHED ASSET')
            (root / 'webroot/deployment-check.json').write_text('{"commit":"OLD"}')
            (root / 'seo.conf').write_text('OLD CONFIG')
            (root / 'image').write_text('old')
            shutil.copy2(HERE / 'release_tool.py', root / 'release_tool.py')
            archive = fixtures.ReleaseTests().package(root)
            # The package helper's HTML is the new frontend; append actual API
            # source so API rollback must restore and remove obsolete files.
            import tarfile, io
            with tarfile.open(archive, 'r:gz') as source:
                entries = [(member, source.extractfile(member).read()) for member in source.getmembers()]
            with tarfile.open(archive, 'w:gz') as target:
                for member, data in entries:
                    target.addfile(member, io.BytesIO(data))
                data = b'NEW SOURCE'; member = tarfile.TarInfo('vps/server/src/server.ts'); member.size = len(data)
                target.addfile(member, io.BytesIO(data))
                data = b'// test'; member = tarfile.TarInfo('vps/server/test/ok.test.mjs'); member.size = len(data)
                target.addfile(member, io.BytesIO(data))
            uploaded = root / 'inbox' / f'{COMMIT}.tar.gz'
            shutil.move(archive, uploaded); uploaded.chmod(0o600)
            checksum = Path(str(uploaded) + '.sha256')
            checksum.write_text(hashlib.sha256(uploaded.read_bytes()).hexdigest() + '  ' + uploaded.name + '\n'); checksum.chmod(0o600)
            ports = {'services': {name: {'ports': [{'host_ip': '127.0.0.1', 'target': target, 'published': published}]} for name, target, published in [('api', 3000, '3101'), ('postgres', 5432, '5432'), ('redis', 6379, '6379')]}}
            ports['services']['postgres']['image'] = 'postgres:16-alpine'; ports['services']['redis']['image'] = 'redis:7-alpine'
            (root / 'compose.json').write_text(json.dumps(ports))
            fake = '''#!/usr/bin/python3
import os, pathlib, sys
r=pathlib.Path(os.environ['TEST_ROOT']); name=pathlib.Path(sys.argv[0]).name; a=sys.argv[1:]
with (r/'calls').open('a') as f:f.write(name+' '+' '.join(a)+'\\n')
if name=='docker':
 if a[0]=='inspect':print('sha256:'+('1'*64))
 elif a[:3]==['compose','config','--format']:print((r/'compose.json').read_text())
 elif a[0]=='tag' and a[-1]=='vps-api':(r/'image').write_text('old' if a[1].startswith('sha256:') else 'new')
 elif a[0]=='build':assert '--pull' in a
elif name=='curl':
 url=a[-1]
 if os.environ['SCENARIO']=='api-failure' and '127.0.0.1:3101' in url and (r/'image').read_text()=='new':sys.exit(22)
 if os.environ['SCENARIO']=='public-failure' and '/tools/widgets' in url:sys.exit(22)
elif name=='apache2ctl':
 if os.environ['SCENARIO']=='apache-failure' and (r/'seo.conf').read_text()!='OLD CONFIG':sys.exit(1)
elif name=='backup':
 p=pathlib.Path(os.environ['BACKUP_DIR']);p.mkdir(parents=True);(p/'verified').write_text('RESTORED')
'''
            for name in ['docker', 'curl', 'apache2ctl', 'systemctl', 'sleep', 'backup']:
                path = root / 'bin' / name; path.write_text(fake); path.chmod(0o700)
            script = (HERE / 'ai-kreator-deploy.sh').read_text()
            for before, after in {
                'BASE=/var/lib/ai-kreator': f'BASE={root}/base',
                'SOURCE=/opt/ai-kreator-source/vps': f'SOURCE={root}/source/vps',
                'WEBROOT=/var/www/ai-kreator.pl': f'WEBROOT={root}/webroot',
                'SEO_CONF=/etc/apache2/ai-kreator-seo-routes.conf': f'SEO_CONF={root}/seo.conf',
                'HELPER=/usr/local/lib/ai-kreator/release_tool.py': f'HELPER={root}/release_tool.py',
                'DB_BACKUP=/usr/local/sbin/ai-kreator-daily-db-backup': f'DB_BACKUP={root}/bin/backup',
                'exec 9>/run/ai-kreator-deploy.lock': f'exec 9>{root}/deploy.lock',
                'for directory in /home/ubuntu/ai-kreator-incoming /home/deploy/incoming;': f'for directory in {root}/inbox;',
            }.items(): script = script.replace(before, after)
            (root / 'deploy.sh').write_text(script)
            environment = {**os.environ, 'PATH': str(root / 'bin') + ':/usr/bin:/bin', 'TEST_ROOT': str(root), 'SCENARIO': scenario}
            result = subprocess.run(['bash', str(root / 'deploy.sh'), COMMIT, '--rebuild-api' if api else '--frontend-only'], env=environment, capture_output=True, text=True, timeout=30)
            self.assertEqual((root / 'source/vps/.env').read_text(), 'KEEP ROOT SECRET')
            self.assertEqual((root / 'source/vps/server/.env').read_text(), 'KEEP SERVER SECRET')
            self.assertEqual((root / 'webroot/assets/old.js').read_text(), 'OLD HASHED ASSET')
            if scenario == 'success':
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual((root / 'webroot/index.html').read_text(), 'HTML')
                self.assertEqual(json.loads((root / 'webroot/deployment-check.json').read_text())['commit'], COMMIT)
                self.assertFalse(uploaded.exists())
            else:
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual((root / 'webroot/index.html').read_text(), 'OLD INDEX', result.stdout + result.stderr)
                self.assertEqual((root / 'seo.conf').read_text(), 'OLD CONFIG')
                self.assertEqual((root / 'source/vps/server/src/server.ts').read_text(), 'OLD SOURCE')
                self.assertEqual((root / 'image').read_text(), 'old')
                self.assertTrue(uploaded.exists())
            if api:
                calls = (root / 'calls').read_text()
                self.assertLess(calls.index('backup '), calls.index('docker build '))
                self.assertIn('--pull', calls)

    def test_success_preserves_hashed_assets_and_publishes_commit(self): self.run_release('success')
    def test_apache_failure_restores_config_and_frontend(self): self.run_release('apache-failure')
    def test_failed_public_probe_restores_frontend(self): self.run_release('public-failure')
    def test_failed_production_api_restores_image_and_source(self): self.run_release('api-failure', api=True)


if __name__ == '__main__': unittest.main()
