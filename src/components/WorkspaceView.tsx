import React, { useState } from 'react';
import {
  getStudents,
  getTuitionTransactions,
  getStudentTuitionSummary,
} from '../lib/storage';

import { exportToGoogleSheets } from '../lib/workspaceApi';

import {
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export const WorkspaceView: React.FC = () => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const students = getStudents();
  const transactions = getTuitionTransactions().filter((t) => !t.isVoided);

  // Export 1: Student Roster
  const handleExportStudents = async () => {
    setLoadingAction('export_students');
    setStatusMsg('Đang khởi tạo Google Sheet danh sách học viên...');

    const headers = [
      'Mã HV',
      'Họ Và Tên',
      'Giới Tính',
      'Số Điện Thoại',
      'Địa Chỉ',
      'Trạng Thái',
      'Học Phí Định Mức (VND)',
      'Đã Nộp (VND)',
      'Còn Nợ (VND)',
    ];

    const rows = students.map((s) => {
      const summary = getStudentTuitionSummary(s.id);
      return [
        s.code,
        s.fullName,
        s.gender,
        s.phone,
        s.address || '',
        s.status === 'Active' ? 'Đang học' : s.status === 'Reserved' ? 'Bảo lưu' : 'Nghỉ học',
        summary.totalExpectedFee,
        summary.totalPaid,
        summary.remainingAmount,
      ];
    });

    const res = await exportToGoogleSheets('Danh Sách Học Viên Hiếu Vũ Music', headers, rows);
    setLoadingAction(null);

    if (res.success) {
      setStatusMsg(`🎉 Đã tạo Google Sheet thành công! File URL: ${res.spreadsheetUrl}`);
      if (res.spreadsheetUrl) window.open(res.spreadsheetUrl, '_blank');
    } else {
      setStatusMsg(`⚠️ ${res.error}`);
    }
  };

  // Export 2: Financial Ledger
  const handleExportLedger = async () => {
    setLoadingAction('export_ledger');
    setStatusMsg('Đang xuất Sổ Quỹ Thu Học Phí lên Google Sheets...');

    const headers = [
      'Số Biên Lai',
      'Thứ Tự (Seq)',
      'Học Viên',
      'Số Tiền (VND)',
      'Ngày Thu',
      'Hình Thức',
      'Nội Dung Thu',
      'Người Thu',
      'SHA-256 Hash Vẹn Toàn',
    ];

    const rows = transactions.map((t) => [
      t.invoiceNumber,
      t.sequenceNumber,
      t.studentName,
      t.amount,
      t.paymentDate,
      t.paymentMethod === 'Cash' ? 'Tiền mặt' : 'Chuyển khoản',
      t.period,
      t.collectorName,
      t.integrityHash,
    ]);

    const res = await exportToGoogleSheets('Sổ Quỹ Thu Học Phí Hiếu Vũ Music', headers, rows);
    setLoadingAction(null);

    if (res.success) {
      setStatusMsg(`🎉 Đã tạo Sổ Quỹ Google Sheet thành công! File URL: ${res.spreadsheetUrl}`);
      if (res.spreadsheetUrl) window.open(res.spreadsheetUrl, '_blank');
    } else {
      setStatusMsg(`⚠️ ${res.error}`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs tracking-wider uppercase mb-1">
              <Sparkles className="w-4 h-4 text-emerald-400" /> Tích Hợp Google Sheets Chính Thức
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Google Sheets Integration Center
            </h2>
            <p className="text-slate-400 text-xs mt-1 max-w-xl">
              Xuất dữ liệu hồ sơ học viên, báo cáo tài chính và sổ quỹ thu học phí trực tiếp ra Google Sheets.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-slate-700">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-xs font-bold text-white">OAuth Workspace Ready</div>
              <div className="text-[10px] text-slate-400">Google Spreadsheets Active</div>
            </div>
          </div>
        </div>

        {statusMsg && (
          <div className="mt-4 p-3 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-blue-300 flex items-center justify-between">
            <span>{statusMsg}</span>
            <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-white font-bold">
              Đóng
            </button>
          </div>
        )}
      </div>

      {/* Google Sheets Exporter Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm max-w-3xl">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-lg">Google Sheets Exporter</h3>
            <p className="text-xs text-slate-400">Tạo bảng tính trực tuyến và cập nhật báo cáo tự động</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-200 text-sm">1. Danh Sách Học Viên & Định Mức</div>
              <p className="text-xs text-slate-400 mt-1">
                Xuất toàn bộ {students.length} hồ sơ học viên, thông tin liên lạc phụ huynh và dư nợ học phí.
              </p>
            </div>
            <button
              onClick={handleExportStudents}
              disabled={loadingAction === 'export_students'}
              className="w-full mt-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
            >
              {loadingAction === 'export_students' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Xuất Bảng Học Viên Trực Tiếp</span>
            </button>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-200 text-sm">2. Sổ Quỹ Thu Học Phí & Mã Hash</div>
              <p className="text-xs text-slate-400 mt-1">
                Xuất {transactions.length} biên lai thu tiền với đầy đủ chữ ký số mã hóa SHA-256.
              </p>
            </div>
            <button
              onClick={handleExportLedger}
              disabled={loadingAction === 'export_ledger'}
              className="w-full mt-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
            >
              {loadingAction === 'export_ledger' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Xuất Sổ Quỹ Tài Chính Trực Tiếp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
