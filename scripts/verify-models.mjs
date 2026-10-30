#!/usr/bin/env node
// Verify that model assets and the WASM runtime are present and match the recorded checksums.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST, MODEL_DIR, MODELS, WASM_DEST } from './models.config.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
let failed = false;
const ok = (m) => console.log(`✔ ${m}`);
const warn = (m) => console.log(`⚠ ${m}`);
const fail = (m) => {
  failed = true;
  console.log(`✖ ${m}`);
};

const manifestPath = join(root, MANIFEST);
const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : null;
if (!manifest) warn(`${MANIFEST} missing — checksums cannot be compared (run npm run models:download).`);

for (const model of MODELS) {
  const path = join(root, MODEL_DIR, model.file);
  if (!existsSync(path)) {
    (model.required ? fail : warn)(`${model.file} not found${model.required ? '' : ' (optional — generic gesture demo disabled)'}`);
    continue;
  }
  const buf = await readFile(path);
  // .task bundles are zip archives (the local-file signature may be preceded by a few bytes):
  // look for it near the start so an HTML error page is caught.
  const zipAt = buf.subarray(0, 64).indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (buf.length < 1024 || zipAt < 0) {
    fail(`${model.file} does not look like a MediaPipe .task bundle`);
    continue;
  }
  const hash = createHash('sha256').update(buf).digest('hex');
  const expected = model.sha256 ?? manifest?.models?.[model.id]?.sha256;
  if (expected && expected !== hash) fail(`${model.file} checksum mismatch (expected ${expected.slice(0, 12)}…, got ${hash.slice(0, 12)}…)`);
  else ok(`${model.file} ${(buf.length / 1e6).toFixed(2)} MB sha256 ${hash.slice(0, 16)}…`);
}

for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
  if (existsSync(join(root, WASM_DEST, f))) ok(`${WASM_DEST}/${f}`);
  else fail(`${WASM_DEST}/${f} missing — run npm run models:download`);
}

if (failed) {
  console.log('\nModel verification failed.');
  process.exit(1);
}
console.log('\nAll required model assets are present.');
