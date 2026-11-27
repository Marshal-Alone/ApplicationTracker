import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  id,
  value,
  onValueChange,
  options,
  placeholder = 'Select',
  ariaLabel,
  className,
  triggerClassName,
}) => {
  const sentinelValue = '__empty__';
  const normalizedValue = value === '' ? sentinelValue : value;

  return (
    <SelectPrimitive.Root
      value={normalizedValue}
      onValueChange={(next) => onValueChange(next === sentinelValue ? '' : next)}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex items-center justify-between gap-2 h-9 px-3 rounded-[8px] border border-[var(--hairline-strong)] bg-[hsl(var(--surface-card))] hover:bg-[hsl(var(--surface-page))] text-[13px] font-medium text-[hsl(var(--ink-primary))] transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent-ink))] disabled:opacity-50',
          className,
          triggerClassName
        )}
      >
        <span className="truncate text-left">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="w-3.5 h-3.5 text-[hsl(var(--ink-muted))] flex-shrink-0" strokeWidth={1.5} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 min-w-[var(--radix-select-trigger-width)] max-h-64 overflow-y-auto bg-[hsl(var(--surface-card))] border border-[var(--hairline-strong)] rounded-[10px] shadow-[var(--shadow-float)] p-1 text-[hsl(var(--ink-primary))]"
        >
          <SelectPrimitive.Viewport>
            {options.map((opt) => {
              const itemVal = opt.value === '' ? sentinelValue : opt.value;
              return (
                <SelectPrimitive.Item
                  key={itemVal}
                  value={itemVal}
                  className="relative flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[6px] text-[13px] cursor-pointer select-none outline-none data-[highlighted]:bg-[hsl(var(--surface-raised))] data-[state=checked]:font-medium"
                >
                  <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check className="w-3.5 h-3.5 text-[hsl(var(--accent-ink))]" strokeWidth={1.5} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              );
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
};
