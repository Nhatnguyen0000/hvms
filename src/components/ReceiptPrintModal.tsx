import React, { useState, useRef, useEffect } from 'react';
import { formatVND, numberToVietnameseWords } from '../lib/currencyHelper';
import { markPrinted } from '../lib/storage';
import { exportReceiptPDF } from '../lib/pdfExporter';
import { getCenterSettings, getMBBankConfig } from '../lib/mbBankConfig';
import { generateVietQRPayload } from '../lib/vietqr';
import { generateQRDataURL } from '../lib/qrCodeGenerator';
import { useToast } from './Toast';
import { Printer, X, Download } from 'lucide-react';

interface ReceiptLike {
  id: string;
  invoiceNumber: string;
  studentName: string;
  period: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  collectorName: string;
  isVoided: boolean;
  integrityHash: string;
  digitalSignature?: string;
  sequenceNumber?: number;
  notes?: string;
  printedAt?: string;
}

interface ReceiptPrintModalProps {
  receipt: ReceiptLike;
  onClose: () => void;
}

function methodLabel(m: string): string {
  switch (m) {
    case 'Cash':
      return 'Tiền mặt';
    case 'Transfer':
      return 'Chuyển khoản';
    default:
      return m;
  }
}

const SIGNER_NAME = 'VŨ TRUNG HIẾU';
const LOGO_URL = '/HieuVu_Logo.png';

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  receipt,
  onClose,
}) => {
  const [printFormat, setPrintFormat] = useState<'A5' | 'A6' | 'K80'>('A5');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const receiptCardRef = useRef<HTMLDivElement>(null);

  const settings = getCenterSettings();
  const bankConfig = getMBBankConfig();
  const toast = useToast();

  const hasBankInfo = receipt.paymentMethod === 'Transfer' && Boolean(bankConfig.accountNumber);

  useEffect(() => {
    if (hasBankInfo) {
      try {
        const payload = generateVietQRPayload({
          bankBin: bankConfig.bin || '970422',
          accountNumber: bankConfig.accountNumber,
          accountName: bankConfig.accountName,
          amount: receipt.amount,
          addInfo: receipt.invoiceNumber,
          template: bankConfig.template || 'compact2',
        });
        generateQRDataURL(payload, { size: 160, margin: 1 }).then(setQrDataUrl).catch(() => {});
      } catch {
        // ignore
      }
    }
  }, [receipt.amount, receipt.invoiceNumber, receipt.paymentMethod, bankConfig, hasBankInfo]);

  const handlePrint = () => {
    void markPrinted(receipt.id);
    toast.success(`Đã gửi biên lai ${receipt.invoiceNumber} tới máy in.`);
    window.print();
  };

  const handleExportPDF = async () => {
    if (!receiptCardRef.current) return;
    try {
      setIsExportingPDF(true);
      await markPrinted(receipt.id);
      await exportReceiptPDF(receiptCardRef.current, receipt.invoiceNumber);
      toast.success(`Đã xuất file PDF biên lai ${receipt.invoiceNumber}.`);
    } catch (err: any) {
      toast.error(`Không thể xuất PDF biên lai: ${err.message || 'Lỗi không xác định'}`, 'Lỗi xuất PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleClose = () => {
    toast.info('Đã đóng cửa sổ biên lai.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-6">
        {/* Modal Toolbar (Screen Only) */}
        <div className="print:hidden bg-slate-800/80 px-6 py-4 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">Xem & In Biên Lai Thu Học Phí</h3>
              <p className="text-xs text-slate-400">Số Biên Lai: {receipt.invoiceNumber}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-900 p-1 rounded-xl border border-slate-700 flex text-xs">
              {(['A5', 'A6', 'K80'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setPrintFormat(fmt)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    printFormat === fmt ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {fmt === 'A5' ? 'A5' : fmt === 'A6' ? 'A6' : 'K80'}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-white" />
              <span>{isExportingPDF ? 'Đang tạo PDF...' : 'Xuất PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>In</span>
            </button>

            <button onClick={handleClose} className="p-2 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area — only this card is rendered when the user clicks Print.
            The CSS @media print rule hides everything else so the printer only
            outputs the biên lai exactly as it appears on screen. */}
        <div className="p-6 bg-slate-950 flex justify-center max-h-[75vh] overflow-y-auto print:max-h-none print:p-0 print:bg-white print:overflow-visible">
          <div ref={receiptCardRef} className="print-area flex justify-center w-full">
            {/* A5 */}
            {printFormat === 'A5' && (
              <div className="bg-white text-slate-900 p-8 rounded-xl shadow-2xl w-full max-w-[650px] font-sans border border-slate-200 print:shadow-none print:border-none print:w-full relative">
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-amber-600/60 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={LOGO_URL}
                      alt="Logo Hiếu Vũ Music"
                      className="w-16 h-16 object-contain"
                    />
                    <div>
                      <h2 className="font-extrabold text-base uppercase text-slate-900 tracking-tight">
                        {settings.centerName || 'TRUNG TÂM ÂM NHẠC HIẾU VŨ'}
                      </h2>
                      {settings.centerAddress && <p className="text-[11px] text-slate-600">{settings.centerAddress}</p>}
                      <p className="text-[11px] text-slate-600">
                        Hotline: {settings.centerPhone || '—'}
                        {settings.centerTaxCode ? ` · MST: ${settings.centerTaxCode}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-800">Mẫu số: 01-TT/HV</div>
                    <div className="text-sm font-black text-amber-700 font-mono mt-1">
                      {receipt.invoiceNumber}
                    </div>
                    <div className="text-[10px] text-slate-500">Ngày: {receipt.paymentDate}</div>
                  </div>
                </div>

                <div className="text-center my-5">
                  <h1 className="text-2xl font-black uppercase text-slate-900 tracking-wider">
                    BIÊN LAI THU HỌC PHÍ
                  </h1>
                  <p className="text-xs italic text-slate-600 mt-0.5">
                    Liên 1: Trả học viên · Liên 2: Lưu trung tâm · Liên 3: Kế toán
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="w-40 text-slate-600">Họ tên học viên:</span>
                    <span className="font-bold text-slate-900 uppercase text-base flex-1">
                      {receipt.studentName}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-slate-600">Nội dung thu:</span>
                    <span className="font-semibold text-slate-800 flex-1">{receipt.period}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-slate-600">Hình thức:</span>
                    <span className="font-medium text-slate-800 flex-1">{methodLabel(receipt.paymentMethod)}</span>
                  </div>
                  {receipt.notes && (
                    <div className="flex">
                      <span className="w-40 text-slate-600">Ghi chú:</span>
                      <span className="text-slate-700 italic flex-1">{receipt.notes}</span>
                    </div>
                  )}

                  <div className="my-4 p-4 bg-amber-50 rounded-xl border border-amber-300 flex items-center justify-between">
                    <span className="font-bold text-slate-800 uppercase">Số tiền đã thu:</span>
                    <span className="text-2xl font-black text-indigo-950 font-mono">
                      {formatVND(receipt.amount)}
                    </span>
                  </div>

                  <div className="text-xs italic text-slate-700">
                    <span className="font-bold">Bằng chữ:</span> {numberToVietnameseWords(receipt.amount)} đồng.
                  </div>

                  {hasBankInfo && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-800 text-[11px] uppercase">Thông Tin Chuyển Khoản</div>
                        <div className="text-slate-700">Ngân hàng: <b>{bankConfig.bankName}</b> ({bankConfig.bankCode})</div>
                        <div className="text-slate-700">STK: <b className="font-mono text-indigo-950">{bankConfig.accountNumber}</b></div>
                        <div className="text-slate-700">Chủ TK: <b>{bankConfig.accountName}</b></div>
                      </div>
                      {qrDataUrl && (
                        <img src={qrDataUrl} alt="VietQR" className="w-20 h-20 rounded border border-slate-300 bg-white p-1" />
                      )}
                    </div>
                  )}
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 text-center mt-8 pt-4 border-t border-slate-300 text-xs">
                  <div>
                    <div className="font-bold uppercase text-slate-800">Người Nộp Tiền</div>
                    <div className="text-[10px] text-slate-500 italic mb-12">(Ký và ghi rõ họ tên)</div>
                    <div className="font-bold text-slate-800">{receipt.studentName}</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-slate-800">Chủ Trung Tâm</div>
                    <div className="text-[10px] text-slate-500 italic mb-12">(Ký và đóng dấu)</div>
                    <div className="font-extrabold text-slate-900 uppercase">{SIGNER_NAME}</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-6 pt-3 border-t border-slate-200 text-[9px] text-slate-500 flex flex-col gap-1 font-mono">
                  <div>Mã chứng từ: {receipt.id}</div>
                  {settings.receiptFooter && (
                    <div className="italic text-slate-600 font-sans">{settings.receiptFooter}</div>
                  )}
                </div>
                {receipt.isVoided && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-rose-600 text-7xl font-black opacity-30 rotate-[-20deg] border-4 border-rose-600 px-6 py-3 rounded-2xl">
                      VOID
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* A6 */}
            {printFormat === 'A6' && (
              <div className="bg-white text-slate-900 p-6 rounded-xl shadow-2xl w-full max-w-[450px] font-sans border border-slate-200 print:shadow-none print:border-none relative">
                <div className="flex items-center gap-2 border-b border-amber-600/60 pb-3 mb-3">
                  <img src={LOGO_URL} alt="Logo" className="w-12 h-12 object-contain" />
                  <div>
                    <h2 className="font-extrabold text-sm uppercase">{settings.centerName}</h2>
                    {settings.centerPhone && <p className="text-[10px] text-slate-600">Hotline: {settings.centerPhone}</p>}
                  </div>
                </div>
                <div className="text-center mb-4">
                  <h1 className="text-lg font-black uppercase">BIÊN LAI THU HỌC PHÍ</h1>
                  <div className="text-xs font-mono font-bold text-amber-700 mt-1">{receipt.invoiceNumber}</div>
                  <div className="text-[10px] text-slate-500">{receipt.paymentDate}</div>
                </div>
                <div className="space-y-1 text-xs">
                  <div><span className="text-slate-600">HV:</span> <b>{receipt.studentName}</b></div>
                  <div><span className="text-slate-600">Nội dung:</span> {receipt.period}</div>
                  <div><span className="text-slate-600">PTTT:</span> {methodLabel(receipt.paymentMethod)}</div>
                  <div className="my-3 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between">
                    <span className="font-bold uppercase">Tổng:</span>
                    <span className="text-xl font-black text-indigo-950 font-mono">{formatVND(receipt.amount)}</span>
                  </div>
                  <div className="italic text-[10px]">{numberToVietnameseWords(receipt.amount)} đồng.</div>
                </div>
                <div className="text-center mt-4 pt-3 border-t border-slate-200 text-xs">
                  <div className="font-extrabold uppercase">{SIGNER_NAME}</div>
                  <div className="text-[9px] text-slate-500 italic">Chủ trung tâm · Ký và đóng dấu</div>
                </div>
              </div>
            )}

            {/* K80 thermal */}
            {printFormat === 'K80' && (
              <div className="bg-white text-slate-900 p-4 rounded-xl shadow-2xl w-[320px] font-mono text-xs border border-slate-200 print:shadow-none print:border-none print:w-[80mm] relative">
                <div className="flex items-center gap-2 pb-2 border-b border-dashed border-slate-400">
                  <img src={LOGO_URL} alt="Logo" className="w-10 h-10 object-contain" />
                  <div>
                    <h2 className="font-black text-sm uppercase">{settings.centerName}</h2>
                    {settings.centerPhone && <p className="text-[10px]">ĐT: {settings.centerPhone}</p>}
                  </div>
                </div>
                <div className="text-center py-2 space-y-1 border-b border-dashed border-slate-400">
                  <div className="font-bold text-sm">BIÊN LAI THU HỌC PHÍ</div>
                  <div className="text-[10px]">Số: {receipt.invoiceNumber}</div>
                  <div className="text-[10px]">{receipt.paymentDate}</div>
                </div>
                <div className="py-3 space-y-2 border-b border-dashed border-slate-400">
                  <div>
                    <span className="text-slate-600 block">Học viên:</span>
                    <span className="font-bold text-sm uppercase">{receipt.studentName}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">Nội dung:</span>
                    <span>{receipt.period}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">PTTT:</span>
                    <span>{methodLabel(receipt.paymentMethod)}</span>
                  </div>
                </div>
                <div className="py-3 text-center space-y-1 border-b border-dashed border-slate-400">
                  <div className="text-[10px] uppercase text-slate-600">Thành Tiền:</div>
                  <div className="text-xl font-black">{formatVND(receipt.amount)}</div>
                  <div className="text-[9px] italic">{numberToVietnameseWords(receipt.amount)} đồng</div>
                </div>
                <div className="pt-3 text-center text-[10px] space-y-1">
                  <div className="font-extrabold uppercase">{SIGNER_NAME}</div>
                  <div className="text-[9px] text-slate-500 italic">Chủ trung tâm</div>
                  {settings.receiptFooter && (
                    <div className="text-[9px] italic text-slate-600">{settings.receiptFooter}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};