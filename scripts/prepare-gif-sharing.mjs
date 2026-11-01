// MP4 files preserve movement when a chat imports GIF files as static images.
// Requires ffmpeg on PATH. No account, external conversion API or backend needed.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const catalogPath = new URL('../src/data/gif-library.json', import.meta.url);
const catalog = JSON.parse(await readFile(catalogPath));
for (const gif of catalog) {
  const mp4 = gif.src.replace(/\.gif$/, '.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', root + gif.src, '-filter_complex', 'color=c=0xF5F2FC:s=360x280:r=25[bg];[bg][0:v]overlay=shortest=1:format=auto,format=yuv420p[out]', '-map', '[out]', '-t', '2.4', '-r', '25', '-an', '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', root + mp4]);
  gif.mp4 = mp4;
  gif.mp4Bytes = (await stat(root + mp4)).size;
  console.log(`${gif.id}: MP4 ${gif.mp4Bytes} bytes`);
}
await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
