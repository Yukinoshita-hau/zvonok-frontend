// Run existing suites sequentially on isolated ports, preserving their original evidence.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = 'artifacts/stages/work/electron-native/regressions';
fs.mkdirSync(root, { recursive: true });
const suites = [
  ['stage-a', 'scripts/call-layout-stage-a-check.cjs'],
  ['stage-b', 'scripts/call-layout-stage-b-check.cjs'],
  ['stage-b1', 'scripts/call-layout-stage-b1-check.cjs'],
  ['stage-c', 'scripts/call-layout-stage-c-check.cjs'],
  ['stage-d', 'scripts/call-layout-stage-d-check.cjs'],
  ['settings', 'scripts/settingsV2/promotion-check.cjs'],
  ['chat', 'scripts/chat-layout-check.cjs'],
];
const results = [];
for (const [name, file] of suites) {
  const output = `${root}/${name}`;
  let source = fs.readFileSync(file, 'utf8').replaceAll('127.0.0.1:3017', '127.0.0.1:3038').replaceAll('127.0.0.1:5199', '127.0.0.1:3040');
  source = source.replaceAll('artifacts/stages/call-layout-stage-c-evidence', `${root}/stage-c`).replaceAll('artifacts/stages/call-layout-stage-d-evidence', `${root}/stage-d`).replaceAll('artifacts/stages/work/settings-promotion/chat', `${root}/chat`);
  const runner = path.resolve(`${root}/${name}.cjs`);
  fs.writeFileSync(runner, source);
  const env = { ...process.env, STAGE_A_OUTPUT: output, STAGE_B_OUTPUT: output, STAGE_B1_OUTPUT: output, SETTINGS_PROMOTION_OUTPUT: output, CHAT_LAYOUT_BASE: 'http://127.0.0.1:3040' };
  const log = fs.openSync(`${root}/${name}.log`, 'w');
  const run = spawnSync(process.execPath, [runner], { env, stdio: ['ignore', log, log], timeout: 180000, windowsHide: true });
  fs.closeSync(log);
  results.push({ name, status: run.status === 0 ? 'PASS' : 'FAIL', exitCode: run.status, error: run.error?.message });
  fs.writeFileSync(`${root}/results.json`, JSON.stringify(results, null, 2));
  console.log(name, results.at(-1).status);
}
if (results.some(r => r.status !== 'PASS')) process.exitCode = 1;
