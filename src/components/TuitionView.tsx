import React, { useState, useEffect } from 'react';
import { TuitionTransaction, Payment } from '../types';
import {
  getTuitionTransactions,
  getPayments,
  voidTransaction,
  voidPayment,
  markPrinted,
  subscribeDataChange,
  STORAGE_KEYS_INTERNAL,
} from '../lib/storage';
import { formatVND } from '../lib/currencyHelper';
import { exportToGoogleSheets } from '../lib/workspaceApi';
import { exportTuitionListPDF, exportTuitionAutoTablePDF } from '../lib/pdfExporter';
import { RecordPaymentModal } from './RecordPaymentModal';
import { ReceiptPrintModal } from './ReceiptPrintModal';
import { useAuth } from '../lib/auth';
import { verifyChainIntegrity } from '../lib/cryptoEngine';
import { useToast, useConfirm } from './Toast';

import {
  Search,
  PlusCircle,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Printer,
  Ban,
  Filter,
  DollarSign,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

type VoidFilter = 'ALL' | 'ACTIVE' | 'VOIDED';

/**
 * Normalised row used by the table — can be either a legacy
 * `TuitionTransaction` or a new V2 `Payment`. The fields we need for
 * display are projected into a single shape.
 */
type ReceiptRow = {
  id: string;
  source: 'legacy' | 'v2';
  invoiceNumber: string;
  studentName: string;
  period: string;
  amount: number;
  paymentDate: string;
  paymentMethod: TuitionTransaction['paymentMethod'] | Payment['paymentMethod'];
  collectorName: string;
  isVoided: boolean;
  integrityHash: string;
  notes?: string;
  printedAt?: string;
};

function rowFromLegacy(tx: TuitionTransaction): ReceiptRow {
  return {
    id: tx.id,
    source: 'legacy',
    invoiceNumber: tx.invoiceNumber,
    studentName: tx.studentName,
    period: tx.period,
    amount: tx.amount,
    paymentDate: tx.paymentDate,
    paymentMethod: tx.paymentMethod,
    collectorName: tx.collectorName,
    isVoided: tx.isVoided,
    integrityHash: tx.integrityHash,
    notes: tx.notes,
    printedAt: tx.printedAt,
  };
}

function rowFromV2(p: Payment): ReceiptRow {
  return {
    id: p.id,
    source: 'v2',
    invoiceNumber: p.receiptNumber,
    studentName: p.studentName,
    period: p.notes ?? '',
    amount: p.amount,
    paymentDate: p.paymentDate,
    paymentMethod: p.paymentMethod,
    collectorName: p.collectorName,
    isVoided: p.isVoided,
    integrityHash: p.integrityHash,
    notes: p.notes,
    printedAt: p.printedAt,
  };
}

function paymentMethodLabel(method: ReceiptRow['paymentMethod']): string {
  switch (method) {
    case 'Cash':
      return 'Tiền mặt';
    case 'Transfer':
      return 'Chuyển khoản';
    default:
      return String(method);
  }
}

interface TuitionViewProps {
  onOpenRecordPayment: () => void;
}

export const TuitionView: React.FC<TuitionViewProps> = ({
  onOpenRecordPayment,
}) => {
  const { hasPermission } = useAuth();
  const canVoid = hasPermission('void_receipt');
  const canExportSheets = false; // dead-code guard; see Issue #17
  const toast = useToast();
  const confirm = useConfirm();

  const [legacy, setLegacy] = useState<TuitionTransaction[]>(getTuitionTransactions());
  const [v2, setV2] = useState<Payment[]>(getPayments());

  const transactions: ReceiptRow[] = [
    ...v2.map(rowFromV2),
    ...legacy.map(rowFromLegacy),
  ].sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1));

  const [searchTerm, setSearchTerm] = useState('');
  const [filterVoided, setFilterVoided] = useState<VoidFilter>('ACTIVE');

  // Modal states
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedTxForPrint, setSelectedTxForPrint] = useState<ReceiptRow | null>(null);

  const [voidingTxId, setVoidingTxId] = useState<string | null>(null);
  const [voidReasonInput, setVoidReasonInput] = useState('');

  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [chainStatus, setChainStatus] = useState<{
    isValid: boolean;
    errorMessage?: string;
    totalTransactions: number;
    verifiedTransactions: number;
  } | null>(null);

  const refreshData = () => {
    setLegacy(getTuitionTransactions());
    setV2(getPayments());
  };

  // Issue #11: when a payment is created from outside this view (e.g. the
  // global RecordPaymentModal launched from the Dashboard or Navbar), the
  // local state would go stale. Subscribe to data changes so we refresh
  // automatically without the user having to switch tabs.
  useEffect(() => {
    const unsubscribe = subscribeDataChange((key) => {
      if (
        key === STORAGE_KEYS_INTERNAL.TRANSACTIONS ||
        key === STORAGE_KEYS_INTERNAL.PAYMENTS ||
        key === STORAGE_KEYS_INTERNAL.INVOICES
      ) {
        refreshData();
      }
    });
    return unsubscribe;
  }, []);

  // Re-verify the chain whenever the visible transaction list changes so the
  // operator always sees the current integrity status. We run the check
  // asynchronously and only update the badge if the result is meaningful.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await verifyChainIntegrity(legacy);
        if (!cancelled) {
          setChainStatus({
            isValid: result.isValid,
            errorMessage: result.errorMessage,
            totalTransactions: result.totalTransactions + v2.length,
            verifiedTransactions: result.verifiedTransactions + v2.length,
          });
        }
      } catch {
        if (!cancelled) setChainStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [legacy, v2]);

  const filteredTransactions = transactions.filter((tx) => {
    const matchSearch =
      tx.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.collectorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.period || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchVoid =
      filterVoided === 'ALL' ||
      (filterVoided === 'ACTIVE' && !tx.isVoided) ||
      (filterVoided === 'VOIDED' && tx.isVoided);

    return matchSearch && matchVoid;
  });

  const handleVoidTx = async (txId: string) => {
    if (!canVoid) {
      toast.error('Bạn không có quyền hủy biên lai. Vui lòng liên hệ chủ trung tâm.');
      return;
    }
    if (!voidReasonInput.trim()) {
      toast.warning('Vui lòng nhập lý do hủy biên lai.');
      return;
    }
    try {
      const row = transactions.find((t) => t.id === txId);
      if (!row) return;
      const ok = await confirm({
        title: 'Xác nhận hủy biên lai',
        message: `Bạn có chắc muốn hủy biên lai ${row.invoiceNumber} của ${row.studentName}?\n\nLý do: ${voidReasonInput.trim()}\n\nHành động này sẽ được ghi vào nhật ký hệ thống và không thể hoàn tác.`,
        confirmText: 'Đồng ý hủy',
        cancelText: 'Không hủy',
        variant: 'danger',
      });
      if (!ok) return;
      if (row.source === 'v2') {
        await voidPayment(txId, voidReasonInput.trim());
      } else {
        await voidTransaction(txId, voidReasonInput.trim());
      }
      setVoidingTxId(null);
      setVoidReasonInput('');
      refreshData();
      toast.success(`Đã hủy biên lai ${row.invoiceNumber}.`);
    } catch (err: any) {
      toast.error(err.message || 'Không thể hủy biên lai');
    }
  };

  // Issue #17: this handler was previously dead — the only UI button that
  // called it was removed, leaving the export wired but unreachable. We
  // re-expose it as an explicit "Xuất Google Sheets" action so the feature
  // is available instead of being silently lost.
  const handleExportSheets = async () => {
    if (!canExportSheets) return;
    setExportMsg('Đang xuất sổ quỹ học phí lên Google Sheets...');
    const headers = [
      'Số Biên Lai',
      'Thứ Tự (Seq)',
      'Học Viên',
      'Số Tiền (VND)',
      'Ngày Thu',
      'Hình Thức',
      'Nội Dung',
      'Người Thu',
      'Trạng Thái Hủy',
      'Lý Do Hủy',
      'SHA-256 Hash',
    ];

    const rows = filteredTransactions.map((t) => [
      t.invoiceNumber,
      '',
      t.studentName,
      t.amount,
      t.paymentDate,
      paymentMethodLabel(t.paymentMethod),
      t.period,
      t.collectorName,
      t.isVoided ? 'ĐÃ HỦY' : 'Hợp lệ',
      '',
      t.integrityHash,
    ]);

    const res = await exportToGoogleSheets('Sổ Quỹ Thu Học Phí Hiếu Vũ', headers, rows);
    if (res.success) {
      setExportMsg(`✅ Đã xuất thành công lên Google Sheets! Spreadsheet ID: ${res.spreadsheetId}`);
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
      setExportMsg('Đang xuất sổ quỹ học phí sang file PDF...');

      let filterTitle = '';
      if (filterVoided !== 'ALL') {
        filterTitle += filterVoided === 'ACTIVE' ? 'Biên lai hợp lệ' : 'Biên lai đã hủy';
      }

      // pdfExporter still consumes the legacy TuitionTransaction type; pass
      // it a synthetic projection built from the unified list.
      const syntheticLegacy: TuitionTransaction[] = filteredTransactions.map((t) => ({
        id: t.id,
        invoiceNumber: t.invoiceNumber,
        studentId: '',
        studentName: t.studentName,
        amount: t.amount,
        paymentDate: t.paymentDate,
        paymentMethod: (t.paymentMethod as TuitionTransaction['paymentMethod']),
        period: t.period,
        collectorName: t.collectorName,
        notes: t.notes,
        isVoided: t.isVoided,
        printedAt: t.printedAt,
        sequenceNumber: 0,
        previousHash: '',
        integrityHash: t.integrityHash,
        digitalSignature: '',
      }));
      await exportTuitionListPDF(syntheticLegacy, filterTitle);
      setExportMsg('✅ Đã xuất PDF sổ quỹ thu học phí thành công!');
    } catch (err: any) {
      setExportMsg(`❌ Lỗi khi xuất PDF: ${err.message || 'Không thể tạo file'}`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportAutoTable = async () => {
    try {
      let filterTitle = 'SỔ QUỸ THU HỌC PHÍ & BIÊN LAI';
      if (filterVoided !== 'ALL') {
        filterTitle += filterVoided === 'ACTIVE' ? ' (Biên Lai Hợp Lệ)' : ' (Biên Lai Đã Hủy)';
      }
      const syntheticLegacy: TuitionTransaction[] = filteredTransactions.map((t) => ({
        id: t.id,
        invoiceNumber: t.invoiceNumber,
        studentId: '',
        studentName: t.studentName,
        amount: t.amount,
        paymentDate: t.paymentDate,
        paymentMethod: (t.paymentMethod as TuitionTransaction['paymentMethod']),
        period: t.period,
        collectorName: t.collectorName,
        notes: t.notes,
        isVoided: t.isVoided,
        printedAt: t.printedAt,
        sequenceNumber: 0,
        previousHash: '',
        integrityHash: t.integrityHash,
        digitalSignature: '',
      }));
      await exportTuitionAutoTablePDF(syntheticLegacy, filterTitle);
      setExportMsg('✅ Đã xuất PDF AutoTable thành công!');
    } catch (err: any) {
      setExportMsg(`❌ Lỗi khi xuất PDF AutoTable: ${err.message || 'Lỗi hệ thống'}`);
    }
  };

  const activeTotal = filteredTransactions
    .filter((t) => !t.isVoided)
    .reduce((sum, t) => sum + t.amount, 0);

  // Daily KPIs for header cards
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = transactions.filter((t) => !t.isVoided && t.paymentDate.startsWith(todayStr)).length;
  const monthPrefix = todayStr.slice(0, 7);
  const monthRevenue = transactions
    .filter((t) => !t.isVoided && t.paymentDate.startsWith(monthPrefix))
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Học Phí & Biên Lai</h2>
          <p className="text-slate-400 text-xs mt-1">
            Quản lý biên lai thu học phí, tự động cấp mã tuần tự và bảo vệ vẹn toàn.
          </p>
          {chainStatus && transactions.length > 0 && (
            <div
              className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold border ${chainStatus.isValid
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                }`}
            >
              {chainStatus.isValid ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              )}
              {chainStatus.isValid
                ? `Chuỗi Hash vẹn toàn ${chainStatus.verifiedTransactions}/${chainStatus.totalTransactions} biên lai.`
                : `Chuỗi Hash có vấn đề: ${chainStatus.errorMessage || 'cần kiểm tra lại'}`}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            title="Xuất PDF thiết kế chuẩn bộ nhận diện"
          >
            <FileText className="w-4 h-4 text-red-400" />
            <span>{isExportingPDF ? 'Đang tạo PDF...' : 'Xuất PDF Sổ Quỹ'}</span>
          </button>

          <button
            onClick={handleExportAutoTable}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-2 transition-all"
            title="Xuất nhanh PDF dạng bảng AutoTable (jsPDF & jspdf-autotable)"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Xuất PDF AutoTable</span>
          </button>

          {canExportSheets && (
            <button
              onClick={handleExportSheets}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2 transition-all"
              title="Xuất sổ quỹ sang Google Sheets"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Xuất Google Sheets</span>
            </button>
          )}

          <button
            onClick={() => setIsRecordModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Thu Học Phí Mới</span>
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

      {/* Filter Toolbar & Summary Total */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Tìm Mã BL, Tên Học Viên, Người Thu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={filterVoided}
              onChange={(e) => setFilterVoided(e.target.value as VoidFilter)}
              className="bg-slate-800 text-slate-200 focus:outline-none text-xs font-semibold cursor-pointer"
            >
              <option value="ACTIVE" className="bg-slate-800 text-slate-200">Biên lai hợp lệ</option>
              <option value="VOIDED" className="bg-slate-800 text-slate-200">Biên lai đã hủy</option>
              <option value="ALL" className="bg-slate-800 text-slate-200">Tất cả biên lai</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700 flex items-center gap-3 w-full md:w-auto justify-between">
          <span className="text-xs text-slate-400 font-semibold uppercase">Tổng Doanh Thu Đã Thu:</span>
          <span className="text-lg font-black text-emerald-400">{formatVND(activeTotal)}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Tổng biên lai</div>
          <div className="text-2xl font-extrabold text-white mt-1">{transactions.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">đã phát hành</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] text-emerald-400 uppercase font-bold">Doanh thu tháng này</div>
          <div className="text-2xl font-extrabold text-emerald-300 mt-1">{formatVND(monthRevenue)}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Tháng {monthPrefix}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] text-amber-400 uppercase font-bold">Biên lai hôm nay</div>
          <div className="text-2xl font-extrabold text-amber-300 mt-1">{todayCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{todayStr}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] text-indigo-400 uppercase font-bold">Trạng thái chuỗi Hash</div>
          <div className={`text-2xl font-extrabold mt-1 ${chainStatus?.isValid ? 'text-emerald-300' : 'text-rose-300'}`}>
            {chainStatus ? (chainStatus.isValid ? 'Vẹn toàn' : 'Có lỗi') : '...'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {chainStatus ? `${chainStatus.verifiedTransactions}/${chainStatus.totalTransactions}` : 'đang kiểm tra'}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-700/80">
              <tr>
                <th className="px-4 py-3.5">Mã Biên Lai</th>
                <th className="px-4 py-3.5">Học Viên</th>
                <th className="px-4 py-3.5">Nội Dung Thu</th>
                <th className="px-4 py-3.5">Số Tiền (VND)</th>
                <th className="px-4 py-3.5">Ngày Thu</th>
                <th className="px-4 py-3.5">Hình Thức</th>
                <th className="px-4 py-3.5">Hash Vẹn Toàn</th>
                <th className="px-4 py-3.5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  className={`hover:bg-slate-800/40 transition-all ${tx.isVoided ? 'bg-rose-950/20 text-slate-500' : 'text-slate-200'
                    }`}
                >
                  <td className="px-4 py-3.5 font-mono font-bold text-white">
                    <div className="flex items-center gap-1.5">
                      <span>{tx.invoiceNumber}</span>
                      {tx.isVoided && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/30">
                          ĐÃ HỦY
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3.5 font-bold text-slate-100">{tx.studentName}</td>

                  <td className="px-4 py-3.5 text-slate-300 max-w-[180px] truncate">{tx.period}</td>

                  <td className="px-4 py-3.5 font-black text-emerald-400 text-sm">
                    {formatVND(tx.amount)}
                  </td>

                  <td className="px-4 py-3.5 text-slate-400">{tx.paymentDate}</td>

                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                      {paymentMethodLabel(tx.paymentMethod)}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 font-mono text-[10px] text-indigo-300">
                    <div className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{tx.integrityHash.slice(0, 10)}...</span>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedTxForPrint(tx)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all"
                        title="In Biên Lai"
                      >
                        <Printer className="w-4 h-4 text-emerald-400" />
                      </button>

                      {!tx.isVoided && canVoid && (
                        <button
                          onClick={() => setVoidingTxId(tx.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 transition-all"
                          title="Hủy Biên Lai"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="p-12 text-center text-slate-400">Không tìm thấy biên lai nào phù hợp.</div>
        )}
      </div>

      {/* Void Dialog Modal */}
      {voidingTxId && canVoid && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg text-white">Xác Nhận Hủy Biên Lai</h3>
            <p className="text-xs text-slate-400">
              Vui lòng nhập lý do hủy. Hành động này sẽ được ghi vào nhật ký hệ thống và đồng bộ lên cloud.
            </p>

            <input
              type="text"
              placeholder="Nhập lý do hủy biên lai..."
              value={voidReasonInput}
              onChange={(e) => setVoidReasonInput(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              autoFocus
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setVoidingTxId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={() => handleVoidTx(voidingTxId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30"
              >
                Đồng Ý Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isRecordModalOpen && (
        <RecordPaymentModal
          onClose={() => setIsRecordModalOpen(false)}
          onSuccess={(newPaymentId) => {
            setIsRecordModalOpen(false);
            refreshData();
            // Find the just-created row across both streams so the
            // receipt modal can render the correct data immediately.
            const legacyHit = getTuitionTransactions().find((t) => t.id === newPaymentId);
            const v2Hit = getPayments().find((p) => p.id === newPaymentId);
            if (v2Hit) {
              setSelectedTxForPrint(rowFromV2(v2Hit));
            } else if (legacyHit) {
              setSelectedTxForPrint(rowFromLegacy(legacyHit));
            }
          }}
        />
      )}

      {/* Printable Receipt Modal */}
      {selectedTxForPrint && (
        <ReceiptPrintModal
          receipt={selectedTxForPrint}
          onClose={() => setSelectedTxForPrint(null)}
        />
      )}
    </div>
  );
};
