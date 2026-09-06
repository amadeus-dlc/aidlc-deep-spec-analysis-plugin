# Workspace package names

English | [日本語](package-namespace.ja.md)

This project's npm-style scope name is `@deep-spec-analysis`. The root
`deep-spec-analysis-plugin-dev` is the development-harness name and is
distinct from the layer packages.

| Target | Name |
| --- | --- |
| Layer packages | `@deep-spec-analysis/<context>-<layer>` |
| Composition root | `@deep-spec-analysis/entries` |
| Tests | `@deep-spec-analysis/tests` |

All 18 workspace packages are private. Imports within the same package are
relative; imports to another package go through its public facade. A
dependency is declared as `workspace:*` in the consuming package's
`package.json` `dependencies`.

The 12 exceptions that referenced the same package by its scoped name were
also unified onto relative imports. The `no-same-package-scoped-imports` and
`no-cross-package-relative-imports` rules both check this split. An internal
file is never exposed externally just to line up the notation.

## Updating an existing checkout

On a checkout updated from the old scope, a plain `bun install` or
`--force` under Bun 1.3.13 was observed to leave each workspace's stale
links in place. Since no compatibility links are provided for the old
name, recreate the dependency links generated under `deep-spec-analysis/`.

```sh
bun - <<'TS'
import { existsSync, lstatSync, readdirSync, rmdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

const scopes = ["src/*/*/package.json", "src/entries/package.json", "tests/package.json"]
  .flatMap((pattern) => [...new Bun.Glob(pattern).scanSync(".")])
  .map((manifest) => join(dirname(manifest), "node_modules", "@deep-spec"))
  .filter((scope) => existsSync(scope));
const links = scopes.flatMap((scope) => {
  if (!lstatSync(scope).isDirectory()) throw new Error(`Unexpected scope path: ${scope}`);
  return readdirSync(scope, { withFileTypes: true }).map((entry) => {
    if (!entry.isSymbolicLink()) throw new Error(`Unexpected non-link: ${scope}/${entry.name}`);
    return join(scope, entry.name);
  });
});
for (const link of links) unlinkSync(link);
for (const scope of scopes) rmdirSync(scope);
TS
bun install --frozen-lockfile
bun run check
bun run typecheck
bun test tests/package-boundaries.test.ts
```

The script above first confirms that every element under the old scope is a
symbolic link, then removes only those links and the directories left
empty. It never touches the new scope, the dependency store, or source. On
a fresh checkout, a plain `bun install --frozen-lockfile` is all that's
needed.

The package-boundary tests confirm resolution under the new name,
rejection of the old name, rejection of undeclared dependencies, and
rejection of unexposed deep paths — both at runtime and at type-checking
time. Past audits, design decisions, and learnings that still mention the
old name are historical records from that time, not current imports or a
compatibility API.
