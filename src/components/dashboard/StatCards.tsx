import React from 'react';
import { Users, GraduationCap, CreditCard, DollarSign } from 'lucide-react';
import { formatVND } from '../../lib/currencyHelper';

interface StatCardsProps {
  students: { length: number };
  activeStudentsCount: number;
  activeTeachersCount: number;
  pendingPaymentsCount: number;
  pendingPaymentsTotalAmount: number;
  totalRevenue: number;
  transactions: { length: number };
  teachers: { length: number };
  currentMonthLabel: string;
}

export function StatCards({
  students,
  activeStudentsCount,
  activeTeachersCount,
  pendingPaymentsCount,
  pendingPaymentsTotalAmount,
  totalRevenue,
  transactions,
  teachers,
}: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Active Students */}
      <div className="glass-panel rounded-2xl p-5 hover:border-[#b48648]/40 transition-all">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Học Viên Đang Học</span>
          <div className="w-9 h-9 rounded-xl bg-[#b48648]/15 text-[#b48648] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <div className="text-2xl font-black text-white">{activeStudentsCount} / {students.length}</div>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <span className="text-emerald-400 font-bold">
            {students.length > 0 ? Math.round((activeStudentsCount / students.length) * 100) : 100}%
          </span>{' '}
          học viên hoạt động
        </p>
      </div>

      {/* Pending Tuition */}
      <div className="glass-panel rounded-2xl p-5 hover:border-amber-500/40 transition-all">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Học Phí Chờ Thu</span>
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
        <div className="text-2xl font-black text-amber-400">{pendingPaymentsCount} Học Viên</div>
        <p className="text-xs text-slate-400 mt-1">
          Tổng nợ: {formatVND(pendingPaymentsTotalAmount)}
        </p>
      </div>

      {/* Total Revenue */}
      <div className="glass-panel rounded-2xl p-5 hover:border-emerald-500/40 transition-all">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Tổng Doanh Thu</span>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
        <div className="text-2xl font-black text-emerald-400">{formatVND(totalRevenue)}</div>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          {transactions.length} biên lai hoàn tất
        </p>
      </div>

      {/* Teachers */}
      <div className="glass-panel rounded-2xl p-5 hover:border-purple-500/40 transition-all">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Đội Ngũ Giáo Viên</span>
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>
        <div className="text-2xl font-black text-white">{teachers.length} Thầy Cô</div>
        <p className="text-xs text-slate-400 mt-1">
          {activeTeachersCount} đang hoạt động
        </p>
      </div>
    </div>
  );
}
