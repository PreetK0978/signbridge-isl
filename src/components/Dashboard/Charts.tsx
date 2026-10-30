import type { EpochMetrics } from '../../types';

interface Series {
  name: string;
  color: string;
  values: Array<number | null>;
  dashed?: boolean;
}

/** Minimal responsive SVG line chart (no chart library needed). */
export function LineChart({ series, height = 180, yMax = 1, yLabel }: { series: Series[]; height?: number; yMax?: number; yLabel?: string }) {
  const n = Math.max(0, ...series.map((s) => s.values.length));
  const W = 600;
  const H = height;
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - Math.min(v, yMax) / yMax) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={yLabel ?? 'Line chart'}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.06)" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#64748b">
              {yMax === 1 ? `${Math.round(t * 100)}%` : t.toFixed(1)}
            </text>
          </g>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null || !Number.isFinite(v) ? null : `${x(i)},${y(v)}`)).filter(Boolean);
          if (!pts.length) return null;
          return (
            <polyline key={s.name} points={pts.join(' ')} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? '6 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
          );
        })}
        {n > 0 && (
          <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize="10" fill="#64748b">
            epoch {n}
          </text>
        )}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TrainingCharts({ history }: { history: EpochMetrics[] }) {
  const maxLoss = Math.max(1, ...history.flatMap((h) => [h.loss, h.valLoss ?? 0]).filter(Number.isFinite));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">Accuracy</p>
        <LineChart
          yLabel="Accuracy per epoch"
          series={[
            { name: 'Train', color: '#4d8dff', values: history.map((h) => h.acc) },
            { name: 'Validation', color: '#3ee6f5', values: history.map((h) => h.valAcc), dashed: true },
          ]}
        />
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">Loss</p>
        <LineChart
          yLabel="Loss per epoch"
          yMax={Math.ceil(maxLoss * 10) / 10}
          series={[
            { name: 'Train', color: '#4d8dff', values: history.map((h) => h.loss) },
            { name: 'Validation', color: '#3ee6f5', values: history.map((h) => h.valLoss), dashed: true },
          ]}
        />
      </div>
    </div>
  );
}

/** Horizontal bars, e.g. samples per sign with a target marker. */
export function BarList({ items, target }: { items: Array<{ label: string; value: number; sub?: string }>; target?: number }) {
  const max = Math.max(target ?? 0, ...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="truncate text-slate-200">
              {item.label} {item.sub && <span className="text-slate-500">· {item.sub}</span>}
            </span>
            <span className="font-mono text-slate-400">{item.value}</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-navy-700">
            <div className="h-full rounded-full bg-gradient-to-r from-electric-500 to-cyan-400" style={{ width: `${(item.value / max) * 100}%` }} />
            {target && <div className="absolute inset-y-0 w-px bg-amber-300/70" style={{ left: `${(target / max) * 100}%` }} title={`Recommended: ${target}`} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ConfusionMatrix({ names, matrix }: { names: string[]; matrix: number[][] }) {
  const max = Math.max(1, ...matrix.flat());
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="p-1 text-left font-normal text-slate-500">actual ↓ / predicted →</th>
            {names.map((n) => (
              <th key={n} className="max-w-[5rem] truncate p-1 font-medium text-slate-300" title={n}>
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={names[i]}>
              <th className="max-w-[8rem] truncate p-1 text-left font-medium text-slate-300" title={names[i]}>
                {names[i]}
              </th>
              {row.map((v, j) => (
                <td
                  key={j}
                  className="h-8 min-w-[2.5rem] rounded text-center font-mono"
                  style={{ background: i === j ? `rgba(62,230,245,${0.12 + (v / max) * 0.6})` : v ? `rgba(248,113,113,${0.12 + (v / max) * 0.5})` : 'rgba(255,255,255,0.03)', color: v ? '#fff' : '#475569' }}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
