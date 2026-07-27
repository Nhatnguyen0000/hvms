import React, { useState, useEffect, useMemo } from 'react';
import { Student, PaymentMethod, Invoice, Payment } from '../types';
import {
  getStudents,
  getStudentTuitionSummary,
  getInvoices,
  getInvoice,
  recordPayment,
  recordPaymentV2,
} from '../lib/storage';
import { formatVND, numberToVietnameseWords } from '../lib/currencyHelper';
import { useToast } from './Toast';
import { X, DollarSign, Check, CheckCircle2, AlertTriangle } from 'lucide-react';

interface RecordPaymentModalProps {
  initialStudent?: Student | null;
  initialInvoiceId?: string | null;
  onClose: () => void;
  /** Returns the ID of the new payment so the caller can open the receipt. */
  onSuccess: (newPaymentId: string) => void;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  Cash: 'Tiền mặt',
  Transfer: 'Chuyển khoản',
};

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  initialStudent,
  initialInvoiceId,
  onClose,
  onSuccess,
}) => {
  const students = getStudents();
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudent ? initialStudent.id : students[0]?.id || ''
  );

  const [pickedInvoiceId, setPickedInvoiceId] = useState<string>(initialInvoiceId || '');
  const toast = useToast();

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const tuitionSummary = selectedStudentId
    ? getStudentTuitionSummary(selectedStudentId)
    : { totalExpectedFee: 0, totalPaid: 0, remainingAmount: 0, courseBreakdown: [] };

  const studentInvoices: Invoice[] = useMemo(() => {
    if (!selectedStudentId) return [];
    return getInvoices().filter(
      (i) => i.studentId === selectedStudentId && i.status !== 'Voided' && i.paidAmount < i.totalAmount
    );
  }, [selectedStudentId]);

  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [period, setPeriod] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [allowOver, setAllowOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-fill from invoice pick
  useEffect(() => {
    if (pickedInvoiceId) {
      const inv = getInvoice(pickedInvoiceId);
      if (inv) {
        setAmount(inv.totalAmount - inv.paidAmount);
        setPeriod(inv.periodLabel);
        setNotes(`Thanh toán hoá đơn ${inv.invoiceNumber}`);
      }
    }
  }, [pickedInvoiceId]);

  // Auto-fill from student when no invoice picked
  useEffect(() => {
    if (pickedInvoiceId) return;
    if (selectedStudentId) {
      const summary = getStudentTuitionSummary(selectedStudentId);
      setAmount(summary.remainingAmount > 0 ? summary.remainingAmount : 0);
      if (summary.courseBreakdown.length > 0) {
        setPeriod(`Học phí ${summary.courseBreakdown.map((c) => c.className).join(' + ')}`);
      }
    }
  }, [selectedStudentId, pickedInvoiceId]);

  const fullyPaid = tuitionSummary.remainingAmount <= 0;
  const exceedsRemaining = amount > tuitionSummary.remainingAmount + 1 && !allowOver;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!selectedStudent) {
      setErrorMsg('Vui lòng chọn học viên');
      return;
    }
    if (amount <= 0) {
      setErrorMsg('Số tiền nộp phải lớn hơn 0');
      return;
    }
    if (!period.trim()) {
      setErrorMsg('Vui lòng nhập nội dung thu');
      return;
    }

    setIsSubmitting(true);
    try {
      let resultId = '';
      if (pickedInvoiceId) {
        const res = await recordPaymentV2({
          invoiceId: pickedInvoiceId,
          studentId: selectedStudent.id,
          studentName: selectedStudent.fullName,
          amount,
          paymentMethod,
          notes,
          allowOverPayment: allowOver,
        });
        resultId = res.payment.id;
      } else {
        const tx = await recordPayment({
          studentId: selectedStudent.id,
          studentName: selectedStudent.fullName,
          amount,
          paymentMethod,
          period,
          notes,
        });
        resultId = tx.id;
      }

      onSuccess(resultId);
      toast.success(`Đã thu ${amount.toLocaleString('vi-VN')}đ từ ${selectedStudent.fullName}.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể lập biên lai');
      toast.error(err.message || 'Không thể lập biên lai', 'Lỗi thu học phí');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#141414] border border-[#b48648]/30 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#141414] via-[#1c1710] to-[#141414] px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#b48648]/20 text-[#b48648] flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Thu Học Phí & Lập Biên Lai</h3>
              <p className="text-xs text-slate-400">Tiền mặt hoặc chuyển khoản · In biên lai ngay</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-0">
          {/* Left: invoice summary */}
          <div className="lg:col-span-2 p-6 bg-slate-900/40 border-r border-white/10 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase">Học viên</label>
              <select
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  setPickedInvoiceId('');
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-800 text-slate-200">
                    {s.code} - {s.fullName}
                  </option>
                ))}
              </select>
            </div>

            {studentInvoices.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">
                  Hoặc chọn hoá đơn (nếu có)
                </label>
                <select
                  value={pickedInvoiceId}
                  onChange={(e) => setPickedInvoiceId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="" className="bg-slate-800 text-slate-200">-- Thu nhanh (không theo hoá đơn) --</option>
                  {studentInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id} className="bg-slate-800 text-slate-200">
                      {inv.invoiceNumber} - {inv.periodLabel} - còn {(inv.totalAmount - inv.paidAmount).toLocaleString('vi-VN')}đ
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="rounded-2xl border border-slate-700 p-4 bg-slate-950/60 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Tổng học phí kỳ này</span>
                <span className="font-bold text-white">
                  {formatVND(tuitionSummary.totalExpectedFee)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Đã thanh toán</span>
                <span className="font-bold text-emerald-400">
                  {formatVND(tuitionSummary.totalPaid)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-2">
                <span className="text-slate-400 font-bold">Còn nợ</span>
                <span className={`font-extrabold ${fullyPaid ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatVND(Math.max(0, tuitionSummary.remainingAmount))}
                </span>
              </div>
              {fullyPaid && (
                <div className="flex items-center gap-2 text-emerald-300 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Học viên đã đóng đủ. Tick "Cho phép nộp dư" nếu muốn ghi nhận thêm.</span>
                </div>
              )}
            </div>

            {tuitionSummary.courseBreakdown.length > 0 && (
              <div className="rounded-2xl border border-slate-700 p-3 bg-slate-950/40 space-y-1 text-xs">
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Học phí chi tiết
                </div>
                {tuitionSummary.courseBreakdown.map((c, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-300">
                      {c.courseName} · {c.className}
                    </span>
                    <span className="text-amber-300 font-mono">{formatVND(c.fee)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: payment form */}
          <div className="lg:col-span-3 p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Số tiền thu (VND)</label>
                <input
                  type="number"
                  value={amount}
                  min={1000}
                  step={1000}
                  onChange={(e) => setAmount(parseInt(e.target.value || '0', 10))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-lg font-extrabold text-amber-300"
                />
                {exceedsRemaining && (
                  <div className="flex items-center gap-2 text-amber-300 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Số tiền vượt số còn nợ {(amount - tuitionSummary.remainingAmount).toLocaleString('vi-VN')}đ.</span>
                  </div>
                )}
                {amount > 0 && (
                  <div className="text-xs text-slate-400 italic">
                    Bằng chữ: <span className="text-slate-200">{numberToVietnameseWords(amount)} đồng</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 col-span-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Phương thức thanh toán</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                >
                  {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m} className="bg-slate-800 text-slate-200">
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 col-span-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Nội dung thu</label>
                <input
                  type="text"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="VD: Học phí Tháng 7/2026"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Ghi chú</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi chú thêm (không bắt buộc)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <label className="col-span-2 flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowOver}
                  onChange={(e) => setAllowOver(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>Cho phép nộp dư (credit) — tắt nếu muốn hệ thống chặn.</span>
              </label>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (exceedsRemaining && !allowOver)}
                className="px-5 py-2 rounded-xl bg-[#b48648] hover:bg-amber-600 text-black font-bold text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <Check className="w-4 h-4" />
                {isSubmitting ? 'Đang lưu…' : 'Lưu & In biên lai'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};