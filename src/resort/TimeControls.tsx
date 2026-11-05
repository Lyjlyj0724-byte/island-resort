import { useEffect, useRef, useState } from 'react';
import { Moon, Sun, Sunset, SunMoon, Check } from 'lucide-react';
import type { TimeMode } from './dayCycle';

const choices = [
  { value: 'auto', label: '日夜流转', detail: '让时间慢慢走', Icon: SunMoon },
  { value: 'day', label: '白天', detail: '晴空与树影', Icon: Sun },
  { value: 'sunset', label: '日落', detail: '留住这一刻的晚霞', Icon: Sunset },
  { value: 'night', label: '夜晚', detail: '月光、灯火与萤火虫', Icon: Moon },
] as const;

export default function TimeControls({
  mode,
  onChange,
}: {
  mode: TimeMode;
  onChange: (mode: TimeMode) => void;
}) {
  const [open, setOpen] = useState(false),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const selected = choices.find((choice) => choice.value === mode)!;
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="resort-time" ref={root}>
      <button
        ref={trigger}
        aria-label={`光影：${selected.label}`}
        title={`光影：${selected.label}`}
        aria-expanded={open}
        aria-controls="resort-time-options"
        onClick={() => setOpen((value) => !value)}
      >
        <selected.Icon size={18} />
      </button>
      {open && (
        <div
          id="resort-time-options"
          className="resort-time-options"
          role="group"
          aria-label="选择小岛的光影"
        >
          <p>把时间留在喜欢的光里</p>
          {choices.map(({ value, label, detail, Icon }) => (
            <button
              key={value}
              aria-pressed={mode === value}
              onClick={() => {
                onChange(value);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <Icon size={18} />
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              {mode === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
