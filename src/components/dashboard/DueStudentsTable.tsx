import React from 'react';
import { formatVND } from '../../lib/currencyHelper';
import { CreditCard, AlertCircle } from 'lucide-react';
import type { Student } from '../../types';

interface TuitionSummary {
  totalExpectedFee: number;
  totalPaid: number;
  remainingAmount: number;
  courseBreakdown: { courseName: string; className: string; fee: number }[];
}

interface DueStudent {
  student: Student;
  summary: TuitionSummary;
}

interface DueStudentsTableProps {
  dueStudents: DueStudent[];
  onRecordPayment: (student: Student) => void;
  onNavigateToTuition: () => void;
}

export function DueStudentsTable({ dueStudents, onRecordPayment, onNavigateToTuition }: DueStudentsTableProps) {
  if (dueStudents.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 space-y-2">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="text-sm font-bold text-slate-200">Không có học viên nào nợ học phí!</div>
        <p className="text-xs text-slate-400">Khi bạn thêm học viên mới và xếp lớp, danh sách đóng phí sẽ tự động cập nhật tại đây.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/60">
              <th className="py-3 px-4">Học Viên</th>
              <th className="py-3 px-4">Khóa Học Đăng Ký</th>
              <th className="py-3 px-4 text-right">Định Mức</th>
              <th className="py-3 px-4 text-right">Đã Thanh Toán</th>
              <th className="py-3 px-4 text-right">Còn Nợ / Cần Thu</th>
              <th className="py-3 px-4 text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {dueStudents.map(({ student, summary }) => (
              <tr key={student.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3.5 px-4 font-bold text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                      {student.fullName.split(' ').pop()?.slice(0, 2).toUpperCase() || 'HV'}
                    </div>
                    <div>
                      <div className="text-slate-100 font-extrabold">{student.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Mã: {student.code} · SĐT: {student.phone}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-slate-300">
                  {summary.courseBreakdown.length > 0 ? (
                    <div className="space-y-1">
                      {summary.courseBreakdown.map((cb, idx) => (
                        <span
                          key={idx}
                          className="inline-block px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 text-[11px] font-semibold mr-1"
                        >
                          {cb.className} ({formatVND(cb.fee)})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Chưa đăng ký lớp</span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-right font-bold text-slate-200">
                  {formatVND(summary.totalExpectedFee)}
                </td>
                <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                  {formatVND(summary.totalPaid)}
                </td>
                <td className="py-3.5 px-4 text-right font-black text-rose-400">
                  {formatVND(summary.remainingAmount)}
                </td>
                <td className="py-3.5 px-4 text-center">
                  <button
                    onClick={() => onRecordPayment(student)}
                    className="px-3 py-1.5 rounded-xl bg-[#b48648] hover:bg-amber-600 text-black font-extrabold text-xs shadow-md shadow-amber-600/20 inline-flex items-center gap-1 transition-all active:scale-95"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Thu Học Phí</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={onNavigateToTuition}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold"
        >
          Quản Lý Sổ Quỹ Chi Tiết
        </button>
      </div>
    </>
  );
}
