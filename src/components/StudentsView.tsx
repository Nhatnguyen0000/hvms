import React, { useState } from 'react';
import { Student, StudentStatus } from '../types';
import { getStudents, getClassGroups, getStudentTuitionSummary } from '../lib/storage';
import { formatVND } from '../lib/currencyHelper';
import { exportToGoogleSheets } from '../lib/workspaceApi';
import { exportStudentListPDF } from '../lib/pdfExporter';
import { StudentFormModal } from './StudentFormModal';
import { StudentDetailModal } from './StudentDetailModal';
import { StudentCardModal } from './StudentCardModal';

import {
  Search,
  UserPlus,
  FileSpreadsheet,
  FileText,
  Filter,
  Eye,
  Edit,
  DollarSign,
  Phone,
  BookOpen,
  QrCode,
} from 'lucide-react';

interface StudentsViewProps {
  onOpenRecordPaymentForStudent: (student: Student) => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  onOpenRecordPaymentForStudent,
}) => {
  const [students, setStudents] = useState<Student[]>(getStudents());
  const classGroups = getClassGroups();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<Student | null>(null);
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<Student | null>(null);

  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const refreshData = () => {
    setStudents(getStudents());
  };

  const filteredStudents = students.filter((student) => {
    const matchSearch =
      student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.phone.includes(searchTerm);

    const matchStatus = statusFilter === 'ALL' || student.status === statusFilter;
    const matchClass =
      classFilter === 'ALL' || student.enrolledClassIds.includes(classFilter);

    return matchSearch && matchStatus && matchClass;
  });

  const handleExportSheets = async () => {
    setExportMsg('Đang tạo Google Sheet danh sách học viên...');
    const headers = [
      'Mã HV',
      'Họ Và Tên',
      'Giới Tính',
      'Số Điện Thoại',
      'Địa Chỉ',
      'Trạng Thái',
      'Ngày Nhập Học',
      'Định Mức Học Phí (VND)',
      'Đã Nộp (VND)',
      'Còn Nợ (VND)',
    ];

    const rows = filteredStudents.map((s) => {
      const summary = getStudentTuitionSummary(s.id);
      return [
        s.code,
        s.fullName,
        s.gender,
        s.phone,
        s.address || '',
        s.status === 'Active' ? 'Đang học' : s.status === 'Reserved' ? 'Bảo lưu' : 'Nghỉ học',
        s.joinDate,
        summary.totalExpectedFee,
        summary.totalPaid,
        summary.remainingAmount,
      ];
    });

    const res = await exportToGoogleSheets('Danh Sách Học Viên Hiếu Vũ', headers, rows);
    if (res.success) {
      setExportMsg(`✅ Đã xuất thành công! Spreadsheet ID: ${res.spreadsheetId}`);
      if (res.spreadsheetUrl) {
        window.open(res.spreadsheetUrl, '_blank');
      }
    } else {
      setExportMsg(`⚠️ ${res.error}`);
    }
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      setExportMsg('Đang khởi tạo file PDF danh sách học viên...');
      
      let filterTitle = '';
      if (statusFilter !== 'ALL') {
        filterTitle += `Trạng thái: ${statusFilter === 'Active' ? 'Đang học' : statusFilter === 'Reserved' ? 'Bảo lưu' : 'Nghỉ học'}. `;
      }
      if (classFilter !== 'ALL') {
        const cls = classGroups.find((c) => c.id === classFilter);
        if (cls) filterTitle += `Lớp: ${cls.name}. `;
      }

      await exportStudentListPDF(filteredStudents, filterTitle);
      setExportMsg('✅ Đã xuất PDF danh sách học viên thành công!');
    } catch (err: any) {
      setExportMsg(`❌ Lỗi khi xuất PDF: ${err.message || 'Không thể tạo file'}`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Quản Lý Hồ Sơ Học Viên</h2>
          <p className="text-slate-400 text-xs mt-1">
            Danh sách học viên, phân lớp, theo dõi tiến độ và học phí định mức từng môn.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <FileText className="w-4 h-4 text-red-400" />
            <span>{isExportingPDF ? 'Đang tạo PDF...' : 'Xuất PDF Danh Sách'}</span>
          </button>
          <button
            onClick={() => {
              setStudentToEdit(null);
              setIsFormOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm Học Viên Mới</span>
          </button>
        </div>
      </div>

      {exportMsg && (
        <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-indigo-300 flex items-center justify-between">
          <span>{exportMsg}</span>
          <button onClick={() => setExportMsg(null)} className="text-slate-400 hover:text-white font-bold">
            Đóng
          </button>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Tìm theo Mã HV, Tên, SĐT, Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 text-slate-200 focus:outline-none text-xs font-semibold cursor-pointer"
            >
              <option value="ALL" className="bg-slate-800 text-slate-200">Tất cả trạng thái</option>
              <option value="Active" className="bg-slate-800 text-slate-200">Đang học</option>
              <option value="Reserved" className="bg-slate-800 text-slate-200">Bảo lưu</option>
              <option value="Dropped" className="bg-slate-800 text-slate-200">Nghỉ học</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-slate-800 text-slate-200 focus:outline-none text-xs font-semibold cursor-pointer max-w-[180px]"
            >
              <option value="ALL" className="bg-slate-800 text-slate-200">Tất cả lớp học</option>
              {classGroups.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-800 text-slate-200">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.map((student) => {
          const enrolledClasses = classGroups.filter((c) => student.enrolledClassIds.includes(c.id));
          const tuitionSummary = getStudentTuitionSummary(student.id);

          return (
            <div
              key={student.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-sm space-y-4 transition-all flex flex-col justify-between"
            >
              {/* Top Row: Avatar & Basic Info */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#b48648]/20 to-amber-600/10 border border-[#b48648]/30 flex items-center justify-center shrink-0">
                      <span className="text-[#b48648] font-bold text-sm tracking-tight">
                        {student.fullName.split(' ').pop()?.slice(0, 2).toUpperCase() || 'HV'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base leading-snug">{student.fullName}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                          {student.code}
                        </span>
                        <span className="text-[11px] text-slate-400">{student.gender}</span>
                      </div>
                    </div>
                  </div>

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

                {/* Contact Phone & Classes */}
                <div className="text-xs space-y-1.5 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-indigo-400" /> SĐT:
                    </span>
                    <span className="font-semibold">{student.phone}</span>
                  </div>

                  <div className="text-slate-400">
                    <span className="font-semibold text-slate-300">Lớp học ({enrolledClasses.length}):</span>{' '}
                    {enrolledClasses.length > 0 ? (
                      enrolledClasses.map((c) => c.name).join(', ')
                    ) : (
                      <span className="italic text-slate-500">Chưa xếp lớp</span>
                    )}
                  </div>
                </div>

                {/* Tuition Ledger Metrics */}
                <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Đã Thanh Toán</div>
                    <div className="font-bold text-emerald-400">{formatVND(tuitionSummary.totalPaid)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400">Còn Cần Nộp</div>
                    <div className="font-bold text-amber-400">{formatVND(tuitionSummary.remainingAmount)}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-1.5 text-xs">
                <button
                  onClick={() => setSelectedStudentForCard(student)}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1 transition-all"
                  title="Xem Thẻ Học Viên & Mã QR"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Thẻ HV</span>
                </button>

                <button
                  onClick={() => setSelectedStudentForDetail(student)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1 transition-all"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Chi Tiết</span>
                </button>

                <button
                  onClick={() => {
                    setStudentToEdit(student);
                    setIsFormOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1 transition-all"
                >
                  <Edit className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sửa</span>
                </button>

                <button
                  onClick={() => onOpenRecordPaymentForStudent(student)}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 transition-all shadow-md shadow-emerald-600/20"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Thu Tiền</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredStudents.length === 0 && (
        <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
          Không tìm thấy học viên nào phù hợp với bộ lọc.
        </div>
      )}

      {/* Modals */}
      {isFormOpen && (
        <StudentFormModal
          studentToEdit={studentToEdit}
          onClose={() => setIsFormOpen(false)}
          onSaved={refreshData}
        />
      )}

      {selectedStudentForDetail && (
        <StudentDetailModal
          student={selectedStudentForDetail}
          onClose={() => setSelectedStudentForDetail(null)}
          onOpenRecordPaymentForStudent={onOpenRecordPaymentForStudent}
        />
      )}

      {selectedStudentForCard && (
        <StudentCardModal
          student={selectedStudentForCard}
          onClose={() => setSelectedStudentForCard(null)}
        />
      )}
    </div>
  );
};
