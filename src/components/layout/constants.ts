import {
  LayoutDashboard,
  CheckSquare,
  Mic,
  CreditCard,
  TrendingUp,
  PieChart,
  FileText,
  Upload,
  Download,
  Settings,
} from 'lucide-react';

export const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  admin: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  member: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  viewer: 'bg-slate-700 text-slate-400 border-slate-600',
};

export type NavSection = 'Overview' | 'Life' | 'Money' | 'Tools';

export const NAV_LINKS = [
  { to: '/', label: 'Dashboard', testId: 'nav-dashboard', icon: LayoutDashboard, section: 'Overview' as NavSection },
  { to: '/todo', label: 'Todos', testId: 'nav-todo', icon: CheckSquare, section: 'Life' as NavSection },
  { to: '/capture', label: 'Capture', testId: 'nav-capture', icon: Mic, section: 'Life' as NavSection },
  { to: '/spending', label: 'Spending', testId: 'nav-spending', icon: CreditCard, section: 'Money' as NavSection },
  { to: '/investing', label: 'Investing', testId: 'nav-investing', icon: TrendingUp, section: 'Money' as NavSection },
  { to: '/net-worth', label: 'Net Worth', testId: 'nav-net-worth', icon: PieChart, section: 'Money' as NavSection },
  { to: '/summaries', label: 'Weekly Summaries', testId: 'nav-summaries', icon: FileText, section: 'Tools' as NavSection },
  { to: '/imports', label: 'Bulk Imports', testId: 'nav-imports', icon: Upload, section: 'Tools' as NavSection },
  { to: '/exports', label: 'Data Exports', testId: 'nav-exports', icon: Download, section: 'Tools' as NavSection },
];

export const NAV_SECTIONS: NavSection[] = ['Overview', 'Life', 'Money', 'Tools'];

export const SETTINGS_LINK = { to: '/settings', label: 'Settings', testId: 'nav-settings', icon: Settings };
