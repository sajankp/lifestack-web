import React from 'react';

import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from './ui/select';

export type DropdownOption = {
  value: string;
  label: string;
};

type DropdownSelectProps = {
  id?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel?: string;
  disabled?: boolean;
};

export const DropdownSelect: React.FC<DropdownSelectProps> = ({
  id,
  value,
  options,
  onChange,
  placeholder,
  clearLabel,
  disabled = false,
}) => {
  const clearValue = '__clear__';
  const canClear = Boolean(clearLabel);

  return (
    <Select
      value={value || undefined}
      onValueChange={(nextValue) => onChange(nextValue === clearValue ? '' : nextValue)}
      disabled={disabled}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {canClear ? (
          <>
            <SelectItem value={clearValue}>{clearLabel}</SelectItem>
            <SelectSeparator />
          </>
        ) : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
