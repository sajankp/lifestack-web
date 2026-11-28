import React from 'react';
import { Link } from 'react-router';
import { Download, Upload } from 'lucide-react';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';

export const DataPage: React.FC = () => (
  <PageShell>
    <PageHero title="Data" subtitle="Import or export your LifeStack data." />
    <div className="grid gap-4 sm:grid-cols-2">
      <Link
        to="/settings/data/imports"
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 hover:border-cyan-700"
      >
        <Upload className="mb-3 h-5 w-5 text-cyan-300" />
        <h2 className="font-semibold text-white">Import</h2>
        <p className="mt-1 text-sm text-slate-400">
          Bring transactions, budgets and holdings into LifeStack.
        </p>
      </Link>
      <Link
        to="/settings/data/exports"
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 hover:border-cyan-700"
      >
        <Download className="mb-3 h-5 w-5 text-cyan-300" />
        <h2 className="font-semibold text-white">Export</h2>
        <p className="mt-1 text-sm text-slate-400">Download a copy of your LifeStack data.</p>
      </Link>
    </div>
  </PageShell>
);
