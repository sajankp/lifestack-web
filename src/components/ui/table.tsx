import * as React from 'react';

import { cn } from '../../lib/utils';

type TableAlign = 'left' | 'right' | 'center';

const alignClasses: Record<TableAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}
const Table: React.FC<TableProps> = ({ className, ...props }) => (
  <table className={cn('w-full text-sm', className)} {...props} />
);
Table.displayName = 'Table';

interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
const TableHeader: React.FC<TableHeaderProps> = ({ className, ...props }) => (
  <thead className={cn('bg-slate-900/40 text-xs text-slate-400 uppercase tracking-wider', className)} {...props} />
);
TableHeader.displayName = 'TableHeader';

interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
const TableBody: React.FC<TableBodyProps> = ({ className, ...props }) => (
  <tbody className={cn('divide-y divide-slate-800/40', className)} {...props} />
);
TableBody.displayName = 'TableBody';

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {}
const TableRow: React.FC<TableRowProps> = ({ className, ...props }) => (
  <tr className={cn('border-t border-slate-700/40', className)} {...props} />
);
TableRow.displayName = 'TableRow';

interface TableHeadProps extends React.HTMLAttributes<HTMLTableCellElement> {
  align?: TableAlign;
}
const TableHead: React.FC<TableHeadProps> = ({ className, align = 'left', ...props }) => (
  <th
    className={cn('px-3 py-2 font-medium', alignClasses[align], className)}
    {...props}
  />
);
TableHead.displayName = 'TableHead';

interface TableCellProps extends React.HTMLAttributes<HTMLTableDataCellElement> {
  align?: TableAlign;
}
const TableCell: React.FC<TableCellProps> = ({ className, align = 'left', ...props }) => (
  <td className={cn('px-3 py-2', alignClasses[align], className)} {...props} />
);
TableCell.displayName = 'TableCell';

interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {}
const TableCaption: React.FC<TableCaptionProps> = ({ className, ...props }) => (
  <caption className={cn('mt-3 text-xs text-slate-500', className)} {...props} />
);
TableCaption.displayName = 'TableCaption';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption };
