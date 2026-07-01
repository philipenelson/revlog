const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// pnpm support: without unstable_enableSymlinks, Metro can resolve a hoisted
// dependency (react, in particular) from two different physical locations
// under node_modules/.pnpm/ even though pnpm considers them the same
// deduped version -- causing "Cannot read property 'useMemo' of null" (two
// React instances, invalid hook call) at runtime. This is the pnpm-specific
// fix; disableHierarchicalLookup + custom nodeModulesPaths (the classic
// Yarn/npm-workspaces monorepo recipe) is NOT compatible with pnpm's nested,
// per-package node_modules and breaks resolution of legitimately deep
// transitive dependencies (e.g. @expo/metro-runtime via expo-router).
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.unstable_enableSymlinks = true;

// unstable_enableSymlinks alone didn't fully dedupe react in practice --
// still saw "Cannot read property 'useMemo' of null" (two React instances).
// Force every require('react') to the one canonical path as a reliable
// belt-and-suspenders fix.
config.resolver.extraNodeModules = {
  react: path.dirname(require.resolve('react/package.json')),
};

module.exports = config;
