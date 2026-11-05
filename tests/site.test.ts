import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { regions, regionSpots, spots, spotOrder } from '../src/resort/data';
import { site } from '../src/site';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicDir = join(root, 'public');

/** 读取 WebP 的真实像素尺寸，避免 data.ts 里写的宽高与文件对不上。 */
function webpSize(file: string): { width: number; height: number } {
  const buffer = readFileSync(file);
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF', `${file} 不是 RIFF 文件`);
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP', `${file} 不是 WebP 文件`);
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    assert.equal(buffer.toString('latin1', 23, 26), '\x9d\x01\x2a', `${file} VP8 起始码异常`);
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === 'VP8X') {
    return {
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1,
    };
  }
  throw new Error(`${file} 使用了不支持的 WebP 容器：${chunk}`);
}

function walk(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) result.push(...walk(path));
    else result.push(path);
  }
  return result;
}

test('站点文案完整，可以安全地被改成任何人的版本', () => {
  assert.ok(site.brand.name.length > 0);
  assert.ok(site.welcome.title.length >= 1);
  assert.ok(site.welcome.body.length >= 1);
  assert.ok(site.welcome.action.length > 0);
  assert.ok(site.music.src.startsWith('/'));
  assert.equal(site.celebration.titles.length, 4, '庆祝流程需要 4 个步骤标题');
  assert.equal(site.celebration.buttons.length, 3, '庆祝流程需要 3 个推进按钮');
  assert.ok(site.celebration.letter.paragraphs.length > 0);
  assert.ok(site.celebration.letter.signature.length > 0);
  assert.ok(site.footer.left.length > 0 && site.footer.right.length > 0);
});

test('四个地点与 20 个 spot 的内容字段齐全', () => {
  for (const region of Object.keys(regions) as (keyof typeof regions)[]) {
    assert.ok(regions[region].name.length > 0);
    assert.ok(regions[region].location.length > 0);
    assert.ok(regionSpots[region].length > 0);
  }
  assert.equal(Object.keys(spots).length, 20);
  assert.equal(spotOrder.length, 20);
  for (const [id, spot] of Object.entries(spots)) {
    assert.ok(spot.title.length > 0, `${id} 缺少标题`);
    assert.ok(spot.en.length > 0, `${id} 缺少英文小标题`);
    assert.ok(spot.description.length > 0, `${id} 缺少介绍`);
    assert.ok(spot.nav.length > 0, `${id} 缺少底部导航标签`);
    assert.equal(spot.point.length, 3, `${id} 的坐标必须是 [x, y, z]`);
  }
});

test('每个 spot 引用的示例图片都存在，且尺寸与清单一致', () => {
  const referenced = new Set<string>();
  for (const [id, spot] of Object.entries(spots)) {
    for (const photo of spot.photos) {
      assert.ok(photo.src.startsWith('/'), `${id} 的图片 ${photo.src} 必须以 / 开头`);
      assert.ok(photo.caption.length > 0, `${id} 的图片缺少说明文字`);
      assert.ok(photo.width > 0 && photo.height > 0, `${id} 的图片宽高无效`);
      const file = join(publicDir, photo.src.replace(/^\//, ''));
      const size = webpSize(file);
      assert.equal(size.width, photo.width, `${photo.src} 的实际宽度与 data.ts 不一致`);
      assert.equal(size.height, photo.height, `${photo.src} 的实际高度与 data.ts 不一致`);
      referenced.add(photo.src);
    }
  }
  const onDisk = readdirSync(join(publicDir, 'examples'))
    .filter((name) => name.endsWith('.webp'))
    .map((name) => `/examples/${name}`);
  assert.deepEqual(
    [...onDisk].sort(),
    [...referenced].sort(),
    'public/examples/ 里的图片应该正好是 data.ts 引用的那些，没有多余或缺失',
  );
});

test('示例音乐是 32 秒、22050Hz、单声道、16-bit 的 WAV', () => {
  const buffer = readFileSync(join(publicDir, 'music/island-theme.wav'));
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.toString('ascii', 8, 12), 'WAVE');
  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bits = buffer.readUInt16LE(34);
  const dataSize = buffer.readUInt32LE(40);
  assert.equal(channels, 1);
  assert.equal(sampleRate, 22050);
  assert.equal(bits, 16);
  const seconds = dataSize / (sampleRate * channels * (bits / 8));
  assert.ok(Math.abs(seconds - 32) < 0.1, `示例音乐应为 32 秒，实际 ${seconds.toFixed(2)} 秒`);
});

test('示例图标存在，源码里没有留下本机路径', () => {
  assert.ok(readFileSync(join(publicDir, 'favicon.svg'), 'utf8').includes('<svg'));

  // 公开仓库的源码里不应该出现本机绝对路径或本地文件地址。
  const localPathPatterns = [/[A-Za-z]:\\/, /\/Users\/[^/]+\//, /\/home\/[^/]+\//, /file:\/\//];
  const textFiles = [...walk(join(root, 'src')), join(root, 'index.html'), join(root, 'package.json')].filter(
    (file) => /\.(tsx?|css|html|json)$/.test(file),
  );

  for (const file of textFiles) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of localPathPatterns) {
      assert.ok(!pattern.test(text), `${file} 里不应该出现本机路径 ${pattern}`);
    }
  }
});
