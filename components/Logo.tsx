// Cadrel logo mark: three event ticks on a rail, the last one out of line (docs/DESIGN.md).
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#FFB020" />
      <path d="M6 20h20" stroke="#14110A" strokeWidth="2" strokeLinecap="round" />
      <rect x="8" y="11" width="3" height="9" rx="1.5" fill="#14110A" />
      <rect x="14.5" y="13" width="3" height="7" rx="1.5" fill="#14110A" />
      <rect x="21" y="8" width="3" height="8" rx="1.5" fill="#14110A" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-none">
        <span className="display text-[17px] font-semibold block">Cadrel</span>
        <span className="eyebrow !text-[9.5px] !tracking-[.16em]">reporting desk</span>
      </span>
    </span>
  );
}
