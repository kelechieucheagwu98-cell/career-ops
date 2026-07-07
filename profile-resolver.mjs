#!/usr/bin/env node
/**
 * profile-resolver.mjs — Resolves the active profile root for all career-ops scripts.
 *
 * Priority order:
 *   1. --profile <name> CLI flag
 *   2. CAREER_OPS_PROFILE environment variable
 *   3. .active-profile file in project root
 *   4. Project root itself (backward-compatible single-profile mode)
 *
 * Profile directories live at: <project-root>/profiles/<name>/
 * Each profile is self-contained with its own cv.md, config/, data/, reports/, etc.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = __dirname;

/**
 * Returns the root path for the active profile.
 * All scripts should use this instead of __dirname for data file paths.
 */
export function resolveProfileRoot(argv = process.argv) {
  // 1. --profile <name> flag
  const flagIdx = argv.indexOf('--profile');
  if (flagIdx >= 0 && argv[flagIdx + 1] && !argv[flagIdx + 1].startsWith('--')) {
    const name = argv[flagIdx + 1];
    const profilePath = join(PROJECT_ROOT, 'profiles', name);
    if (!existsSync(profilePath)) {
      console.error(`Error: profile "${name}" not found at profiles/${name}/`);
      console.error(`Run: node switch-profile.mjs new ${name}`);
      process.exit(1);
    }
    return profilePath;
  }

  // 2. Environment variable
  if (process.env.CAREER_OPS_PROFILE) {
    const name = process.env.CAREER_OPS_PROFILE.trim();
    const profilePath = join(PROJECT_ROOT, 'profiles', name);
    if (!existsSync(profilePath)) {
      console.error(`Error: CAREER_OPS_PROFILE="${name}" not found at profiles/${name}/`);
      process.exit(1);
    }
    return profilePath;
  }

  // 3. .active-profile file
  const activeFile = join(PROJECT_ROOT, '.active-profile');
  if (existsSync(activeFile)) {
    const name = readFileSync(activeFile, 'utf-8').trim();
    if (name) {
      const profilePath = join(PROJECT_ROOT, 'profiles', name);
      if (!existsSync(profilePath)) {
        console.error(`Error: active profile "${name}" not found at profiles/${name}/`);
        console.error(`Run: node switch-profile.mjs list`);
        process.exit(1);
      }
      return profilePath;
    }
  }

  // 4. Fallback: project root (single-profile / legacy mode)
  return PROJECT_ROOT;
}

/**
 * Returns the name of the active profile, or null if using root (single-profile mode).
 */
export function getActiveProfileName() {
  const argv = process.argv;

  const flagIdx = argv.indexOf('--profile');
  if (flagIdx >= 0 && argv[flagIdx + 1] && !argv[flagIdx + 1].startsWith('--')) {
    return argv[flagIdx + 1];
  }

  if (process.env.CAREER_OPS_PROFILE) {
    return process.env.CAREER_OPS_PROFILE.trim();
  }

  const activeFile = join(PROJECT_ROOT, '.active-profile');
  if (existsSync(activeFile)) {
    const name = readFileSync(activeFile, 'utf-8').trim();
    if (name) return name;
  }

  return null; // root mode
}
