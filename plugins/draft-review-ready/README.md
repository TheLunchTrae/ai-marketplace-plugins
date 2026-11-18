# Draft-Review-Ready PR Workflow

I use this plugin for a strict pull request workflow: every PR opens as a draft, gets an independent reviewer agent with a fix and re-check loop, and is marked ready only after the reviewer approves. The reviewer also checks the state machines the diff adds or changes; for a full audit I use [State Machine Audit](../state-machine-audit). A Stop hook keeps the session from ending its turn while that loop is unfinished.

Install in Claude Code:

```
/plugin marketplace add TheLunchTrae/ai-marketplace-plugins
/plugin install draft-review-ready@thelunchtrae
```

The skill runs as `/draft-review-ready:pr-workflow` in Claude Code, or `$draft-review-ready:pr-workflow` in Codex.

Requires Node 18 or later on `PATH` (the hooks are one dependency-free Node script). Works on macOS, Linux and Windows (Git Bash or PowerShell).

## Codex

```sh
codex plugin marketplace add TheLunchTrae/ai-marketplace-plugins
codex plugin add draft-review-ready@thelunchtrae
```

Use a Codex release with native plugin hooks and review their trust state in `/hooks`. Both hosts run the same script; `hooks/codex.json` selects Codex mode and uses its supported `PostToolUse`, `UserPromptSubmit` and `Stop` events. Its Windows commands use `%PLUGIN_ROOT%` for Codex's command shell.

Codex sends shell output as plain text without an exit status. The hook can track PR creation URLs and reads explicit markers. Because hooks fire only at process completion and may receive only the final output chunk, a URL or marker printed before a long-running command yields can be lost. Immediately after opening each PR, run this as a separate short command and wait for it to finish before starting a reviewer or checks watcher, even if automatic tracking already confirmed the PR:

```sh
echo "pr-workflow: draft <pr-url>"
```

Use a separate short command for every later marker too. The hook doesn't infer `ready`, `closed` or `reviewing` from shell state-changing commands: verify the operation succeeded, then run the matching marker by itself. For example, after confirming `gh pr ready <pr-url>` succeeded, run `echo "pr-workflow: ready <pr-url>"`. Do not append a checks watcher or other slow work to creation or marker commands.

The explicit draft marker also covers GitHub integrations whose tool names or payloads the tracker doesn't recognize. Codex's Stop payload doesn't include Claude's background-task or scheduled-wakeup inventory, so those exceptions aren't detected there; `stop_hook_active` still prevents a nudge loop. When hooks are unavailable or disabled, the skill supplies the same review rules without automatic enforcement.

## Renamed from pr-workflow

This plugin used to be called `pr-workflow`. The marketplace maps the old name to `draft-review-ready`, so on Claude Code v2.1.193 or later an existing install moves to the new name by itself after `/plugin marketplace update thelunchtrae` and a new session. If `/plugin` then says the plugin isn't cached, run `/plugin install draft-review-ready@thelunchtrae` once. On an older Claude Code, update the marketplace, uninstall it and install the new one:

```
/plugin marketplace update thelunchtrae
/plugin uninstall pr-workflow@thelunchtrae
/plugin install draft-review-ready@thelunchtrae
```

The skill name, marker lines, `PR_WORKFLOW_*` variables and the `~/.claude/pr-workflow/` state folder keep their names, so nothing else changes.

## What's in it

- `skills/pr-workflow/SKILL.md`: the rules agents follow for issues, commits, PR descriptions, the review loop (including what the reviewer checks), stacked PRs, visual changes and links.
- `hooks/hooks.json` (Claude), `hooks/codex.json` (Codex) and `scripts/pr-workflow.mjs`: the hooks that track review state and block stopping.

## How the hook decides

**Claude tracking (PostToolUse and PostToolUseFailure).** PRs the session opens are recorded as `draft` (see [Codex](#codex) for its differences):

- `gh pr create` (or `gh pr new`, also inside `$(...)`), `gh api repos/{owner}/{repo}/pulls` (POST), or a GitHub MCP `create_pull_request`. A shell command that fails after the PR was created still counts. After a successful command, the hook confirms each PR it starts tracking in the agent's context. Reporting a PR as `draft` that's already tracked is harmless.
- Changes are followed too: `gh pr ready` and the `.../ccr/ready_for_review` route set `ready`; `gh pr ready --undo`, `gh pr reopen` and `.../ccr/convert_to_draft` set `reviewing`; merge and close set `closed`. The MCP `update_pull_request` and `merge_pull_request` tools are handled the same way.
- A ref the hook can't pin to one tracked PR (a branch name, a `$VAR`, a number that matches two PRs) is ignored rather than guessed.

**Agent reports.** The agent reports the steps in between by printing a marker line: `echo "pr-workflow: <state> <pr-url> [reason]"`. The hook reads the line from the command's output, so the agent needs no session id, no file write and no extra permission. The hook confirms each marker in the agent's context, or says why it recorded nothing.

**Waiting.** `waiting` needs a reason and ends at the next user prompt (UserPromptSubmit), so it can't switch the hook off for the rest of a session.

**Stop.** The hook blocks the end of a turn while any PR this session opened is `draft`, `reviewing` or `approved`. It lets the turn end when:

- `stop_hook_active` is true (it already nudged once this turn, so it never loops),
- in Claude Code, a background task that will finish and wake the session is running (subagent, workflow, cloud session, or a `gh pr checks --watch` or `gh run watch` shell); teammates and monitors don't count, because they can run all session,
- in Claude Code, a one-shot wakeup is scheduled (any one-shot, so an unrelated reminder also lets the turn end),
- every tracked PR is `ready`, `waiting` or `closed`,
- `PR_WORKFLOW_DISABLE=1` is set,
- anything goes wrong (it fails open).

## State

One file per PR under `~/.claude/pr-workflow/sessions/<session-id>/` for Claude Code, or `${CODEX_HOME:-~/.codex}/pr-workflow/sessions/<session-id>/` for Codex (override either base folder with `PR_WORKFLOW_STATE_DIR`). Session folders older than 30 days are pruned. To see a session's state:

```sh
node scripts/pr-workflow.mjs status <session-id>
node scripts/pr-workflow.mjs status <session-id> --host=codex
```

## Tests

```sh
node --test tests/*.test.mjs
```
