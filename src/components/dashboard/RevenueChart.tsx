import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { formatVND } from '../../lib/currencyHelper';
import { ArrowUpRight } from 'lucide-react';

interface MonthlyData {
  month: string;
  revenue: number;
}

interface RevenueChartProps {
  data: MonthlyData[];
  onNavigateToTuition: () => void;
}

export function RevenueChart({ data, onNavigateToTuition }: RevenueChartProps) {
  return (
    <div className="lg:col-span-2 glass-panel rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-base">Biểu Đồ Doanh Thu Học Phí (VND)</h3>
          <p className="text-xs text-slate-400">Thống kê doanh thu theo các tháng gần nhất</p>
        </div>
        <button
          onClick={onNavigateToTuition}
          className="text-xs font-semibold text-[#b48648] hover:underline flex items-center gap-1"
        >
          <span>Xem Sổ Quỹ</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
            />
            <Tooltip
              formatter={(val: number) => [formatVND(val), 'Doanh Thu']}
              contentStyle={{
                backgroundColor: '#141414',
                borderColor: 'rgba(255,255,255,0.15)',
                color: '#fff',
                borderRadius: '12px',
              }}
            />
            <Bar dataKey="revenue" fill="#b48648" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
