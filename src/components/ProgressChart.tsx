"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ProgressPoint } from "@/types";

interface ProgressChartProps {
  points: ProgressPoint[];
}

const METRIC_CONFIG: Record<string, { color: string; label: string }> = {
  mastery: { color: "#3B82F6", label: "Mastery" },
  assessment_score: { color: "#8B5CF6", label: "Assessment" },
  confidence: { color: "#10B981", label: "Confidence" },
  code_tests_passed: { color: "#F59E0B", label: "Tests Passed" },
  weak_spot_count: { color: "#EF4444", label: "Weak Spots" },
};

export function ProgressChart({ points }: ProgressChartProps) {
  if (points.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">
        No progress data yet. Complete lessons to see your progress over time.
      </div>
    );
  }

  // Get unique metrics
  const metrics = [...new Set(points.map((p) => p.metric))];

  // Build chart data: [{date, mastery: v, assessment_score: v, ...}]
  const byDate = points.reduce<Record<string, Record<string, number>>>((acc, p) => {
    const date = new Date(p.recorded_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (!acc[date]) acc[date] = {};
    acc[date][p.metric] = p.value;
    return acc;
  }, {});

  const chartData = Object.entries(byDate)
    .map(([date, values]) => ({ date, ...values }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Progress Over Time</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />
              {metrics.map((metric) => {
                const config = METRIC_CONFIG[metric] ?? { color: "#9ca3af", label: metric };
                return (
                  <Line
                    key={metric}
                    type="monotone"
                    dataKey={metric}
                    name={config.label}
                    stroke={config.color}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Raw data table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Data Points</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-gray-500 font-medium">Date</th>
                <th className="pb-2 text-gray-500 font-medium">Metric</th>
                <th className="pb-2 text-gray-500 font-medium text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {points.slice(-10).reverse().map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-1.5 text-gray-500">
                    {new Date(p.recorded_at).toLocaleDateString()}
                  </td>
                  <td className="py-1.5 text-gray-700">
                    {METRIC_CONFIG[p.metric]?.label ?? p.metric}
                  </td>
                  <td className="py-1.5 text-gray-900 font-medium text-right">
                    {Math.round(p.value)}
                    {p.metric !== "weak_spot_count" ? "%" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
