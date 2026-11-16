import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/pr-workflow.mjs', import.meta.url));
const pr = 'https://github.com/example/repo/pull/12';
const session = 'codex-test-session';
let stateDir;
beforeEach(() => { stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-prwf-')); });
afterEach(() => { fs.rmSync(stateDir, { recursive: true, force: true }); });

function run(mode, input, extraEnv = {}) {
  const result = spawnSync(process.execPath, [script, mode, '--host=codex'], {
    input: typeof input === 'string' ? input : JSON.stringify({ session_id: session, cwd: '/work/repo', ...input }),
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, PR_WORKFLOW_STATE_DIR: stateDir, PR_WORKFLOW_DISABLE: '', ...extraEnv },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout ? JSON.parse(result.stdout) : null;
}
function shell(command, output, tool = 'Bash', extraEnv) {
  return run('post-tool-use', {
    hook_event_name: 'PostToolUse',
    tool_name: tool,
    tool_input: tool === 'exec_command' ? { cmd: command } : { command },
    // Codex's native Bash hook response is plain text, with no exit status.
    tool_response: output,
  }, extraEnv);
}
const stop = (extra = {}, extraEnv) => run('stop', { hook_event_name: 'Stop', stop_hook_active: false, ...extra }, extraEnv);
const marker = (state, reason = '') => shell(`echo "pr-workflow: ${state} ${pr} ${reason}"`, `pr-workflow: ${state} ${pr} ${reason}\n`);

test('Codex plain-text creation output is tracked, including a later shell failure', () => {
  const out = shell('gh pr create --draft && false', `${pr}\n`);
  assert.match(out.hookSpecificOutput.additionalContext, /tracking .* as draft/);
  assert.equal(stop().decision, 'block');
  assert.equal(stop({ stop_hook_active: true }), null);
  assert.equal(stop({ session_id: 'unrelated-session' }), null);
});

test('Codex markers complete the review loop through exec_command and Bash', () => {
  shell('gh pr create --draft', `${pr}\n`, 'exec_command');
  marker('reviewing');
  assert.equal(stop().decision, 'block');
  marker('approved');
  assert.equal(stop().decision, 'block');
  shell(`echo "pr-workflow: ready ${pr}"`, `pr-workflow: ready ${pr}\n`, 'exec_command');
  assert.equal(stop(), null);
});

test('Codex never guesses shell state-change success without an exit status', () => {
  shell('gh pr create --draft', `${pr}\n`);
  for (const command of [`gh pr ready ${pr}`, `gh pr close ${pr}`, `gh pr merge ${pr}`, 'gh api repos/example/repo/pulls/12/ccr/ready_for_review -X POST']) {
    for (const output of ['', 'HTTP 403: Forbidden']) {
      shell(command, output);
      assert.equal(stop().decision, 'block', `${command}: ${output}`);
    }
  }
  marker('closed');
  assert.equal(stop(), null);
});

test('Codex waiting requires a reason and expires on the next user prompt', () => {
  shell('gh pr create --draft', `${pr}\n`);
  assert.match(marker('waiting').hookSpecificOutput.additionalContext, /waiting needs a reason/);
  assert.equal(stop().decision, 'block');
  marker('waiting', 'user decision');
  assert.equal(stop(), null);
  run('user-prompt-submit', { hook_event_name: 'UserPromptSubmit', prompt: 'continue' });
  assert.equal(stop().decision, 'block');
});

test('Codex defaults to its own home and still honors the state override', () => {
  const codexHome = path.join(stateDir, 'codex home');
  const extraEnv = { CODEX_HOME: codexHome, PR_WORKFLOW_STATE_DIR: '' };
  shell('gh pr create --draft', `${pr}\n`, 'Bash', extraEnv);
  assert.ok(fs.existsSync(path.join(codexHome, 'pr-workflow', 'sessions', session)));
  assert.equal(stop({}, extraEnv).decision, 'block');
  assert.equal(stop(), null, 'the state override points at a different store');
});

test('MCP errors cannot release a tracked Codex PR', () => {
  shell('gh pr create --draft', `${pr}\n`);
  run('post-tool-use', {
    tool_name: 'mcp__github__update_pull_request',
    tool_input: { owner: 'example', repo: 'repo', pullNumber: 12, draft: false },
    tool_response: { isError: true, content: [{ type: 'text', text: 'Forbidden' }] },
  });
  assert.equal(stop().decision, 'block');
});

test('Codex hooks fail open on malformed input', () => {
  for (const mode of ['post-tool-use', 'user-prompt-submit', 'stop']) {
    assert.equal(run(mode, 'not json'), null);
    assert.equal(run(mode, 'null'), null);
  }
});
