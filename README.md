# Trae's Agent Plugins

My plugins, published from this repository as a marketplace named `thelunchtrae`. The plugins share skills, references and scripts, with separate manifests and hook configuration for each host.

## Install

### Codex app

Add `https://github.com/TheLunchTrae/ai-marketplace-plugins` as a marketplace in the app's Plugins settings. The marketplace appears as **Trae's Agent Plugins** (`thelunchtrae`). Install **Trae's Agent Plugins** for all eight skills, or choose from the four individual plugins below.

The display names match my personal cloud plugins. The lowercase IDs remain stable for commands. Install the bundle or the individual plugins; installing both loads duplicate skills and PR workflow hooks. If the cloud bundle is already selected, use one installation for a session.

### Claude Code

```
/plugin marketplace add TheLunchTrae/ai-marketplace-plugins
/plugin install traes-agent-plugins@thelunchtrae
```

Plugins update when their `version` in `plugin.json` changes. Turn on auto-update for this marketplace in `/plugin`, or run `/plugin marketplace update thelunchtrae`.

`pr-workflow` is now `draft-review-ready`. If you installed it under the old name, see [Renamed from pr-workflow](plugins/draft-review-ready/README.md#renamed-from-pr-workflow).

### Codex

Use a Codex release with native plugin marketplace and hook support (`codex plugin --help`). The repository is now `ai-marketplace-plugins`; the marketplace name remains `thelunchtrae`.

```sh
codex plugin marketplace add TheLunchTrae/ai-marketplace-plugins
codex plugin add traes-agent-plugins@thelunchtrae
```

Start a new session after installing. Ask for a skill in plain words or select it with `$` in Codex's skill picker, for example `$traes-agent-plugins:pr-workflow` or `$traes-agent-plugins:state-machine-audit`. Review and enable the PR workflow's hooks in `/hooks` if Codex asks for trust; the workflow instructions still apply when hooks are disabled.

To update the Git marketplace, run `codex plugin marketplace upgrade thelunchtrae`, then `codex plugin add <plugin>@thelunchtrae` for each plugin you want to refresh and start a new session.

## Plugins

- [Trae's Agent Plugins](plugins/traes-agent-plugins) (`traes-agent-plugins`): the combined cloud plugin's eight skills, references, scripts and PR hooks in one install.
- [Draft-Review-Ready PR Workflow](plugins/draft-review-ready) (`draft-review-ready`): draft-first pull requests with an independent reviewer loop, and a Stop hook that keeps sessions from ending a turn mid-review.
- [State Machine Audit](plugins/state-machine-audit) (`state-machine-audit`): finds implicit state machines and their failure states, writes a state machines doc and agent guidance, and drafts one issue per confirmed failure.
- [Repo Standards](plugins/repo-standards) (`repo-standards`): sets up formatting, linting, tests and CI gates in a repo from the KrishRVH/standards catalog.
- [Trae's Skills](plugins/my-skills) (`my-skills`): my general-purpose skills, so they come with me to any session. See its README for how to add one.

To install an individual plugin, use `codex plugin add <plugin-id>@thelunchtrae` or `/plugin install <plugin-id>@thelunchtrae` in Claude Code.

## Host differences

| Component | Claude Code | Codex |
| --- | --- | --- |
| Marketplace | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` |
| Plugin metadata | `plugins/<name>/.claude-plugin/plugin.json` | `plugins/<name>/.codex-plugin/plugin.json` |
| Skills | Shared `skills/<name>/SKILL.md`; `/plugin:skill` | Same files; select with `$` or ask in plain words |
| PR workflow hooks | `hooks/hooks.json`; automatic tracking of successful PR commands | `hooks/codex.json`; standalone `draft` marker after creation and `ready` or `closed` markers after verifying success |
| Audit verifier | Registered `state-machine-verifier` agent | General-purpose subagent given the same verifier instructions |

The PR workflow's [README](plugins/draft-review-ready/README.md#codex) explains Codex's payload limits and state directory. The other plugins share their behavior across hosts. Node 18+ is needed for the PR hooks, the repo standards helper and the repository checks.

## Maintain and publish

The existing Claude marketplace and plugin manifests remain the source of identity, versions, display names, descriptions, author and license. Codex's marketplace and manifests and the combined plugin's contents are generated and committed, so users can install directly from Git without a build step:

```sh
node scripts/sync-plugins.mjs
node scripts/sync-plugins.mjs --check
node --test
```

1. Edit a plugin's shared skills or scripts. Keep supporting files inside that plugin and resolve script paths from the loaded skill's absolute path, not the user's working directory or a host-specific environment variable.
2. Bump that plugin's version in `.claude-plugin/plugin.json` and the combined `traes-agent-plugins` version when its contents change. For a new plugin, also add it to `.claude-plugin/marketplace.json` and give it a short Codex subtitle in `scripts/sync-plugins.mjs`. The sync script copies each individual plugin into the bundle and checks for missing or stale files.
3. Run the commands above. When Claude Code is available, also run `claude plugin validate .` and `claude plugin validate plugins/<name>` for each changed plugin. CI checks metadata sync and runs the tests.
4. Commit the source and generated metadata together, then push the reviewed changes to the repository's default branch. That publishes the same revision to both Git marketplaces; no repository rename or separate source copy is needed.

For a local Codex smoke test before publishing, register this checkout with `codex plugin marketplace add /absolute/path/to/ai-marketplace-plugins`, then install using the same plugin names. The test suite also exercises Codex discovery and installation in a temporary profile when the CLI is available, without changing your own installations.

These are native Git marketplace packages. Codex uses `.codex-plugin/plugin.json` deliberately: its current loader skips bundled hooks for a root Agent Plugins 1.0 `plugin.json`. A public OpenAI directory submission is a separate packaging and review process; pushing this repository doesn't submit a directory listing.
