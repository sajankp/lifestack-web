import React, { useMemo } from 'react';

import { DatePicker } from './DatePicker';
import { DropdownSelect } from './DropdownSelect';
import { formatDateInputValue } from '../utils/dateFormat';

type DateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  minuteStep?: number;
};

const getTodayDateValue = () => formatDateInputValue(new Date());

const buildTimeOptions = (minuteStep: number) => {
  const options: Array<{ value: string; label: string }> = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += minuteStep) {
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      options.push({ value: `${hh}:${mm}`, label: `${hh}:${mm}` });
    }
  }
  return options;
};

const splitLocalDateTime = (value: string): { date: string; time: string } => {
  if (!value) return { date: '', time: '' };
  const [datePart = '', timePart = ''] = value.split('T');
  return { date: datePart, time: timePart.slice(0, 5) };
};

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  disabled = false,
  required = false,
  minuteStep = 30,
}) => {
  const { date, time } = splitLocalDateTime(value);
  const timeOptions = useMemo(() => buildTimeOptions(Math.max(1, Math.min(30, minuteStep))), [minuteStep]);

  const update = (nextDate: string, nextTime: string) => {
    if (!nextDate && !nextTime) {
      onChange('');
      return;
    }
    const normalizedDate = nextDate || getTodayDateValue();
    const normalizedTime = nextTime || '00:00';
    onChange(`${normalizedDate}T${normalizedTime}`);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <DatePicker
        value={date}
        onChange={(nextDate) => update(nextDate, time)}
        required={required}
        disabled={disabled}
        placeholder="Select date"
      />
      <DropdownSelect
        value={time}
        onChange={(nextTime) => update(date, nextTime)}
        options={timeOptions}
        placeholder="Select time"
        disabled={disabled}
        clearLabel={required ? undefined : 'Clear time'}
      />
    </div>
  );
};
