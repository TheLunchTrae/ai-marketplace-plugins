import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file, base = root) => JSON.parse(fs.readFileSync(path.join(base, file), 'utf8'));
function sync(base, check = false) {
  return spawnSync(process.execPath, [path.join(base, 'scripts/sync-plugins.mjs'), ...(check ? ['--check'] : [])], {
    cwd: os.tmpdir(), encoding: 'utf8', timeout: 5000,
  });
}

test('checked-in Claude and Codex metadata is in sync from any working directory', () => {
  const result = sync(root, true);
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test('version drift fails checks without writing and regeneration repairs it', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin sync with spaces-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.cpSync(root, temp, { recursive: true, filter: (source) => path.basename(source) !== '.git' });
  const file = 'plugins/draft-review-ready/.claude-plugin/plugin.json';
  const canonical = read(file, temp);
  canonical.version = '9.8.7';
  fs.writeFileSync(path.join(temp, file), JSON.stringify(canonical));
  let result = sync(temp, true);
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Out of date: plugins\/draft-review-ready\/\.codex-plugin\/plugin.json/);
  assert.notEqual(read('plugins/draft-review-ready/.codex-plugin/plugin.json', temp).version, '9.8.7');
  result = sync(temp);
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(read('plugins/draft-review-ready/.codex-plugin/plugin.json', temp).version, '9.8.7');
  assert.equal(sync(temp, true).status, 0);
});

test('both marketplaces expose every self-contained plugin with matching identities and skills', () => {
  const claude = read('.claude-plugin/marketplace.json');
  const codex = read('.agents/plugins/marketplace.json');
  assert.equal(codex.name, claude.name);
  const directories = fs.readdirSync(path.join(root, 'plugins')).sort();
  assert.deepEqual(claude.plugins.map((p) => p.name).sort(), directories);
  assert.deepEqual(codex.plugins.map((p) => p.name).sort(), directories);
  for (const entry of codex.plugins) {
    assert.equal(entry.source.source, 'local');
    const pluginRoot = path.join(root, entry.source.path);
    const native = read('.codex-plugin/plugin.json', pluginRoot);
    const original = read('.claude-plugin/plugin.json', pluginRoot);
    assert.equal(native.name, original.name);
    assert.equal(native.version, original.version);
    assert.equal(native.interface.displayName, original.displayName);
    assert.ok(native.interface.shortDescription.length <= 30);
    assert.ok(fs.readdirSync(path.join(pluginRoot, native.skills)).some((skill) => fs.existsSync(path.join(pluginRoot, native.skills, skill, 'SKILL.md'))));
    assert.ok(!fs.existsSync(path.join(pluginRoot, 'plugin.json')), 'a portable root manifest would suppress native hook loading');
    if (native.hooks) {
      const hooks = read(native.hooks, pluginRoot).hooks;
      assert.deepEqual(Object.keys(hooks).sort(), ['PostToolUse', 'Stop', 'UserPromptSubmit']);
      for (const groups of Object.values(hooks)) {
        for (const group of groups) {
          for (const handler of group.hooks) {
            assert.match(handler.command, /\$\{PLUGIN_ROOT\}\/scripts\/pr-workflow\.mjs/);
            assert.match(handler.commandWindows, /%PLUGIN_ROOT%\/scripts\/pr-workflow\.mjs/);
            assert.ok(handler.command.endsWith('--host=codex'));
          }
        }
      }
    }
  }
});

const codexProbe = spawnSync('codex', ['--version'], { encoding: 'utf8', timeout: 5000 });
test('Codex discovers and installs every plugin from the shared Git marketplace layout', {
  skip: codexProbe.error?.code === 'ENOENT' ? 'Codex CLI is not installed' : false,
}, (t) => {
  assert.ifError(codexProbe.error);
  const taskHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-plugin-install-'));
  t.after(() => fs.rmSync(taskHome, { recursive: true, force: true }));
  function cli(args) {
    const result = spawnSync('codex', [...args, '--json'], {
      cwd: root, encoding: 'utf8', timeout: 15000,
      env: { ...process.env, CODEX_HOME: taskHome },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
  cli(['plugin', 'marketplace', 'add', root]);
  const marketplace = read('.agents/plugins/marketplace.json');
  const available = cli(['plugin', 'list', '--marketplace', marketplace.name, '--available']).available;
  assert.deepEqual(available.map((p) => p.name).sort(), marketplace.plugins.map((p) => p.name).sort());
  for (const entry of marketplace.plugins) {
    const installed = cli(['plugin', 'add', `${entry.name}@${marketplace.name}`]);
    const native = read('.codex-plugin/plugin.json', installed.installedPath);
    assert.equal(installed.version, native.version);
    for (const skill of fs.readdirSync(path.join(installed.installedPath, native.skills))) {
      assert.ok(fs.existsSync(path.join(installed.installedPath, native.skills, skill, 'SKILL.md')));
    }
    if (native.hooks) assert.ok(fs.existsSync(path.join(installed.installedPath, native.hooks)));
    if (entry.name === 'state-machine-audit') {
      assert.ok(fs.existsSync(path.join(installed.installedPath, 'agents/state-machine-verifier.md')));
    }
  }
  assert.equal(cli(['plugin', 'list', '--marketplace', marketplace.name]).installed.length, marketplace.plugins.length);
});
