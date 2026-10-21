// Run existing presentation suites sequentially with fresh evidence paths; preserve historical results.
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'artifacts/stages/work/browser-activity-20261021', `regression-${Date.now()}`);
fs.mkdirSync(out, { recursive: true });
const suites = [
  ['stage-a', 'scripts/call-layout-stage-a-check.cjs', 'artifacts/stages/call-layout-stage-a-evidence'],
  ['stage-b', 'scripts/call-layout-stage-b-check.cjs', 'artifacts/stages/call-layout-stage-b-evidence'],
  ['stage-b1', 'scripts/call-layout-stage-b1-check.cjs', 'artifacts/stages/call-layout-stage-b1-evidence'],
  ['stage-c', 'scripts/call-layout-stage-c-check.cjs', 'artifacts/stages/call-layout-stage-c-evidence'],
  ['stage-d', 'scripts/call-layout-stage-d-check.cjs', 'artifacts/stages/call-layout-stage-d-evidence'],
  ['chat', 'scripts/chat-layout-check.cjs', 'artifacts/stages/work/settings-promotion/chat'],
  ['settings-navigation', 'scripts/settingsV2/s1c-check.cjs', 'artifacts/stages/work/settings-promotion/shell'],
];
const results = [];
for (const [name, file, oldOut] of suites) {
  if (process.argv.includes('--settings') ? !['chat','settings-navigation'].includes(name) : name === 'settings-navigation') continue;
  if (process.argv.includes('--retry') && !['stage-b1', 'stage-c', 'chat'].includes(name)) continue;
  const target = path.join(out, name).replaceAll('\\', '/');
  let source = fs.readFileSync(path.join(root, file), 'utf8').replaceAll(oldOut, target)
    .replaceAll('http://127.0.0.1:3017', 'http://127.0.0.1:3019')
    .replaceAll('http://127.0.0.1:5199', 'http://127.0.0.1:3019');
  // Font/module loading is irrelevant to these geometry assertions; wait for DOM readiness.
  source = source.replace(/await page\.goto\(([^;]+)\);/g, 'await page.goto($1, {waitUntil:"domcontentloaded"});');
  if (process.argv.includes('--settings')) source = source.replaceAll('http://127.0.0.1:3019', 'http://127.0.0.1:3020');
  const generated = path.join(out, `${name}.cjs`); fs.writeFileSync(generated, source);
  const result = spawnSync(process.execPath, [generated], { cwd: root, encoding: 'utf8', timeout: 180000,
    env: { ...process.env, STAGE_A_OUTPUT: target, STAGE_B_OUTPUT: target, STAGE_B1_OUTPUT: target, CHAT_LAYOUT_BASE: process.argv.includes('--settings') ? 'http://127.0.0.1:3020' : 'http://127.0.0.1:3019' } });
  fs.writeFileSync(path.join(out, `${name}.log`), (result.stdout || '') + (result.stderr || ''));
  results.push({ name, status: result.status === 0 ? 'PASS' : 'FAIL', exit: result.status, error: result.error?.message });
  console.table(results.slice(-1));
}
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
console.log(out); if (results.some(r => r.status !== 'PASS')) process.exitCode = 1;
