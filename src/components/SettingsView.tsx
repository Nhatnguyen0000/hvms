import React, { useState, useEffect } from 'react';
import { MBBankConfig, CenterSettings, BillingPolicy } from '../types';
import {
  getMBBankConfig,
  saveMBBankConfig,
  normalizeVietQRName,
  getCenterSettings,
  saveCenterSettings,
} from '../lib/mbBankConfig';
import { generateVietQRPayload } from '../lib/vietqr';
import { generateQRDataURL } from '../lib/qrCodeGenerator';
import { getCourses, saveCourse } from '../lib/storage';
import { Building2, Banknote, GraduationCap, ShieldCheck, Save, RefreshCcw } from 'lucide-react';

type SettingsTab = 'center' | 'bank' | 'tuition' | 'security';

export const SettingsView: React.FC = () => {
  const [tab, setTab] = useState<SettingsTab>('bank');

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Cài Đặt Hệ Thống</h2>
            <p className="text-slate-400 text-xs mt-1">
              Trung tâm · Ngân hàng MB · Bảng giá · Bảo mật
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <TabBtn active={tab === 'bank'} onClick={() => setTab('bank')} icon={<Banknote className="w-4 h-4" />}>
            Ngân hàng MB
          </TabBtn>
          <TabBtn active={tab === 'center'} onClick={() => setTab('center')} icon={<Building2 className="w-4 h-4" />}>
            Trung tâm
          </TabBtn>
          <TabBtn active={tab === 'tuition'} onClick={() => setTab('tuition')} icon={<GraduationCap className="w-4 h-4" />}>
            Học phí
          </TabBtn>
          <TabBtn active={tab === 'security'} onClick={() => setTab('security')} icon={<ShieldCheck className="w-4 h-4" />}>
            Bảo mật
          </TabBtn>
        </div>
      </div>

      {tab === 'bank' && <MBBankSettingsCard />}
      {tab === 'center' && <CenterSettingsCard />}
      {tab === 'tuition' && <TuitionConfigCard />}
      {tab === 'security' && <SecurityCard />}
    </div>
  );
};

function TabBtn({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all ${
        active
          ? 'bg-[#b48648] text-black border-[#b48648]'
          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
      }`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

// =====================================================================
// MB Bank Settings
// =====================================================================

function MBBankSettingsCard() {
  const initial = getMBBankConfig();
  const [cfg, setCfg] = useState<MBBankConfig>(initial);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTestQR = async () => {
    setError(null);
    if (!cfg.accountNumber) {
      setError('Vui lòng nhập STK trước khi test QR');
      return;
    }
    try {
      const payload = generateVietQRPayload({
        bankBin: cfg.bin,
        accountNumber: cfg.accountNumber,
        accountName: cfg.accountName,
        amount: 100000,
        addInfo: 'ALLEGRO TEST QR',
        template: cfg.template,
      });
      const dataUrl = await generateQRDataURL(payload, { size: 220, margin: 1 });
      setQrUrl(dataUrl);
    } catch (err: any) {
      setError(err.message || 'Lỗi tạo QR');
    }
  };

  const handleSave = () => {
    setError(null);
    if (!/^[0-9]{10,16}$/.test(cfg.accountNumber)) {
      setError('STK phải là 10-16 chữ số');
      return;
    }
    saveMBBankConfig({
      ...cfg,
      accountName: normalizeVietQRName(cfg.accountName),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h3 className="font-bold text-lg text-white flex items-center gap-2 mb-1">
        <Banknote className="w-5 h-5 text-emerald-400" />
        Cấu hình Ngân hàng MB (VietQR)
      </h3>
      <p className="text-xs text-slate-400 mb-5">
        STK + tên tài khoản dùng để sinh QR VietQR động khi thu học phí. Khách quét QR sẽ tự điền STK + số tiền + nội dung vào app ngân hàng.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase">Số tài khoản</label>
          <input
            type="text"
            value={cfg.accountNumber}
            onChange={(e) => setCfg({ ...cfg, accountNumber: e.target.value.replace(/\D/g, '') })}
            placeholder="0123456789"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase">Chủ tài khoản (không dấu)</label>
          <input
            type="text"
            value={cfg.accountName}
            onChange={(e) => setCfg({ ...cfg, accountName: e.target.value })}
            placeholder="TRUNG TAM AM NHAC ALLEGRO"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm uppercase text-white"
          />
          <div className="text-[10px] text-slate-500 italic">
            Tự động chuẩn hoá thành IN HOA không dấu khi lưu (chuẩn VietQR).
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase">BIN ngân hàng</label>
          <input
            type="text"
            value={cfg.bin}
            readOnly
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-slate-400"
          />
          <div className="text-[10px] text-slate-500 italic">MB Bank = 970422 (NAPAS IBFT v2).</div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase">Template</label>
          <select
            value={cfg.template}
            onChange={(e) => setCfg({ ...cfg, template: e.target.value as MBBankConfig['template'] })}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
          >
            <option value="compact">compact (ít trường)</option>
            <option value="compact2">compact2 (khuyến nghị)</option>
            <option value="qr">qr (đầy đủ)</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-5">
        <button
          onClick={handleTestQR}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 flex items-center gap-2"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          Tạo QR Test (100.000đ)
        </button>
        <button
          onClick={handleSave}
          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2"
        >
          <Save className="w-3.5 h-3.5" />
          {saved ? 'Đã lưu ✓' : 'Lưu cấu hình'}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
          {error}
        </div>
      )}

      {qrUrl && (
        <div className="mt-5 p-4 rounded-2xl border border-emerald-500/40 bg-emerald-950/20 flex items-center gap-4">
          <img src={qrUrl} alt="QR test" className="w-32 h-32 rounded-lg bg-white p-1" />
          <div className="text-xs space-y-1">
            <div className="text-emerald-300 font-bold">QR test 100.000đ đã sẵn sàng</div>
            <div className="text-slate-300">
              Quét bằng app MBBank / Vietcombank / bất kỳ app ngân hàng Việt Nam để kiểm tra STK + số tiền + nội dung đã đúng chưa.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Center Settings
// =====================================================================

function CenterSettingsCard() {
  const [cfg, setCfg] = useState<CenterSettings>(getCenterSettings());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveCenterSettings(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h3 className="font-bold text-lg text-white flex items-center gap-2 mb-1">
        <Building2 className="w-5 h-5 text-indigo-400" />
        Thông tin trung tâm
      </h3>
      <p className="text-xs text-slate-400 mb-5">Hiển thị trên biên lai & sổ quỹ PDF.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Tên trung tâm">
          <input
            type="text"
            value={cfg.centerName}
            onChange={(e) => setCfg({ ...cfg, centerName: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
          />
        </Field>
        <Field label="Số điện thoại">
          <input
            type="text"
            value={cfg.centerPhone}
            onChange={(e) => setCfg({ ...cfg, centerPhone: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
          />
        </Field>
        <Field label="Địa chỉ">
          <input
            type="text"
            value={cfg.centerAddress}
            onChange={(e) => setCfg({ ...cfg, centerAddress: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
          />
        </Field>
        <Field label="Mã số thuế">
          <input
            type="text"
            value={cfg.centerTaxCode}
            onChange={(e) => setCfg({ ...cfg, centerTaxCode: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
          />
        </Field>
        <Field label="Footer biên lai" full>
          <textarea
            rows={2}
            value={cfg.receiptFooter}
            onChange={(e) => setCfg({ ...cfg, receiptFooter: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
          />
        </Field>
      </div>

      <button
        onClick={handleSave}
        className="mt-5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2"
      >
        <Save className="w-3.5 h-3.5" />
        {saved ? 'Đã lưu ✓' : 'Lưu'}
      </button>
    </div>
  );
}

// =====================================================================
// Tuition Config (bảng giá + policy)
// =====================================================================

function TuitionConfigCard() {
  const courses = getCourses();
  const [policy, setPolicy] = useState<BillingPolicy>(getCenterSettings().billingPolicy);
  const [drafts, setDrafts] = useState(
    courses.map((c) => ({ ...c }))
  );
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    saveCenterSettings({ ...getCenterSettings(), billingPolicy: policy });
    for (const c of drafts) {
      await saveCourse(c);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h3 className="font-bold text-lg text-white flex items-center gap-2 mb-1">
        <GraduationCap className="w-5 h-5 text-amber-400" />
        Bảng giá học phí
      </h3>
      <p className="text-xs text-slate-400 mb-5">
        Đơn giá / buổi = referenceFee ÷ totalSessions. Học phí tháng = referenceFee.
      </p>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 uppercase text-[10px]">
            <th className="px-2 py-2 text-left">Khóa</th>
            <th className="px-2 py-2 text-left">Mã</th>
            <th className="px-2 py-2 text-right">Học phí tháng</th>
            <th className="px-2 py-2 text-right">Số buổi/tháng</th>
            <th className="px-2 py-2 text-right">Đơn giá/buổi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {drafts.map((c, idx) => {
            const unit = c.totalSessions > 0 ? Math.round(c.referenceFee / c.totalSessions) : 0;
            return (
              <tr key={c.id}>
                <td className="px-2 py-2 text-white font-bold">{c.name}</td>
                <td className="px-2 py-2 font-mono text-slate-300">{c.code}</td>
                <td className="px-2 py-2 text-right">
                  <input
                    type="number"
                    value={c.referenceFee}
                    onChange={(e) => {
                      const v = parseInt(e.target.value || '0', 10);
                      setDrafts((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], referenceFee: v };
                        return next;
                      });
                    }}
                    className="w-28 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right font-mono text-amber-300"
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <input
                    type="number"
                    value={c.totalSessions}
                    onChange={(e) => {
                      const v = parseInt(e.target.value || '0', 10);
                      setDrafts((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], totalSessions: v };
                        return next;
                      });
                    }}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right font-mono text-white"
                  />
                </td>
                <td className="px-2 py-2 text-right font-mono text-slate-300">{unit.toLocaleString('vi-VN')}đ</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Vắng có phép (Excused)">
          <select
            value={policy.excusedAbsence}
            onChange={(e) =>
              setPolicy({ ...policy, excusedAbsence: e.target.value as BillingPolicy['excusedAbsence'] })
            }
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
          >
            <option value="count">Vẫn tính tiền</option>
            <option value="donot_count">Không tính tiền (hiếm)</option>
          </select>
        </Field>
        <Field label="Vắng không phép (Unexcused)">
          <select
            value={policy.unexcusedAbsence}
            onChange={(e) =>
              setPolicy({ ...policy, unexcusedAbsence: e.target.value as BillingPolicy['unexcusedAbsence'] })
            }
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
          >
            <option value="donot_deduct">Không trừ tiền (mặc định)</option>
            <option value="deduct">Trừ tiền buổi vắng</option>
          </select>
        </Field>
      </div>

      <button
        onClick={handleSave}
        className="mt-5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2"
      >
        <Save className="w-3.5 h-3.5" />
        {saved ? 'Đã lưu ✓' : 'Lưu bảng giá + chính sách'}
      </button>
    </div>
  );
}

// =====================================================================
// Security Card
// =====================================================================

function SecurityCard() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
      <h3 className="font-bold text-lg text-white flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        Bảo mật
      </h3>
      <p className="text-xs text-slate-400">
        Tất cả biên lai được ký số bằng HMAC-SHA-256 với secret lưu trong{' '}
        <code className="text-amber-300">VITE_HMAC_SECRET</code>. Chuỗi hash SHA-256 đảm bảo bất kỳ sửa đổi nào
        trên biên lai đều bị phát hiện.
      </p>
      <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-700 text-xs space-y-1 font-mono text-slate-300">
        <div>· Mỗi biên lai có <b>integrityHash</b> (SHA-256) và <b>digitalSignature</b> (HMAC).</div>
        <div>· Mỗi biên lai liên kết với biên lai trước qua <b>previousHash</b>.</div>
        <div>· Sổ quỹ có nút "Kiểm tra chuỗi Hash" để verify toàn bộ chain.</div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1 ${full ? 'md:col-span-2' : ''}`}>
      <label className="text-xs font-bold text-slate-300 uppercase">{label}</label>
      {children}
    </div>
  );
}