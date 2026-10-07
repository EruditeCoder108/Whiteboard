import type { ComponentChildren, JSX } from 'preact'
import type { LucideIcon } from 'lucide-preact'

type IconType = LucideIcon | ((p: Record<string, unknown>) => JSX.Element)

interface BtnProps {
  icon: IconType
  title?: string
  active?: boolean
  danger?: boolean
  disabled?: boolean
  size?: number
  onClick?: (e: MouseEvent) => void
  class?: string
  keep?: boolean
}

/** Compact icon button. */
export function Btn({ icon: Icon, title, active, danger, disabled, size = 17, onClick, class: cls, keep }: BtnProps): JSX.Element {
  return (
    <button
      type="button"
      class={`btn nodrag ${active ? 'active' : ''} ${danger ? 'danger' : ''} ${cls ?? ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      data-popover-keep={keep ? '' : undefined}
      onClick={onClick as never}
    >
      <Icon size={size} strokeWidth={1.8} />
    </button>
  )
}

export function Sep({ vertical }: { vertical?: boolean }): JSX.Element {
  return <div class={vertical ? 'sep-v' : 'sep-h'} />
}

export function Swatch({
  color,
  title,
  selected,
  onClick
}: {
  color: string
  title?: string
  selected?: boolean
  onClick: () => void
}): JSX.Element {
  const light = color.toLowerCase() === '#ffffff'
  return (
    <button
      type="button"
      class={`swatch nodrag ${selected ? 'sel' : ''} ${light ? 'light' : ''}`}
      style={{ '--c': color } as never}
      title={title}
      aria-label={title ?? color}
      aria-pressed={selected}
      onClick={onClick}
    />
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}): JSX.Element {
  const i = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div class="seg nodrag">
      <div
        class="seg-thumb"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${i * 100}%)` }}
      />
      {options.map((o) => (
        <button type="button" key={o.value} class={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <button type="button" class={`switch nodrag ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}

export function Slider({
  min,
  max,
  value,
  onChange,
  step = 1,
  onCommit,
  label
}: {
  min: number
  max: number
  value: number
  onChange: (v: number) => void
  step?: number
  onCommit?: (v: number) => void
  label?: string
}): JSX.Element {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input
      class="slider nodrag"
      type="range"
      min={min}
      max={max}
      step={step}
      aria-label={label}
      value={value}
      style={{ '--p': pct + '%' } as never}
      onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
      onChange={onCommit ? (e) => onCommit(Number((e.target as HTMLInputElement).value)) : undefined}
    />
  )
}

export function Row({ label, children, hint }: { label: string; children: ComponentChildren; hint?: string }): JSX.Element {
  return (
    <div class="row" title={hint}>
      <span class="row-label">{label}</span>
      {children}
    </div>
  )
}

export function MenuItem({
  icon: Icon,
  label,
  hint,
  danger,
  onClick
}: {
  icon: IconType
  label: string
  hint?: string
  danger?: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button type="button" class={`menu-item nodrag ${danger ? 'danger' : ''}`} onClick={onClick}>
      <Icon size={15} strokeWidth={1.8} />
      <span>{label}</span>
      {hint && <em>{hint}</em>}
    </button>
  )
}
