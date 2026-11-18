import fs from 'node:fs';
import path from 'node:path';

// Build the cloud plugin's combined layout from the individual marketplace plugins.
export function syncBundle(root, marketplace, check) {
  const bundleName = 'traes-agent-plugins';
  const bundleRoot = path.join(root, 'plugins', bundleName);
  const expected = new Map();
  const managed = ['skills', 'hooks', 'scripts', 'tests', 'docs'];
  function add(relative, text) {
    if (expected.has(relative)) throw new Error(`Duplicate bundle file: ${relative}`);
    expected.set(relative, text);
  }
  function walk(directory, visit, prefix = '') {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = path.posix.join(prefix, entry.name);
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute, visit, relative);
      else if (entry.isFile()) visit(relative, fs.readFileSync(absolute, 'utf8'));
      else throw new Error(`Unsupported bundle source: ${absolute}`);
    }
  }
  for (const entry of marketplace.plugins.filter((plugin) => plugin.name !== bundleName)) {
    const source = path.join(root, entry.source);
    for (const directory of ['skills', 'hooks', 'scripts', 'tests']) {
      walk(path.join(source, directory), (relative, text) => add(`${directory}/${relative}`, text));
    }
    const guide = fs.readFileSync(path.join(source, 'README.md'), 'utf8')
      .replace('(../state-machine-audit)', '(state-machine-audit.md)')
      .replace('(agents/state-machine-verifier.md)', '(../skills/state-machine-audit/references/state-machine-verifier.md)');
    add(`docs/${entry.name}.md`, guide);
  }
  add('LICENSE', fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
  add('skills/state-machine-audit/references/state-machine-verifier.md',
    fs.readFileSync(path.join(root, 'plugins/state-machine-audit/agents/state-machine-verifier.md'), 'utf8'));

  // Keep cross-skill guidance and verifier references inside the combined package.
  const replacements = {
    'skills/pr-workflow/SKILL.md': [[
      'the State Machine Audit plugin (`state-machine-audit`)',
      'the bundled `state-machine-audit` skill',
    ]],
    'skills/repo-standards/SKILL.md': [[
      "the way the repo's PR rules say (the Draft-Review-Ready PR Workflow plugin, `draft-review-ready`, when installed)",
      "using the repo's PR rules and the bundled `pr-workflow` skill",
    ]],
    'skills/state-machine-audit/SKILL.md': [
      ["before it becomes a draft: in Claude Code, the plugin's agent `state-machine-audit:state-machine-verifier`; in Codex or any host where that agent isn't registered, a fresh general-purpose agent given the body of",
        'before it becomes a draft. Give a fresh general-purpose subagent the body of'],
      ['../../agents/state-machine-verifier.md', 'references/state-machine-verifier.md'],
      ["the repo's PR rules (the Draft-Review-Ready PR Workflow plugin, `draft-review-ready`, if it's installed)",
        "the repo's PR rules and the bundled `pr-workflow` skill"],
    ],
  };
  for (const [file, pairs] of Object.entries(replacements)) {
    let text = expected.get(file);
    for (const [before, after] of pairs) {
      if (!text?.includes(before)) throw new Error(`Update the bundle reference rewrite for ${file}: ${before}`);
      text = text.replace(before, after);
    }
    expected.set(file, text);
  }

  let stale = false;
  for (const [relative, text] of expected) {
    const target = path.join(bundleRoot, relative);
    if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === text) continue;
    stale = true;
    if (check) console.error(`Out of date: plugins/${bundleName}/${relative}`);
    else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text);
      console.log(`Updated plugins/${bundleName}/${relative}`);
    }
  }
  for (const directory of managed) {
    walk(path.join(bundleRoot, directory), (relative) => {
      const file = `${directory}/${relative}`;
      if (expected.has(file)) return;
      stale = true;
      if (check) console.error(`Obsolete bundle file: plugins/${bundleName}/${file}`);
      else {
        fs.rmSync(path.join(bundleRoot, file));
        let directory = path.dirname(path.join(bundleRoot, file));
        while (directory !== bundleRoot && fs.readdirSync(directory).length === 0) {
          fs.rmdirSync(directory);
          directory = path.dirname(directory);
        }
        console.log(`Removed plugins/${bundleName}/${file}`);
      }
    });
  }
  return stale;
}
