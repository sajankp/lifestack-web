import * as React from 'react';

import { useDisplayProfile } from '../../hooks/useDisplayProfile';
import { formatNumber } from '../../utils/numberFormat';
import { Input, type InputProps } from './input';

export interface FormattedNumberInputProps
  extends Omit<InputProps, 'type' | 'inputMode' | 'value' | 'defaultValue'> {
  value?: string | number;
  defaultValue?: string | number;
  /** Use a higher value for quantities and FX rates than for normal money. */
  maximumFractionDigits?: number;
}

const stripGrouping = (value: string): string => value.replace(/[\s,]/g, '');

const formatInputValue = (value: string, locale: string, maximumFractionDigits: number): string => {
  if (value.trim() === '') return '';
  const numericValue = Number(stripGrouping(value));
  return Number.isFinite(numericValue)
    ? formatNumber(numericValue, locale, maximumFractionDigits, 0)
    : value;
};

const numericConstraintMessage = (
  value: string,
  min: string | number | undefined,
  max: string | number | undefined,
  step: string | number | undefined,
): string => {
  if (value.trim() === '') return '';
  const numericValue = Number(stripGrouping(value));
  if (!Number.isFinite(numericValue)) return 'Enter a valid number.';
  if (min !== undefined && numericValue < Number(min)) return `Value must be at least ${min}.`;
  if (max !== undefined && numericValue > Number(max)) return `Value must be at most ${max}.`;
  if (step !== undefined && step !== 'any') {
    const numericStep = Number(step);
    const numericBase = min === undefined ? 0 : Number(min);
    if (Number.isFinite(numericStep) && numericStep > 0 && Number.isFinite(numericBase)) {
      const stepsFromBase = (numericValue - numericBase) / numericStep;
      const tolerance = 1e-9 * Math.max(1, Math.abs(stepsFromBase));
      if (Math.abs(stepsFromBase - Math.round(stepsFromBase)) > tolerance) {
        return `Value must use increments of ${step}.`;
      }
    }
  }
  return '';
};

/**
 * A machine-safe numeric field with locale-aware presentation. While focused,
 * it exposes a plain decimal string so editing and existing form parsers keep
 * working. On blur it applies the effective US/Indian digit grouping.
 */
export const FormattedNumberInput = React.forwardRef<
  HTMLInputElement,
  FormattedNumberInputProps
>(
  (
    {
      value,
      defaultValue,
      maximumFractionDigits,
      min,
      max,
      step,
      role,
      onChange,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const { locale, decimalPlaces } = useDisplayProfile();
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
    const [isFocused, setIsFocused] = React.useState(false);
    const [uncontrolledValue, setUncontrolledValue] = React.useState(() =>
      defaultValue == null ? '' : stripGrouping(String(defaultValue)),
    );
    const isControlled = value !== undefined;
    const rawValue = isControlled ? stripGrouping(String(value)) : uncontrolledValue;
    const displayedValue = isFocused
      ? rawValue
      : formatInputValue(rawValue, locale, maximumFractionDigits ?? decimalPlaces);

    React.useEffect(() => {
      inputRef.current?.setCustomValidity(numericConstraintMessage(rawValue, min, max, step));
    }, [max, min, rawValue, step]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const normalizedValue = stripGrouping(event.target.value);
      event.currentTarget.setCustomValidity(
        numericConstraintMessage(normalizedValue, min, max, step),
      );
      if (!isControlled) setUncontrolledValue(normalizedValue);
      // Existing controlled fields and react-hook-form registrations read
      // event.target.value. Give them the canonical value, never grouped text.
      event.target.value = normalizedValue;
      onChange?.(event);
    };

    return (
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        role={role ?? 'spinbutton'}
        min={min}
        max={max}
        step={step}
        value={displayedValue}
        onChange={handleChange}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
      />
    );
  },
);

FormattedNumberInput.displayName = 'FormattedNumberInput';
