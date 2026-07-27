import React, { useState, useEffect } from 'react';
import { Student } from '../types';
import { getClassGroups } from '../lib/storage';
import { getCenterSettings } from '../lib/mbBankConfig';
import { generateQRDataURL } from '../lib/qrCodeGenerator';
import { printStudentCardDirectly } from '../lib/pdfExporter';
import { useToast } from './Toast';
import { QrCode, Printer, X } from 'lucide-react';

interface StudentCardModalProps {
  student: Student;
  onClose: () => void;
}

const LOGO_URL = '/HieuVu_Logo.png';
const OWNER_NAME = 'VŨ TRUNG HIẾU';

export const buildStudentQRPayload = (student: Student): string =>
  `ALLEGRO_STUDENT_V1:${student.id}:${student.code}`;

export const formatJoinDate = (raw: string | undefined): string => {
  if (!raw) return '—';
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return raw;
};

export const StudentCardModal: React.FC<StudentCardModalProps> = ({ student, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const toast = useToast();
  const settings = getCenterSettings();
  const classGroups = getClassGroups();
  const enrolledClasses = classGroups.filter((c) => student.enrolledClassIds.includes(c.id));

  const specialization =
    enrolledClasses.length > 0
      ? enrolledClasses.map((c) => c.name).join(' · ')
      : 'Bộ Môn Piano / Organ / Guitar';

  const joinDateDisplay = formatJoinDate(student.joinDate);

  useEffect(() => {
    let active = true;
    generateQRDataURL(buildStudentQRPayload(student), {
      size: 320,
      margin: 1,
      darkColor: '#0f172a',
      lightColor: '#ffffff',
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [student]);

  const handlePrint = async () => {
    await printStudentCardDirectly({
      student,
      qrDataUrl,
      specialization,
      joinDateDisplay,
      centerName: settings.centerName || 'TRUNG TÂM ÂM NHẠC HIẾU VŨ',
      centerPhone: settings.centerPhone || '0852393992',
      centerAddress: settings.centerAddress || '',
      ownerName: OWNER_NAME,
      logoUrl: LOGO_URL,
    });
    toast.success(`Đã mở giao diện in Thẻ Học Viên cho ${student.fullName}.`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-6 print:border-none print:shadow-none print:my-0 print:w-auto">

        {/* Toolbar (Hidden when printing) */}
        <div className="print:hidden bg-slate-800/80 px-6 py-4 border-b border-slate-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Thẻ Học Viên Điện Tử</h3>
              <p className="text-xs text-slate-400">Mã HV: {student.code} · {student.fullName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>In Thẻ / Lưu PDF</span>
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Card Display Area */}
        <div className="p-8 bg-slate-950 flex justify-center print:p-0 print:bg-transparent">
          <div className="print-area">
            <StudentCard
              student={student}
              qrDataUrl={qrDataUrl}
              specialization={specialization}
              joinDateDisplay={joinDateDisplay}
              centerName={settings.centerName || 'TRUNG TÂM ÂM NHẠC HIẾU VŨ'}
              centerPhone={settings.centerPhone || '0852393992'}
              centerAddress={settings.centerAddress}
              ownerName={OWNER_NAME}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const StudentCard: React.FC<{
  student: Student;
  qrDataUrl: string | null;
  specialization: string;
  joinDateDisplay: string;
  centerName: string;
  centerPhone: string;
  centerAddress?: string;
  ownerName: string;
}> = ({
  student, qrDataUrl, specialization, joinDateDisplay,
  centerName, centerPhone, centerAddress, ownerName,
}) => (
  <div
    style={{
      width: '560px',
      backgroundColor: '#000000',
      color: '#ffffff',
      borderRadius: '20px',
      border: '2px solid rgba(245, 158, 11, 0.8)',
      boxSizing: 'border-box',
      fontFamily: "'Be Vietnam Pro', 'Segoe UI', Roboto, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
    }}
  >
    {/* Top Gold Stripe */}
    <div style={{ height: '5px', background: 'linear-gradient(90deg, #92400e, #f59e0b, #fcd34d, #f59e0b, #92400e)', flexShrink: 0 }} />

    <div style={{ padding: '22px 26px 18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(245, 158, 11, 0.3)', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <img src={LOGO_URL} alt="Logo" style={{ width: '44px', height: '44px', objectFit: 'contain', display: 'block', flexShrink: 0 }} />
          <div style={{ fontSize: '13px', fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.4, padding: '2px 0' }}>
            {centerName}
          </div>
        </div>
        <span style={{
          fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px',
          padding: '4px 12px', borderRadius: '999px',
          backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d',
          border: '1px solid rgba(245, 158, 11, 0.45)', lineHeight: 1, flexShrink: 0,
        }}>
          STUDENT CARD
        </span>
      </div>

      {/* Main Body: Info Left + QR Right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
        
        {/* Left Side: Student Info */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {/* Mã HV Badge */}
          <div style={{
            display: 'inline-block', alignSelf: 'flex-start',
            fontFamily: 'monospace', fontSize: '11px', fontWeight: 700,
            color: '#fcd34d', backgroundColor: 'rgba(245, 158, 11, 0.15)',
            padding: '3px 10px', borderRadius: '5px', border: '1px solid rgba(245, 158, 11, 0.35)',
            letterSpacing: '0.5px', lineHeight: 1.3,
          }}>
            MÃ HV: {student.code}
          </div>

          {/* Student Full Name */}
          <div>
            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.8px', marginBottom: '2px' }}>
              HỌ VÀ TÊN HỌC VIÊN
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.3px', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {student.fullName}
            </div>
          </div>

          {/* Specialization */}
          <div>
            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.8px', marginBottom: '2px' }}>
              CHUYÊN MÔN / LỚP HỌC
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fcd34d', lineHeight: 1.25 }}>
              {specialization}
            </div>
          </div>

          {/* Gender & Join Date Columns */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', paddingTop: '2px' }}>
            <div>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '2px' }}>GIỚI TÍNH</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>{student.gender || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '2px' }}>NGÀY NHẬP HỌC</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>{joinDateDisplay}</div>
            </div>
          </div>
        </div>

        {/* Right Side: QR Code Container */}
        <div style={{
          backgroundColor: '#ffffff', padding: '8px', borderRadius: '14px',
          border: '2px solid rgba(245, 158, 11, 0.6)', flexShrink: 0, display: 'flex', alignItems: 'center', justify: 'center',
        }}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR" style={{ width: '130px', height: '130px', display: 'block', borderRadius: '6px' }} />
          ) : (
            <div style={{ width: '130px', height: '130px', backgroundColor: '#e2e8f0', borderRadius: '6px' }} />
          )}
        </div>

      </div>

      {/* Footer Area */}
      <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.2)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ fontSize: '10.5px', color: '#cbd5e1', lineHeight: 1.4 }}>
          <span style={{ color: '#94a3b8' }}>Hotline: </span>
          <span style={{ color: '#ffffff', fontWeight: 700 }}>{centerPhone}</span>
          <span style={{ color: '#64748b', margin: '0 6px' }}>·</span>
          <span style={{ color: '#94a3b8' }}>Chủ trung tâm: </span>
          <span style={{ color: '#fcd34d', fontWeight: 800, textTransform: 'uppercase' }}>{ownerName}</span>
        </div>
        {centerAddress && (
          <div style={{ fontSize: '10.5px', color: '#cbd5e1', lineHeight: 1.4 }}>
            <span style={{ color: '#94a3b8' }}>Địa chỉ: </span>
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{centerAddress}</span>
          </div>
        )}
      </div>

    </div>

    {/* Bottom Gold Stripe */}
    <div style={{ height: '5px', background: 'linear-gradient(90deg, #92400e, #f59e0b, #fcd34d, #f59e0b, #92400e)', flexShrink: 0 }} />
  </div>
);
