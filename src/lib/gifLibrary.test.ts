import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIF_LIBRARY } from './gifLibrary';

describe('downloadable GIF assets', () => {
  it('has unique asset identifiers', () => {
    expect(new Set(GIF_LIBRARY.map(gif => gif.id)).size).toBe(GIF_LIBRARY.length);
  });
  it.each(GIF_LIBRARY)('ships animated GIF, still preview and MP4 for $id', gif => {
      const bytes = readFileSync(`public${gif.src}`);
      expect(bytes.length, gif.id).toBe(gif.bytes);
      expect(bytes.subarray(0, 6).toString(), gif.id).toBe('GIF89a');
      expect(bytes.includes(Buffer.from('NETSCAPE2.0')), gif.id).toBe(true);
      const decoded = parseGIF(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      const frames = decompressFrames(decoded, false);
      expect(frames.length, gif.id).toBe(30);
      expect(frames[0].dims.width, gif.id).toBe(gif.width);
      expect(frames[0].dims.height, gif.id).toBe(gif.height);
      expect(frames.every(frame => frame.delay >= 80), gif.id).toBe(true);
      expect(frames[0].pixels, gif.id).not.toEqual(frames[8].pixels);
      expect(readFileSync(`public${gif.poster}`).subarray(1, 4).toString(), gif.id).toBe('PNG');
      const mp4 = readFileSync(`public${gif.mp4}`);
      expect(mp4.length, gif.id).toBe(gif.mp4Bytes);
      expect(mp4.subarray(4, 8).toString(), gif.id).toBe('ftyp');
      if (gif.category === 'Emoji') expect(frames.every(frame => frame.transparentIndex !== undefined), gif.id).toBe(true);
  });
});
