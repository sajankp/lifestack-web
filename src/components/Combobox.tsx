import React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';

export type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxProps = {
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
};

export const Combobox: React.FC<ComboboxProps> = ({
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder = 'Search...',
  emptyText = 'No matches found.',
  clearLabel,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = React.useState(false);
  const activeOption = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-12 w-full justify-between rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 font-normal text-slate-100 hover:bg-slate-900',
            className,
          )}
        >
          <span className={cn('truncate text-left', !activeOption && 'text-slate-400')}>
            {activeOption?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {clearLabel ? (
                <CommandItem
                  value={clearLabel}
                  onSelect={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value ? 'opacity-0' : 'opacity-100')} />
                  {clearLabel}
                </CommandItem>
              ) : null}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`.toLowerCase()}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
