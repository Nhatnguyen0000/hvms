import React, { useState } from 'react';
import {
  Users,
  GraduationCap,
  DollarSign,
  Calendar,
  Receipt,
  PlusCircle,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  CreditCard,
} from 'lucide-react';

import {
  getStudents,
  getTeachers,
  getTuitionTransactions,
  getClassGroups,
  getAuditLogs,
  getStudentTuitionSummary,
} from '../lib/storage';

import { Student } from '../types';
import { formatVND } from '../lib/currencyHelper';
import { exportToGoogleSheets } from '../lib/workspaceApi';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';

interface DashboardViewProps {
  onOpenRecordPayment: () => void;
  onOpenRecordPaymentWithStudent?: (student: Student) => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenRecordPayment,
  onOpenRecordPaymentWithStudent,
  onNavigateTab,
}) => {
  const students = getStudents();
  const teachers = getTeachers();
  const classGroups = getClassGroups();
  const transactions = getTuitionTransactions().filter((t) => !t.isVoided);
  const auditLogs = getAuditLogs().slice(0, 5);

  const activeStudents = students.filter((s) => s.status === 'Active');
  const activeStudentsCount = activeStudents.length;
  const activeTeachersCount = teachers.filter((t) => t.status === 'Active').length;
  const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);

  // Calculate Due Tuition Students & Pending Payments for Current Month
  const dueStudents = students.map((s) => {
    const summary = getStudentTuitionSummary(s.id);
    return { student: s, summary };
  }).filter((item) => item.summary.remainingAmount > 0 || item.student.enrolledClassIds.length > 0);

  const now = new Date();
  const currentMonthLabel = `Tháng ${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
  const pendingTuitionStudents = dueStudents.filter((item) => item.summary.remainingAmount > 0);
  const pendingPaymentsCount = pendingTuitionStudents.length;
  const pendingPaymentsTotalAmount = pendingTuitionStudents.reduce((sum, item) => sum + item.summary.remainingAmount, 0);

  // Revenue chart data by month - computed from real transactions
  const monthlyData = (() => {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Build last 6 months (including current month)
    const months: { month: string; year: number; monthIndex: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      months.push({
        month: `Thg ${(d.getMonth() + 1).toString().padStart(2, '0')}`,
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
      });
    }

    return months.map(({ month, year, monthIndex }) => {
      const revenue = transactions
        .filter((t) => {
          const txDate = new Date(t.paymentDate);
          return txDate.getFullYear() === year && txDate.getMonth() === monthIndex && !t.isVoided;
        })
        .reduce((sum, t) => sum + t.amount, 0);
      return { month, revenue };
    });
  })();

  // Student status distribution
  const studentDistributionData = [
    { name: 'Đang học', value: activeStudentsCount, color: '#10b981' },
    { name: 'Bảo lưu', value: students.filter((s) => s.status === 'Reserved').length, color: '#f59e0b' },
    { name: 'Nghỉ học', value: students.filter((s) => s.status === 'Dropped').length, color: '#ef4444' },
  ];

  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const handleQuickExportSheets = async () => {
    setExportMessage('Đang kết nối Google Sheets...');
    const headers = ['Mã BL', 'Học Viên', 'Số Tiền (VND)', 'Ngày Thu', 'Hình Thức', 'Nội Dung', 'Người Thu'];
    const rows = transactions.map((t) => [
      t.invoiceNumber,
      t.studentName,
      t.amount,
      t.paymentDate,
      t.paymentMethod === 'Cash' ? 'Tiền mặt' : 'Chuyển khoản',
      t.period,
      t.collectorName,
    ]);

    const res = await exportToGoogleSheets('Báo Cáo Sổ Quỹ Thu Học Phí', headers, rows);
    if (res.success) {
      setExportMessage(`✅ Đã xuất thành công! Spreadsheet URL: ${res.spreadsheetUrl}`);
      if (res.spreadsheetUrl) {
        window.open(res.spreadsheetUrl, '_blank');
      }
    } else {
      setExportMessage(`⚠️ ${res.error}`);
    }
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#141414] via-[#1c1710] to-[#141414] border border-[#b48648]/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute -right-12 -bottom-12 w-80 h-80 bg-[#b48648]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-[#b48648] font-bold text-xs tracking-widest uppercase mb-1">
              <Sparkles className="w-4 h-4" /> Bàn Làm Việc Tổng Quan Trung Tâm
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-wide text-white uppercase">
              TRUNG TÂM ÂM NHẠC <span className="gold-gradient-text">HIẾU VŨ</span>
            </h2>
            <p className="text-slate-300 text-sm mt-2 max-w-2xl font-normal leading-relaxed">
              Nơi khơi nguồn đam mê nghệ thuật và ươm mầm tài năng âm nhạc đỉnh cao với các bộ môn <span className="text-[#b48648] font-bold">Piano</span>, <span className="text-[#b48648] font-bold">Organ</span> và <span className="text-[#b48648] font-bold">Guitar</span>. Đồng hành cùng học viên trên hành trình chinh phục những giai điệu rực rỡ nhất.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenRecordPayment}
              className="px-5 py-3 bg-[#b48648] hover:bg-[#8a6331] text-black font-extrabold text-xs sm:text-sm rounded-2xl gold-btn-shadow flex items-center gap-2 transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Thu Học Phí Mới</span>
            </button>
            <button
              onClick={() => onNavigateTab('attendance')}
              className="px-5 py-3 bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm rounded-2xl border border-white/10 flex items-center gap-2 transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4 text-[#b48648]" />
              <span>Điểm Danh Ca Học</span>
            </button>
          </div>
        </div>

        {exportMessage && (
          <div className="mt-4 p-3 bg-black/60 border border-[#b48648]/40 rounded-xl text-xs text-[#e6c28f] flex items-center justify-between">
            <span>{exportMessage}</span>
            <button
              onClick={() => setExportMessage(null)}
              className="text-slate-400 hover:text-white text-xs font-bold"
            >
              Đóng
            </button>
          </div>
        )}
      </div>

      {/* Summary Stats Widget - Current Month Executive Summary */}
      <div className="bg-gradient-to-br from-slate-900 via-[#181510] to-slate-900 border border-[#b48648]/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-[#b48648] font-extrabold text-xs tracking-widest uppercase">
              <Sparkles className="w-4 h-4 text-[#b48648]" />
              <span>BÁO CÁO TỔNG QUAN TỔNG HỢP</span>
            </div>
            <h3 className="text-xl font-extrabold text-white tracking-tight mt-1">
              Chỉ Số Trọng Yếu - {currentMonthLabel}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Thống kê trực tiếp tình hình học viên, đội ngũ giảng dạy và công nợ học phí tháng hiện tại
            </p>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-[#b48648]/15 border border-[#b48648]/30 text-[#e6c28f] text-xs font-bold self-start sm:self-center flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#b48648]" />
            <span>Cập nhật thời gian thực</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Total Students */}
          <div className="bg-slate-950/70 border border-white/10 hover:border-[#b48648]/50 rounded-2xl p-5 transition-all shadow-lg flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Số Học Viên</span>
                <div className="text-3xl font-black text-white mt-2 tracking-tight">
                  {students.length} <span className="text-sm font-semibold text-slate-400">học viên</span>
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
                <Users className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-400">Đang theo học:</span>
              <span className="font-extrabold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                {activeStudentsCount} / {students.length} ({students.length > 0 ? Math.round((activeStudentsCount / students.length) * 100) : 100}%)
              </span>
            </div>
          </div>

          {/* Card 2: Active Teachers */}
          <div className="bg-slate-950/70 border border-white/10 hover:border-purple-500/50 rounded-2xl p-5 transition-all shadow-lg flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Giáo Viên Hoạt Động</span>
                <div className="text-3xl font-black text-purple-300 mt-2 tracking-tight">
                  {activeTeachersCount} <span className="text-sm font-semibold text-slate-400">thầy cô</span>
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 shadow-inner">
                <GraduationCap className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-400">Bộ môn phụ trách:</span>
              <span className="font-bold text-purple-300">Piano · Organ · Guitar</span>
            </div>
          </div>

          {/* Card 3: Pending Payments for Current Month */}
          <div className="bg-slate-950/70 border border-amber-500/30 hover:border-amber-500/60 rounded-2xl p-5 transition-all shadow-lg flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Học Phí Chờ Thu ({currentMonthLabel})</span>
                <div className="text-3xl font-black text-amber-400 mt-2 tracking-tight">
                  {formatVND(pendingPaymentsTotalAmount)}
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-400">Học viên chưa đóng:</span>
              <span className="font-extrabold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-500/30">
                {pendingPaymentsCount} học viên
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-5 hover:border-[#b48648]/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Học Viên Đang Học</span>
            <div className="w-9 h-9 rounded-xl bg-[#b48648]/15 text-[#b48648] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{activeStudentsCount} / {students.length}</div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-400 font-bold">{students.length > 0 ? Math.round((activeStudentsCount / students.length) * 100) : 100}%</span> học viên hoạt động
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-5 hover:border-[#b48648]/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Học Phí Sắp / Đến Hạn</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400">{dueStudents.length} Học Viên</div>
          <p className="text-xs text-slate-400 mt-1">
            Cần theo dõi & nhắc thu
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-5 hover:border-[#b48648]/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng Doanh Thu</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400">{formatVND(totalRevenue)}</div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Receipt className="w-3.5 h-3.5 text-emerald-400" />
            {transactions.length} biên lai hoàn tất
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-5 hover:border-[#b48648]/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Đội Ngũ Giáo Viên</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{teachers.length} Thầy Cô</div>
          <p className="text-xs text-slate-400 mt-1">
            Piano, Organ, Guitar
          </p>
        </div>
      </div>

      {/* FEATURE 1: Danh Sách Học Viên Sắp Đến Hạn Đóng Học Phí */}
      <div className="bg-slate-900 border border-[#b48648]/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs uppercase tracking-wider">
              <AlertCircle className="w-4 h-4" />
              <span>THEO DÕI HỌC PHÍ TỰ ĐỘNG</span>
            </div>
            <h3 className="text-xl font-extrabold text-white tracking-tight mt-0.5">
              Danh Sách Học Viên Sắp Đến Hạn / Còn Nợ Học Phí
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tự động rà soát định mức khóa học (Piano: 450k, Organ: 500k, Guitar: 400k) và cảnh báo thu phí.
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('tuition')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold shrink-0 self-start sm:self-center"
          >
            Quản Lý Sổ Quỹ Chi Tiết
          </button>
        </div>

        {dueStudents.length > 0 ? (
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
                          <div className="text-[11px] text-slate-400 font-mono">Mã: {student.code} · SĐT: {student.phone}</div>
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
                        onClick={() => {
                          if (onOpenRecordPaymentWithStudent) {
                            onOpenRecordPaymentWithStudent(student);
                          } else {
                            onOpenRecordPayment();
                          }
                        }}
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
        ) : (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <UserCheck className="w-10 h-10 text-emerald-400 mx-auto opacity-80" />
            <div className="text-sm font-bold text-slate-200">Không có học viên nào nợ học phí!</div>
            <p className="text-xs text-slate-400">Khi bạn thêm học viên mới và xếp lớp, danh sách đóng phí sẽ tự động cập nhật tại đây.</p>
          </div>
        )}
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-white text-base">Biểu Đồ Doanh Thu Học Phí (VND)</h3>
              <p className="text-xs text-slate-400">Thống kê doanh thu theo các tháng gần nhất</p>
            </div>
            <button
              onClick={() => onNavigateTab('tuition')}
              className="text-xs font-semibold text-[#b48648] hover:underline flex items-center gap-1"
            >
              <span>Xem Sổ Quỹ</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${v / 1000000}M`} />
                <Tooltip
                  formatter={(val: any) => [formatVND(Number(val)), 'Doanh Thu']}
                  contentStyle={{ backgroundColor: '#141414', borderColor: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: '12px' }}
                />
                <Bar dataKey="revenue" fill="#b48648" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Student Status Pie */}
        <div className="glass-panel rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-base">Trạng Thái Học Viên</h3>
            <p className="text-xs text-slate-400">Tỷ lệ phân bổ học viên hiện tại</p>

            <div className="h-48 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={studentDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {studentDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#141414', borderColor: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2 border-t border-white/10 pt-3">
            {studentDistributionData.map((st) => (
              <div key={st.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: st.color }} />
                  <span className="text-slate-300 font-medium">{st.name}</span>
                </div>
                <span className="font-bold text-white">{st.value} học viên</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Transactions & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tuition Payments */}
        <div className="glass-panel rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white text-base">Giao Dịch Học Phí Gần Đây</h3>
            <button
              onClick={() => onNavigateTab('tuition')}
              className="text-xs font-semibold text-[#b48648] hover:underline"
            >
              Xem tất cả
            </button>
          </div>

          <div className="space-y-3">
            {transactions.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{tx.invoiceNumber}</span>
                    <span className="text-xs text-slate-300">· {tx.studentName}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{tx.period} · {tx.paymentDate}</div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-emerald-400 text-sm">{formatVND(tx.amount)}</div>
                  <div className="text-[10px] text-slate-400">{tx.paymentMethod === 'Cash' ? 'Tiền mặt' : 'Chuyển khoản'}</div>
                </div>
              </div>
            ))}

            {transactions.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs">Chưa có giao dịch thu học phí nào.</div>
            )}
          </div>
        </div>

        {/* Audit Log Stream */}
        <div className="glass-panel rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white text-base">Nhật Ký Thao Tác Hệ Thống</h3>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-xs font-semibold text-[#b48648] hover:underline"
            >
              Chi tiết Audit
            </button>
          </div>

          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#e6c28f]">{log.userName}</span>
                  <span className="text-[10px] text-slate-400">{log.timestamp}</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">{log.details}</p>
              </div>
            ))}

            {auditLogs.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs">Nhật ký sẽ tự động hiển thị khi có thao tác mới.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
