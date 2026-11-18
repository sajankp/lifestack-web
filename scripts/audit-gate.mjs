#!/usr/bin/env node
/**
 * Dependency audit gate: fail on any high/critical advisory EXCEPT the ones
 * listed in ACCEPTED_ADVISORIES below.
 *
 * `npm audit` has no ignore list, so a single advisory with no upstream fix
 * would otherwise block every PR. Each accepted entry must say why it is safe
 * and when to drop it. Anything not listed still fails the build.
 */
import { spawnSync } from 'node:child_process';

const ACCEPTED_ADVISORIES = {
  // picomatch ReDoS via repeated extglobs. Affects <= 4.0.7 and 4.0.7 is the
  // latest release (no patched version exists, checked 2026-11-18). Only
  // reachable through build/test tooling (vite, vitest, tinyglobby, fdir) on
  // developer/CI machines, never in the shipped bundle. `npm audit fix --force`
  // only "fixes" it by downgrading vite/vitest to versions that still use a
  // vulnerable picomatch. Remove this entry once picomatch publishes a fix.
  'GHSA-fc5q-39xc-vjpf': 'picomatch ReDoS, no patched release, dev tooling only',
};

const BLOCKING = new Set(['high', 'critical']);

/** Returns [{ id, name, severity, title }] for advisories that should fail the gate. */
export const findBlocking = (auditReport, accepted = ACCEPTED_ADVISORIES) => {
  const seen = new Map();
  for (const vuln of Object.values(auditReport.vulnerabilities ?? {})) {
    // `via` holds advisory objects for the package that owns the advisory and
    // plain package names for packages that merely depend on one — only the
    // objects are real advisories, so transitive dependents are not re-counted.
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object' || !BLOCKING.has(via.severity)) continue;
      const id =
        String(via.url ?? '')
          .split('/')
          .pop() || String(via.source);
      if (Object.hasOwn(accepted, id) || seen.has(id)) continue;
      seen.set(id, { id, name: via.name, severity: via.severity, title: via.title });
    }
  }
  return [...seen.values()];
};

const main = () => {
  // npm audit exits non-zero whenever it finds anything, so ignore the status
  // and judge the JSON ourselves.
  const result = spawnSync('npm', ['audit', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    console.error('audit-gate: could not parse `npm audit --json` output');
    console.error(result.stdout || result.stderr);
    process.exit(2);
  }
  if (report.error) {
    console.error(`audit-gate: npm audit failed: ${report.error.summary ?? report.error.code}`);
    process.exit(2);
  }

  const blocking = findBlocking(report);
  for (const [id, why] of Object.entries(ACCEPTED_ADVISORIES)) {
    console.log(`audit-gate: accepted ${id} (${why})`);
  }
  if (blocking.length > 0) {
    console.error('audit-gate: unaccepted high/critical advisories:');
    for (const b of blocking) {
      console.error(`  [${b.severity}] ${b.name}: ${b.title} (${b.id})`);
    }
    process.exit(1);
  }
  console.log('audit-gate: no unaccepted high/critical advisories');
};

if (import.meta.url === `file://${process.argv[1]}`) main();
