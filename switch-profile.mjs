#!/usr/bin/env node
/**
 * switch-profile.mjs — Multi-profile management for career-ops
 *
 * Each profile is a self-contained job search account with its own:
 *   cv.md, config/profile.yml, modes/_profile.md, portals.yml,
 *   data/, reports/, output/, jds/, interview-prep/, batch/tracker-additions/
 *
 * Commands:
 *   node switch-profile.mjs new <name>       Create a new profile
 *   node switch-profile.mjs switch <name>    Set active profile
 *   node switch-profile.mjs list             List all profiles
 *   node switch-profile.mjs status           Show active profile
 *   node switch-profile.mjs info <name>      Show profile details
 */

import {
  readFileSync, writeFileSync, existsSync, mkdirSync,
  readdirSync, copyFileSync, statSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = __dirname;
const PROFILES_DIR = join(PROJECT_ROOT, 'profiles');
const ACTIVE_FILE = join(PROJECT_ROOT, '.active-profile');

// ── Helpers ─────────────────────────────────────────────────────────────────

function getActive() {
  if (existsSync(ACTIVE_FILE)) {
    const name = readFileSync(ACTIVE_FILE, 'utf-8').trim();
    if (name) return name;
  }
  return null;
}

function setActive(name) {
  writeFileSync(ACTIVE_FILE, name + '\n', 'utf-8');
}

function listProfiles() {
  if (!existsSync(PROFILES_DIR)) return [];
  return readdirSync(PROFILES_DIR).filter(f => {
    const stat = statSync(join(PROFILES_DIR, f));
    return stat.isDirectory() && !f.startsWith('.');
  });
}

function profileExists(name) {
  return existsSync(join(PROFILES_DIR, name));
}

function readProfileMeta(name) {
  const profileYml = join(PROFILES_DIR, name, 'config', 'profile.yml');
  const cvMd = join(PROFILES_DIR, name, 'cv.md');

  let displayName = name;
  let targetRoles = [];
  let cvReady = false;

  if (existsSync(profileYml)) {
    const content = readFileSync(profileYml, 'utf-8');
    const nameMatch = content.match(/full_name:\s*["']?([^"'\n]+)["']?/);
    if (nameMatch && !nameMatch[1].includes('Jane Smith')) {
      displayName = nameMatch[1].trim();
    }
    // Extract target roles
    const rolesSection = content.match(/primary:\s*\n((?:\s+-[^\n]+\n?)+)/);
    if (rolesSection) {
      targetRoles = rolesSection[1]
        .split('\n')
        .map(l => l.replace(/^\s*-\s*["']?/, '').replace(/["']?\s*$/, '').trim())
        .filter(Boolean);
    }
  }

  if (existsSync(cvMd)) {
    const cv = readFileSync(cvMd, 'utf-8');
    cvReady = cv.trim().length > 200;
  }

  const appsFile = join(PROFILES_DIR, name, 'data', 'applications.md');
  let appCount = 0;
  if (existsSync(appsFile)) {
    const content = readFileSync(appsFile, 'utf-8');
    appCount = (content.match(/^\|\s*\d+\s*\|/gm) || []).length;
  }

  const reportsDir = join(PROFILES_DIR, name, 'reports');
  let reportCount = 0;
  if (existsSync(reportsDir)) {
    reportCount = readdirSync(reportsDir).filter(f => f.endsWith('.md')).length;
  }

  return { displayName, targetRoles, cvReady, appCount, reportCount };
}

// ── Commands ─────────────────────────────────────────────────────────────────

function cmdNew(name) {
  if (!name) {
    console.error('Usage: node switch-profile.mjs new <profile-name>');
    console.error('Example: node switch-profile.mjs new kelechi');
    process.exit(1);
  }

  if (!/^[a-z0-9_-]+$/i.test(name)) {
    console.error('Profile name must be alphanumeric (a-z, 0-9, hyphens, underscores). No spaces.');
    process.exit(1);
  }

  const profileDir = join(PROFILES_DIR, name);

  if (existsSync(profileDir)) {
    console.error(`Profile "${name}" already exists.`);
    console.error(`To switch to it: node switch-profile.mjs switch ${name}`);
    process.exit(1);
  }

  // Create directory structure
  const dirs = [
    profileDir,
    join(profileDir, 'config'),
    join(profileDir, 'modes'),
    join(profileDir, 'data'),
    join(profileDir, 'reports'),
    join(profileDir, 'output'),
    join(profileDir, 'jds'),
    join(profileDir, 'interview-prep'),
    join(profileDir, 'batch'),
    join(profileDir, 'batch', 'tracker-additions'),
    join(profileDir, 'batch', 'logs'),
  ];

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }

  // Copy template files
  const copies = [
    ['config/profile.example.yml', join(profileDir, 'config', 'profile.yml')],
    ['modes/_profile.template.md', join(profileDir, 'modes', '_profile.md')],
  ];

  for (const [src, dest] of copies) {
    const srcPath = join(PROJECT_ROOT, src);
    if (existsSync(srcPath) && !existsSync(dest)) {
      copyFileSync(srcPath, dest);
    }
  }

  // Copy portals template
  const portalsTemplate = join(PROJECT_ROOT, 'templates', 'portals.example.yml');
  const portalsTarget = join(profileDir, 'portals.yml');
  if (existsSync(portalsTemplate) && !existsSync(portalsTarget)) {
    copyFileSync(portalsTemplate, portalsTarget);
  }

  // Create placeholder cv.md
  writeFileSync(join(profileDir, 'cv.md'), `# CV — ${name}\n\n<!-- Paste your CV here or run career-ops onboarding -->\n`, 'utf-8');

  // Create empty tracker
  writeFileSync(
    join(profileDir, 'data', 'applications.md'),
    `# Applications Tracker — ${name}\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|------|---------|------|-------|--------|-----|--------|-------|\n`,
    'utf-8',
  );

  // Create empty story bank
  writeFileSync(
    join(profileDir, 'interview-prep', 'story-bank.md'),
    `# Story Bank — ${name}\n\nSTAR+R stories accumulated across evaluations.\n`,
    'utf-8',
  );

  // Create .gitkeep files
  for (const dir of ['reports', 'output', 'jds', 'batch/tracker-additions', 'batch/logs']) {
    writeFileSync(join(profileDir, dir, '.gitkeep'), '', 'utf-8');
  }

  // Auto-switch to the new profile
  setActive(name);

  console.log(`\n✅ Profile "${name}" created and set as active.\n`);
  console.log(`Profile directory: profiles/${name}/\n`);
  console.log('Files created:');
  console.log(`  profiles/${name}/cv.md                     ← paste your CV here`);
  console.log(`  profiles/${name}/config/profile.yml        ← fill in your details`);
  console.log(`  profiles/${name}/modes/_profile.md         ← your archetypes & narrative`);
  console.log(`  profiles/${name}/portals.yml               ← job portals to scan`);
  console.log(`  profiles/${name}/data/applications.md      ← application tracker`);
  console.log(`\nNext: open career-ops in Claude Code — it will guide you through onboarding.`);
  console.log(`      Claude will read/write from profiles/${name}/ automatically.\n`);
}

function cmdSwitch(name) {
  if (!name) {
    console.error('Usage: node switch-profile.mjs switch <profile-name>');
    process.exit(1);
  }

  if (!profileExists(name)) {
    console.error(`Profile "${name}" not found.`);
    console.error(`Available profiles:`);
    const profiles = listProfiles();
    if (profiles.length === 0) {
      console.error('  (none — create one with: node switch-profile.mjs new <name>)');
    } else {
      profiles.forEach(p => console.error(`  ${p}`));
    }
    process.exit(1);
  }

  const prev = getActive();
  setActive(name);

  if (prev && prev !== name) {
    console.log(`\n✅ Switched from "${prev}" → "${name}"\n`);
  } else {
    console.log(`\n✅ Active profile set to "${name}"\n`);
  }

  const meta = readProfileMeta(name);
  console.log(`  Name: ${meta.displayName}`);
  if (meta.targetRoles.length > 0) {
    console.log(`  Target roles: ${meta.targetRoles.join(', ')}`);
  }
  console.log(`  CV ready: ${meta.cvReady ? 'Yes' : 'No — needs setup'}`);
  console.log(`  Applications: ${meta.appCount}`);
  console.log(`  Reports: ${meta.reportCount}`);
  console.log();
}

function cmdList() {
  const profiles = listProfiles();
  const active = getActive();

  console.log('\n📁 career-ops profiles\n');

  if (profiles.length === 0) {
    console.log('  No profiles yet. Create one:');
    console.log('  node switch-profile.mjs new <name>\n');
    return;
  }

  for (const name of profiles) {
    const meta = readProfileMeta(name);
    const isActive = name === active;
    const marker = isActive ? '▶ ' : '  ';
    const activeLabel = isActive ? ' (active)' : '';
    console.log(`${marker}${name}${activeLabel}`);
    console.log(`    Name: ${meta.displayName}`);
    if (meta.targetRoles.length > 0) {
      console.log(`    Roles: ${meta.targetRoles.slice(0, 2).join(', ')}${meta.targetRoles.length > 2 ? ' +more' : ''}`);
    }
    console.log(`    CV: ${meta.cvReady ? '✅' : '⚠️  needs setup'} | Applications: ${meta.appCount} | Reports: ${meta.reportCount}`);
    console.log();
  }

  if (!active) {
    console.log('No active profile. To activate one:');
    console.log('node switch-profile.mjs switch <name>\n');
  }
}

function cmdStatus() {
  const active = getActive();
  const profiles = listProfiles();

  console.log('\n📊 career-ops profile status\n');

  if (!active) {
    console.log('Active: (none — using root/single-profile mode)');
    console.log(`\nAvailable profiles: ${profiles.length}`);
  } else {
    console.log(`Active: ${active}`);
    const meta = readProfileMeta(active);
    console.log(`Name: ${meta.displayName}`);
    if (meta.targetRoles.length > 0) {
      console.log(`Target roles: ${meta.targetRoles.join(', ')}`);
    }
    console.log(`CV ready: ${meta.cvReady ? 'Yes' : 'No — needs setup'}`);
    console.log(`Applications: ${meta.appCount}`);
    console.log(`Reports: ${meta.reportCount}`);
    console.log(`\nAll profiles: ${profiles.join(', ') || '(none)'}`);
  }
  console.log();
}

function cmdInfo(name) {
  if (!name) {
    console.error('Usage: node switch-profile.mjs info <profile-name>');
    process.exit(1);
  }
  if (!profileExists(name)) {
    console.error(`Profile "${name}" not found.`);
    process.exit(1);
  }

  const meta = readProfileMeta(name);
  const active = getActive();
  console.log(`\n📋 Profile: ${name}${name === active ? ' (active)' : ''}\n`);
  console.log(`Name: ${meta.displayName}`);
  console.log(`Target roles: ${meta.targetRoles.length > 0 ? meta.targetRoles.join(', ') : '(not configured)'}`);
  console.log(`CV ready: ${meta.cvReady ? 'Yes' : 'No'}`);
  console.log(`Applications tracked: ${meta.appCount}`);
  console.log(`Evaluation reports: ${meta.reportCount}`);
  console.log(`Path: profiles/${name}/\n`);
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

const [,, command, arg] = process.argv;

switch (command) {
  case 'new':    cmdNew(arg); break;
  case 'switch':
  case 'use':    cmdSwitch(arg); break;
  case 'list':
  case 'ls':     cmdList(); break;
  case 'status': cmdStatus(); break;
  case 'info':   cmdInfo(arg); break;
  default:
    console.log(`
career-ops profile manager

Commands:
  node switch-profile.mjs new <name>       Create a new profile (and switch to it)
  node switch-profile.mjs switch <name>    Switch active profile
  node switch-profile.mjs list             List all profiles
  node switch-profile.mjs status           Show active profile details
  node switch-profile.mjs info <name>      Show profile details

Examples:
  node switch-profile.mjs new kelechi
  node switch-profile.mjs new friend-name
  node switch-profile.mjs switch kelechi
  node switch-profile.mjs list

All career-ops scripts (verify, merge, normalize, dedup, sync-check) will
automatically use the active profile's data directory.

To use a specific profile without switching:
  node verify-pipeline.mjs --profile kelechi
  node merge-tracker.mjs --profile friend-name
    `);
}
