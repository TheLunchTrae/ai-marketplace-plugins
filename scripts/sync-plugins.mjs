#!/usr/bin/env node
// Keep Codex's native marketplace and manifests in sync with the existing Claude metadata.
// Native manifests are intentional: Codex currently skips bundled hooks for root Agent Plugins manifests.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncBundle } from './sync-bundle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check')) {
  console.error('Usage: node scripts/sync-plugins.mjs [--check]');
  process.exit(1);
}
const check = args.includes('--check');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const marketplace = read('.claude-plugin/marketplace.json');
const presentation = {
  'draft-review-ready': 'Review PRs before handoff',
  'state-machine-audit': 'Audit state machine failures',
  'repo-standards': 'Apply repository standards',
  'my-skills': "Trae's development skills",
  'traes-agent-plugins': 'PR, audit, and repo workflows',
};
let stale = false;

function write(file, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const target = path.join(root, file);
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === text) return;
  if (check) {
    console.error(`Out of date: ${file}`);
    stale = true;
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
    console.log(`Updated ${file}`);
  }
}

const plugins = marketplace.plugins.map((entry) => {
  // This repository publishes self-contained plugins from local subdirectories.
  if (entry.source !== `./plugins/${entry.name}`) {
    throw new Error(`Expected ./plugins/${entry.name} as the source of ${entry.name}`);
  }
  const source = entry.source.slice(2);
  const { displayName, ...metadata } = read(`${source}/.claude-plugin/plugin.json`);
  if (metadata.name !== entry.name) throw new Error(`Plugin name mismatch: ${entry.name}`);
  const shortDescription = presentation[entry.name];
  if (!shortDescription || shortDescription.length > 30) {
    throw new Error(`Add a Codex subtitle of at most 30 characters for ${entry.name}`);
  }
  const manifest = {
    ...metadata,
    skills: './skills/',
    ...(['draft-review-ready', 'traes-agent-plugins'].includes(entry.name) ? { hooks: './hooks/codex.json' } : {}),
    interface: {
      displayName,
      shortDescription,
      longDescription: metadata.description,
      developerName: metadata.author.name,
      category: 'Developer Tools',
      capabilities: [],
    },
  };
  write(`${source}/.codex-plugin/plugin.json`, manifest);
  return {
    name: entry.name,
    source: { source: 'local', path: entry.source },
    policy: { installation: 'AVAILABLE', authentication: 'ON_USE' },
    category: manifest.interface.category,
  };
});

write('.agents/plugins/marketplace.json', {
  name: marketplace.name,
  interface: { displayName: "Trae's Agent Plugins" },
  plugins,
});

if (syncBundle(root, marketplace, check) && check) stale = true;

if (stale) {
  console.error('Run node scripts/sync-plugins.mjs and commit the generated files.');
  process.exitCode = 1;
} else if (check) {
  console.log('Claude and Codex plugin metadata is in sync.');
}
