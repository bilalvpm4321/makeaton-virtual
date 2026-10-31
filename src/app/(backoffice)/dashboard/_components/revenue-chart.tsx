"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";

// Chart series colours (DESIGN.md chart tokens). Hex, because the shared stylesheet does not define chart variables.
const INVOICED_COLOR = "#5b4cf0";
const COLLECTED_COLOR = "#12a150";

export type RevenuePoint = {
  month: string;
  title: string;
  invoiced: number;
  collected: number;
};

/** Axis label in rupees: 1.2L, 45K, 800. Input is minor units. */
function compactINR(minor: number): string {
  const rupees = minor / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(0)}K`;
  return `₹${Math.round(rupees)}`;
}

type TooltipEntry = {
  dataKey?: unknown;
  value?: unknown;
  payload?: RevenuePoint;
};

function ChartTooltip({ active, payload }: { active?: boolean; payload?: readonly TooltipEntry[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const invoiced = point.invoiced;
  const collected = point.collected;
  const rate = invoiced > 0 ? Math.round((collected / invoiced) * 100) : null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1.5 font-medium text-neutral-900">{point.title}</div>
      <div className="flex items-center justify-between gap-6">
        <span className="flex items-center gap-1.5 text-neutral-500">
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: INVOICED_COLOR }} />
          Invoiced
        </span>
        <span className="font-medium tabular-nums">{formatMoney(invoiced)}</span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="flex items-center gap-1.5 text-neutral-500">
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: COLLECTED_COLOR }} />
          Collected
        </span>
        <span className="font-medium tabular-nums">{formatMoney(collected)}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-6 border-t border-neutral-200 pt-1.5">
        <span className="text-neutral-500">Collection rate</span>
        <span
          className={`font-medium tabular-nums ${rate !== null && rate >= 90 ? "text-green-700" : "text-amber-700"}`}
        >
          {rate === null ? "—" : `${rate}%`}
        </span>
      </div>
    </div>
  );
}

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4} barCategoryGap="28%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e5e5e5" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tick={{ fill: "#737373", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fill: "#737373", fontSize: 12 }}
            tickFormatter={(v: number) => compactINR(v)}
          />
          <Tooltip cursor={{ fill: "#f5f5f5" }} content={<ChartTooltip />} />
          <Bar dataKey="invoiced" name="Invoiced" fill={INVOICED_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="collected" name="Collected" fill={COLLECTED_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
