import React from 'react';

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  testId?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * A boolean on/off switch built on a native checkbox (so it stays keyboard
 * accessible and works with existing checkbox-targeting tests). The visible
 * track/thumb is driven by Tailwind `peer-checked` state.
 */
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  testId,
  disabled = false,
  className,
}) => (
  <label
    className={`flex h-9 items-center gap-2.5 rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 text-sm text-white ${
      disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
    } ${className ?? ''}`}
  >
    <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
      <input
        type="checkbox"
        data-testid={testId}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full bg-slate-600 transition-colors peer-checked:bg-cyan-500 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-500/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-900" />
      <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
    </span>
    {label}
  </label>
);
