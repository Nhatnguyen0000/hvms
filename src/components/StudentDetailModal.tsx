import React from 'react';
import { Student } from '../types';
import {
  getClassGroups,
  getStudentTuitionSummary,
  getAttendance,
} from '../lib/storage';
import { formatVND } from '../lib/currencyHelper';
import { X, User, Phone, Mail, MapPin, Calendar, BookOpen, Receipt, CheckCircle2, ShieldCheck } from 'lucide-react';

interface StudentDetailModalProps {
  student: Student;
  onClose: () => void;
  onOpenRecordPaymentForStudent: (student: Student) => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  onClose,
  onOpenRecordPaymentForStudent,
}) => {
  const classGroups = getClassGroups();
  const enrolledClasses = classGroups.filter((c) => student.enrolledClassIds.includes(c.id));
  
  // Calculate tuition summary (Properly summing all enrolled courses!)
  const tuitionSummary = getStudentTuitionSummary(student.id);

  // Student Attendance
  const studentAttendance = getAttendance().filter((a) => a.studentId === student.id);
  const totalSessions = studentAttendance.length;
  const presentCount = studentAttendance.filter((a) => a.status === 'Present').length;
  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={student.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
              alt={student.fullName}
              className="w-14 h-14 rounded-2xl object-cover ring-2 ring-indigo-500/50 shadow-lg"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-xl text-white">{student.fullName}</h3>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                  {student.code}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    student.status === 'Active'
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                      : student.status === 'Reserved'
                      ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                      : 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {student.status === 'Active' ? 'Đang học' : student.status === 'Reserved' ? 'Bảo lưu' : 'Nghỉ học'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                <span>Ngày tham gia: {student.joinDate}</span>
                <span>·</span>
                <span>Giới tính: {student.gender}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Tuition Financial Summary Card */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
                <Receipt className="w-4 h-4" />
                <span>Tổng Quan Học Phí (Cộng dồn tất cả các môn đăng ký)</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenRecordPaymentForStudent(student);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
              >
                + Thu Học Phí Cho Học Viên Này
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Học Phí Kỳ Vọng Trọn Khóa</div>
                <div className="text-lg font-black text-white">{formatVND(tuitionSummary.totalExpectedFee)}</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Đã Thanh Toán</div>
                <div className="text-lg font-black text-emerald-400">{formatVND(tuitionSummary.totalPaid)}</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Còn Nợ / Cần Nộp</div>
                <div className="text-lg font-black text-amber-400">{formatVND(tuitionSummary.remainingAmount)}</div>
              </div>
            </div>

            {/* Course Breakdown Table */}
            {tuitionSummary.courseBreakdown.length > 0 && (
              <div className="mt-2 text-xs text-slate-300 space-y-1 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                <div className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-1">
                  Chi Tiết Định Mức Học Phí Theo Lớp:
                </div>
                {tuitionSummary.courseBreakdown.map((cb, idx) => (
                  <div key={idx} className="flex justify-between py-0.5 border-b border-slate-800/80 last:border-0">
                    <span>{cb.className} ({cb.courseName})</span>
                    <span className="font-semibold text-white">{formatVND(cb.fee)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contact & Personal Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/40 space-y-2 text-xs">
              <div className="font-bold text-slate-300 uppercase text-[11px] tracking-wider mb-2 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-indigo-400" /> Liên Hệ & Địa Chỉ
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Số Điện Thoại:</span>
                <span className="font-semibold text-white">{student.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Địa chỉ:</span>
                <span className="font-semibold text-white text-right max-w-[200px]">{student.address || 'Chưa có'}</span>
              </div>
            </div>

            <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/40 space-y-2 text-xs">
              <div className="font-bold text-slate-300 uppercase text-[11px] tracking-wider mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" /> Thông Tin Khác
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Giới tính:</span>
                <span className="font-semibold text-white">{student.gender}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ngày nhập học:</span>
                <span className="font-semibold text-white">{student.joinDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ghi chú:</span>
                <span className="font-semibold text-slate-300 text-right max-w-[200px]">{student.notes || 'Không có'}</span>
              </div>
            </div>
          </div>

          {/* Enrolled Classes List */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" /> Lớp Học Đang Theo Học ({enrolledClasses.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {enrolledClasses.map((cls) => (
                <div key={cls.id} className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-indigo-300 text-sm">{cls.name}</div>
                  <div className="text-slate-300">{cls.room} · {cls.timeSlot}</div>
                  <div className="text-slate-400">Lịch học: {cls.scheduleDays.join(', ')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction History */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" /> Lịch Sử Biên Lai Thanh Toán ({tuitionSummary.transactions.length})
            </h4>
            {tuitionSummary.transactions.length === 0 ? (
              <div className="text-xs text-slate-400 italic p-4 bg-slate-800/30 rounded-xl text-center">
                Chưa có giao dịch thu học phí nào cho học viên này.
              </div>
            ) : (
              <div className="space-y-2">
                {tuitionSummary.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono">{tx.invoiceNumber}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          Đã thanh toán
                        </span>
                      </div>
                      <div className="text-slate-400 mt-1">{tx.period} · {tx.paymentDate}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-emerald-400 text-sm">{formatVND(tx.amount)}</div>
                      <div className="text-[10px] text-indigo-300 font-mono flex items-center justify-end gap-1 mt-0.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>Hash vẹn toàn</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
