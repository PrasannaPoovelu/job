import type { Region } from '../types';

const REGIONS: { value: Region; label: string; description: string }[] = [
  {
    value: 'USA',
    label: 'USA',
    description: '1–2 pages, no photo, impact-driven bullets',
  },
  {
    value: 'UK',
    label: 'UK',
    description: 'Professional summary, slightly more descriptive',
  },
  {
    value: 'Europe',
    label: 'Europe',
    description: 'Short personal profile, structured sections',
  },
  {
    value: 'India',
    label: 'India',
    description: 'Standard professional formatting',
  },
  { value: 'Other', label: 'Other', description: 'Generic professional layout' },
];

interface RegionSelectorProps {
  value: Region;
  onChange: (region: Region) => void;
}

export function RegionSelector({ value, onChange }: RegionSelectorProps) {
  const current = REGIONS.find((r) => r.value === value);
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="region-select"
        className="text-sm font-semibold text-slate-700"
      >
        Target Region
      </label>
      <select
        id="region-select"
        value={value}
        onChange={(e) => onChange(e.target.value as Region)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {REGIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {current && (
        <p className="text-xs text-slate-500">{current.description}</p>
      )}
    </div>
  );
}

export const __REGIONS_FOR_TESTS = REGIONS;
