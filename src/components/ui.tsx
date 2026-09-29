import { useState, type ReactNode } from 'react';
import { copyText } from '../lib/hooks';
import { href } from '../lib/router';
import { IconBack, IconCheck, IconLink } from './Icons';

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <a className="back-link" href={href('/')} aria-label="Back to all modes">
        <IconBack size={18} />
      </a>
      <div className="page-header-text">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-header-extra">{children}</div>}
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size,
}: {
  options: SegmentOption<T>[];
  value: T | null;
  onChange(v: T): void;
  label: string;
  size?: 'sm';
}) {
  return (
    <div className={`segmented${size === 'sm' ? ' segmented-sm' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'is-active' : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Shows the seed of the current puzzle/question with a copy-link button. */
export function SeedBar({ seed, url }: { seed: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="seed-bar">
      <span className="seed-label">seed</span>
      <code className="seed-value">{seed}</code>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={async () => {
          const ok = await copyText(url);
          setCopied(ok);
          if (!ok) window.prompt('Copy this link:', url);
          window.setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? <IconCheck size={15} /> : <IconLink size={15} />}
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span>{label}</span>
    </label>
  );
}
