#!/usr/bin/env node
// Download official MediaPipe model assets and copy the MediaPipe WASM runtime into public/.
// Usage: node scripts/download-models.mjs [--force] [--skip-gesture]
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST, MODEL_DIR, MODELS, WASM_DEST, WASM_SRC } from './models.config.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const skipGesture = args.has('--skip-gesture');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const type = res.headers.get('content-type') ?? '';
  const buf = Buffer.from(await res.arrayBuffer());
  if (type.includes('text/html') || buf.length < 1024) throw new Error(`Unexpected response for ${url} (${type}, ${buf.length} bytes)`);
  return buf;
}

async function copyWasm() {
  const src = join(root, WASM_SRC);
  if (!existsSync(src)) throw new Error(`${WASM_SRC} not found — run "npm install" first.`);
  const dest = join(root, WASM_DEST);
  await mkdir(dest, { recursive: true });
  const files = await readdir(src);
  for (const f of files) await copyFile(join(src, f), join(dest, f));
  console.log(`✔ Copied ${files.length} MediaPipe WASM files → ${WASM_DEST}`);
}

async function main() {
  await mkdir(join(root, MODEL_DIR), { recursive: true });
  const manifestPath = join(root, MANIFEST);
  const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : { models: {} };

  for (const model of MODELS) {
    if (skipGesture && !model.required) continue;
    const dest = join(root, MODEL_DIR, model.file);
    if (existsSync(dest) && !force) {
      const s = await stat(dest);
      console.log(`• ${model.file} already present (${(s.size / 1e6).toFixed(2)} MB) — use --force to re-download`);
      if (!manifest.models[model.id]) {
        manifest.models[model.id] = { file: model.file, url: model.url, bytes: s.size, sha256: sha256(await readFile(dest)), downloadedAt: null };
      }
      continue;
    }
    process.stdout.write(`↓ ${model.file} from ${model.url} … `);
    try {
      const buf = await download(model.url);
      await writeFile(dest, buf);
      manifest.models[model.id] = { file: model.file, url: model.url, bytes: buf.length, sha256: sha256(buf), downloadedAt: new Date().toISOString() };
      console.log(`${(buf.length / 1e6).toFixed(2)} MB`);
    } catch (err) {
      console.log('failed');
      if (model.required) throw err;
      console.warn(`  (optional) ${err.message}`);
    }
  }

  manifest.note =
    'Downloaded from Google MediaPipe official storage. Not committed to git. Review the MediaPipe model cards for usage/redistribution terms.';
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await copyWasm();
  console.log('\nDone. Run "npm run models:verify" to check the assets.');
}

main().catch((err) => {
  console.error(`\n✖ ${err.message}`);
  console.error('  Check your network connection, or download the files manually (see docs/MODELS.md).');
  process.exit(1);
});
