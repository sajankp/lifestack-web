import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type DropdownOption = {
  value: string;
  label: string;
};

type DropdownSelectProps = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
};

export const DropdownSelect: React.FC<DropdownSelectProps> = ({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
}) => {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onEscape);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const option = rootRef.current?.querySelector<HTMLButtonElement>(`[data-option-index="${activeIndex}"]`);
    option?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  const selectOption = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const onButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        const nextIndex = selectedIndex >= 0 ? Math.min(selectedIndex + 1, options.length - 1) : 0;
        setActiveIndex(nextIndex);
        setIsOpen(true);
      } else {
        setActiveIndex((prev) => Math.min(prev + 1, options.length - 1));
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        const nextIndex = selectedIndex >= 0 ? Math.max(selectedIndex - 1, 0) : Math.max(options.length - 1, 0);
        setActiveIndex(nextIndex);
        setIsOpen(true);
      } else {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      }
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      setActiveIndex(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      setActiveIndex(options.length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) {
        selectOption(activeIndex);
      } else {
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
        setIsOpen(true);
      }
      return;
    }

    if (event.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex]?.label : placeholder;

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={isOpen ? `${id}-option-${activeIndex}` : undefined}
        className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-left text-slate-100 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => {
          if (!isOpen) {
            setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
          }
          setIsOpen((prev) => !prev);
        }}
        onKeyDown={onButtonKeyDown}
      >
        <span className={selectedIndex >= 0 ? 'text-slate-100' : 'text-slate-500'}>{selectedLabel}</span>
        <ChevronDown
          className={`pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && !disabled ? (
        <div
          id={`${id}-listbox`}
          role="listbox"
          tabIndex={-1}
          className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl shadow-slate-950/60"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <button
                key={option.value}
                id={`${id}-option-${index}`}
                data-option-index={index}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  isActive ? 'bg-blue-500/20 text-blue-100' : 'text-slate-200 hover:bg-slate-800'
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(index)}
              >
                <span>{option.label}</span>
                {isSelected ? <Check className="h-4 w-4 text-blue-300" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
