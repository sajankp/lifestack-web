import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '../lib/utils';

export type DropdownOption = {
  value: string;
  label: string;
};

type DropdownSelectProps = {
  id?: string;
  testId?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel?: string;
  disabled?: boolean;
  showSearch?: boolean;
  sortByLabel?: boolean;
  'aria-label'?: string;
};

export const DropdownSelect: React.FC<DropdownSelectProps> = ({
  id,
  testId,
  value,
  options,
  onChange,
  placeholder,
  clearLabel,
  disabled = false,
  showSearch = false,
  sortByLabel = false,
  'aria-label': ariaLabel,
}) => {
  const [open, setOpen] = React.useState(false);

  const displayOptions = React.useMemo(() => {
    const opts = [...options];
    if (sortByLabel) {
      opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    }
    return opts;
  }, [options, sortByLabel]);

  const selectedOption = displayOptions.find((opt) => opt.value === value);

  if (!showSearch) {
    const clearValue = '__clear__';
    const canClear = Boolean(clearLabel);

    return (
      <Select
        value={value || undefined}
        onValueChange={(nextValue) => onChange(nextValue === clearValue ? '' : nextValue)}
        disabled={disabled}
      >
        <SelectTrigger id={id} data-testid={testId} aria-label={ariaLabel}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {canClear ? (
            <>
              <SelectItem value={clearValue}>{clearLabel}</SelectItem>
              <SelectSeparator />
            </>
          ) : null}
          {displayOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          data-testid={testId}
          aria-label={ariaLabel}
          disabled={disabled}
          type="button"
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-left text-base sm:text-sm text-slate-100 transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-900/50',
          )}
        >
          <span className={cn('truncate', !selectedOption && 'text-slate-500')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandEmpty>No matches found</CommandEmpty>
            <CommandGroup>
              {clearLabel && (
                <CommandItem
                  value={clearLabel}
                  onSelect={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Check className={cn('h-4 w-4 text-cyan-300', !value ? 'opacity-100' : 'opacity-0')} />
                  <span>{clearLabel}</span>
                </CommandItem>
              )}
              {displayOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label + ' ' + option.value}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Check className={cn('h-4 w-4 text-cyan-300', value === option.value ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
