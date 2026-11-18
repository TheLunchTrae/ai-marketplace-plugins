# Trae's Agent Plugins

All eight of my development skills in one install, with the same display name and skills as my personal cloud plugin.

Add `https://github.com/TheLunchTrae/ai-marketplace-plugins` as a marketplace in the Codex app, then install **Trae's Agent Plugins** from **Trae's Agent Plugins** (`thelunchtrae`). For the CLI:

```sh
codex plugin marketplace add TheLunchTrae/ai-marketplace-plugins
codex plugin add traes-agent-plugins@thelunchtrae
```

In Claude Code:

```text
/plugin marketplace add TheLunchTrae/ai-marketplace-plugins
/plugin install traes-agent-plugins@thelunchtrae
```

Use this bundle or the four individual plugins. Installing both loads duplicate skills and PR workflow hooks. The personal cloud plugin also supplies these skills; select one installation when starting a session.

Start a new session after installing. Ask for a workflow by name or select a skill such as `$traes-agent-plugins:pr-workflow` in Codex.

| Skill | Source guide |
| --- | --- |
| PR workflow | [Draft-Review-Ready PR Workflow](docs/draft-review-ready.md) |
| State machine audit | [State Machine Audit](docs/state-machine-audit.md) |
| Repo standards | [Repo Standards](docs/repo-standards.md) |
| CI cleanup | [Trae's Skills](docs/my-skills.md) |
| Dependency alerts | [Trae's Skills](docs/my-skills.md) |
| Native UI conventions | [Trae's Skills](docs/my-skills.md) |
| PR merge hygiene | [Trae's Skills](docs/my-skills.md) |
| Visual deliverables | [Trae's Skills](docs/my-skills.md) |

The source guides describe the individual plugins. Their skills, references, scripts, tests and hooks are generated here by `node scripts/sync-plugins.mjs` from the repository root. Edit the individual plugins, regenerate, and bump this bundle's version whenever its installed contents change. This README and `.claude-plugin/plugin.json` are maintained directly.

Automatic PR Stop-hook enforcement requires a supported local installation, trusted hooks and Node 18+. The Repo Standards helper requires a shell, repository checkout, Git, Node 18+ and access to the standards catalog; verification also uses `mise` and the applicable toolchains.
