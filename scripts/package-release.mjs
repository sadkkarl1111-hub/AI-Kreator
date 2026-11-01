import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = path.resolve(tmpdir());
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.error || result.status}`);
  return result.stdout.trim();
}
const commit = run('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'rev-parse', 'HEAD']);
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid commit');
const dirty = run('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'status', '--porcelain', '--untracked-files=no']);
if (dirty) throw new Error('Commit tracked changes before packaging the release.');
await readFile(path.join(root, 'dist/index.html'));
const output = path.resolve(process.argv[2] || await mkdtemp(path.join(tmpdir(), 'ai-kreator-package-')));
await mkdir(output, { recursive: true, mode: 0o700 });
const work = path.resolve(await mkdtemp(path.join(temporaryRoot, 'ai-kreator-source-')));
const archive = path.join(output, `${commit}.tar.gz`);
try {
  // git archive includes committed source only: untracked .env files, keys,
  // node_modules and build caches can never enter through the source folder.
  run('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'archive', '--format=tar', '-o', path.join(work, 'source.tar'), commit, 'vps/server', 'vps/docker-compose.yml']);
  run('tar', ['-xf', path.join(work, 'source.tar'), '-C', work]);
  await mkdir(path.join(work, 'vps/apache'), { recursive: true });
  await cp(path.join(root, 'vps/apache/seo-routes.conf'), path.join(work, 'vps/apache/seo-routes.conf'));
  await writeFile(path.join(work, 'release.json'), JSON.stringify({ format: 1, commit }) + '\n', { mode: 0o600 });
  run('tar', ['-czf', archive, '-C', root, 'dist', '-C', work, 'vps', 'release.json']);
  await chmod(archive, 0o600);
  const hash = createHash('sha256');
  for await (const block of createReadStream(archive)) hash.update(block);
  await writeFile(`${archive}.sha256`, `${hash.digest('hex')}  ${path.basename(archive)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ commit, archive, checksum: `${archive}.sha256` }));
} finally {
  if (path.dirname(work) !== temporaryRoot || !path.basename(work).startsWith('ai-kreator-source-')) throw new Error('Unexpected temporary source path; cleanup refused.');
  await rm(work, { recursive: true, force: true });
}
