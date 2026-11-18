import { describe, expect, it } from 'vitest';
import { findBlocking } from './audit-gate.mjs';

const advisory = (id, severity, name = 'pkg') => ({
  name,
  severity,
  title: `${name} problem`,
  url: `https://github.com/advisories/${id}`,
  source: 1,
});

describe('audit-gate findBlocking', () => {
  it('ignores an accepted advisory and the packages that only depend on it', () => {
    const report = {
      vulnerabilities: {
        picomatch: { via: [advisory('GHSA-fc5q-39xc-vjpf', 'high', 'picomatch')] },
        vite: { via: ['picomatch', 'tinyglobby'] },
      },
    };
    expect(findBlocking(report, { 'GHSA-fc5q-39xc-vjpf': 'accepted' })).toEqual([]);
  });

  it('still fails on an unaccepted high advisory, reported once', () => {
    const report = {
      vulnerabilities: {
        a: { via: [advisory('GHSA-aaaa-aaaa-aaaa', 'high', 'a')] },
        b: { via: [advisory('GHSA-aaaa-aaaa-aaaa', 'high', 'a')] },
      },
    };
    const blocking = findBlocking(report, {});
    expect(blocking).toHaveLength(1);
    expect(blocking[0]).toMatchObject({ id: 'GHSA-aaaa-aaaa-aaaa', severity: 'high' });
  });

  it('fails on critical and ignores moderate', () => {
    const report = {
      vulnerabilities: {
        a: { via: [advisory('GHSA-crit', 'critical', 'a')] },
        b: { via: [advisory('GHSA-mod', 'moderate', 'b')] },
      },
    };
    expect(findBlocking(report, {}).map((b) => b.id)).toEqual(['GHSA-crit']);
  });

  it('treats an empty report as clean', () => {
    expect(findBlocking({}, {})).toEqual([]);
  });
});
