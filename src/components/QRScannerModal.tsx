import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { Student } from '../types';
import { getStudents } from '../lib/storage';
import { QrCode, Camera, Keyboard, X, CheckCircle2, Sparkles, RefreshCcw, ZapIcon } from 'lucide-react';

interface QRScannerModalProps {
  onClose: () => void;
  onScanStudent: (student: Student, rawPayload: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ onClose, onScanStudent }) => {
  const [students] = useState<Student[]>(() => getStudents());
  // Default to camera tab so scanning starts immediately
  const [activeTab, setActiveTab] = useState<'camera' | 'usb' | 'quick'>('camera');

  const [manualCode, setManualCode] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [lastScannedMsg, setLastScannedMsg] = useState<string | null>(null);
  const [lastScannedSuccess, setLastScannedSuccess] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const usbInputRef = useRef<HTMLInputElement>(null);
  const lastScannedPayloadRef = useRef<string>('');
  const cooldownRef = useRef<boolean>(false); // prevent double-trigger

  // Audio chime feedback using Web Audio API
  const playBeep = useCallback((success: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      if (success) {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.15);
      }
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Audio fallback — silent
    }
  }, []);

  // Process raw payload or code — works for camera scan, USB scan, and quick mode
  const processPayload = useCallback((payloadStr: string) => {
    const raw = payloadStr.trim();
    if (!raw) return;

    // Cooldown: ignore duplicate scans within 2 seconds
    if (cooldownRef.current && lastScannedPayloadRef.current === raw) return;

    let targetIdOrCode = raw;
    if (raw.startsWith('ALLEGRO_STUDENT_V1:')) {
      const parts = raw.split(':');
      if (parts.length >= 3) {
        targetIdOrCode = parts[1]; // studentId
      }
    }

    const found = students.find(
      (s) =>
        s.id === targetIdOrCode ||
        s.code.toLowerCase() === targetIdOrCode.toLowerCase() ||
        s.phone === targetIdOrCode
    );

    if (found) {
      playBeep(true);
      lastScannedPayloadRef.current = raw;
      cooldownRef.current = true;
      setTimeout(() => { cooldownRef.current = false; }, 2000);
      setLastScannedSuccess(true);
      setLastScannedMsg(`✅ [${new Date().toLocaleTimeString('vi-VN')}] Điểm danh thành công: ${found.fullName} (${found.code})`);
      onScanStudent(found, raw);
    } else {
      playBeep(false);
      setLastScannedSuccess(false);
      setLastScannedMsg(`❌ Không tìm thấy học viên với mã: "${raw}"`);
    }
  }, [students, onScanStudent, playBeep]);

  // QR decode loop — runs every animation frame on camera canvas
  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });
    if (code && code.data) {
      processPayload(code.data);
    }
    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [processPayload]);

  // Start/stop camera based on active tab
  useEffect(() => {
    if (activeTab === 'camera') {
      setCameraError(null);
      setIsScanning(false);
      navigator.mediaDevices
        ?.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        .then((stream) => {
          mediaStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              setIsScanning(true);
              animFrameRef.current = requestAnimationFrame(scanFrame);
            };
          }
        })
        .catch(() => {
          setCameraError(
            'Không thể truy cập camera. Vui lòng cấp quyền camera cho trình duyệt, hoặc chuyển sang tab Quét USB.'
          );
        });
    } else {
      // Stop camera + scanning loop when leaving camera tab
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      setIsScanning(false);
    }
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [activeTab, scanFrame]);

  // Focus USB input when switching to USB tab
  useEffect(() => {
    if (activeTab === 'usb' && usbInputRef.current) {
      usbInputRef.current.focus();
    }
  }, [activeTab]);

  // Handle USB scanner — auto-submit on Enter (which hardware scanners send)
  const handleUSBKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (manualCode.trim()) {
        processPayload(manualCode);
        setManualCode('');
      }
    }
  };

  const handleUSBSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      processPayload(manualCode);
      setManualCode('');
    }
  };

  const handleQuickSimulate = () => {
    const student = students.find((s) => s.id === selectedStudentId);
    if (student) {
      const payload = `ALLEGRO_STUDENT_V1:${student.id}:${student.code}`;
      processPayload(payload);
    }
  };

  const restartCamera = () => {
    setActiveTab('quick');
    setTimeout(() => setActiveTab('camera'), 100);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="bg-slate-800/80 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#b48648]/20 text-[#b48648] flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Quét Mã QR Điểm Danh</h3>
              <p className="text-xs text-slate-400">Nhận diện học viên & lưu Có Mặt tự động</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex gap-2">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
              activeTab === 'camera'
                ? 'bg-[#b48648] text-black border-[#b48648]'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Camera QR</span>
            {activeTab === 'camera' && isScanning && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('usb')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
              activeTab === 'usb'
                ? 'bg-[#b48648] text-black border-[#b48648]'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Súng Quét USB</span>
          </button>

          <button
            onClick={() => setActiveTab('quick')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
              activeTab === 'quick'
                ? 'bg-[#b48648] text-black border-[#b48648]'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Mô Phỏng</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-4">

          {/* Camera Tab — Auto-scan via jsQR */}
          {activeTab === 'camera' && (
            <div className="space-y-3">
              {cameraError ? (
                <div className="space-y-3">
                  <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-2xl text-rose-300 text-sm">
                    {cameraError}
                  </div>
                  <button
                    onClick={restartCamera}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <RefreshCcw className="w-4 h-4" />
                    Thử lại
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-amber-500/50 bg-black aspect-video flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Hidden canvas for QR decoding */}
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Scanning overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-48 relative">
                        {/* Corner brackets */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
                        {/* Scanning line */}
                        {isScanning && (
                          <div className="absolute left-2 right-2 h-0.5 bg-amber-400/80 animate-[scan_2s_linear_infinite]" style={{ top: '50%' }} />
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      isScanning ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-500/40' : 'bg-slate-900/80 text-slate-400 border border-slate-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isScanning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                      {isScanning ? 'Đang quét…' : 'Đang khởi động…'}
                    </div>
                  </div>

                  <p className="text-center text-xs text-slate-400">
                    Đưa mã QR thẻ học viên vào khung vàng — hệ thống tự nhận diện và điểm danh ngay
                  </p>
                </div>
              )}
            </div>
          )}

          {/* USB / Hardware Scanner Input */}
          {activeTab === 'usb' && (
            <form onSubmit={handleUSBSubmit} className="space-y-4">
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-xs space-y-1">
                <div className="font-bold text-indigo-300">Chế độ Súng Quét Mã QR Cầm Tay (USB)</div>
                <div className="text-slate-300">
                  Nhấn vào ô nhập liệu bên dưới, sau đó quét thẻ học viên bằng súng USB. Hệ thống tự điểm danh khi nhận mã (Enter).
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Mã QR từ Súng Quét</label>
                <input
                  ref={usbInputRef}
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={handleUSBKeyDown}
                  placeholder="Quét thẻ hoặc gõ mã học viên (HV001)..."
                  className="w-full bg-slate-800 border-2 border-amber-500/40 focus:border-[#b48648] rounded-xl px-4 py-3 text-sm font-mono text-amber-300 focus:outline-none transition-colors"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#b48648] hover:bg-amber-600 text-black font-extrabold text-sm shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 transition-all"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Xác Nhận Điểm Danh</span>
              </button>
            </form>
          )}

          {/* Quick Simulation Mode */}
          {activeTab === 'quick' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <ZapIcon className="w-3.5 h-3.5" /> Mô Phỏng Quét Thẻ Nhanh
                </div>
                <div className="text-slate-300">
                  Chọn học viên và nhấn nút để điểm danh ngay — dùng để kiểm tra hoặc điểm danh thủ công khi không có thiết bị quét.
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Chọn Học Viên</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#b48648]"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-800 text-slate-200">
                      {s.code} — {s.fullName} ({s.status === 'Active' ? 'Đang học' : s.status})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleQuickSimulate}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <QrCode className="w-5 h-5" />
                <span>Điểm Danh Ngay</span>
              </button>
            </div>
          )}

          {/* Feedback Status Alert */}
          {lastScannedMsg && (
            <div className={`p-3.5 rounded-2xl text-sm font-semibold flex items-start gap-2 border ${
              lastScannedSuccess
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
            }`}>
              {lastScannedSuccess
                ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                : <X className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              }
              <span>{lastScannedMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Scanning line animation keyframe (inline style tag) */}
      <style>{`
        @keyframes scan {
          0%   { transform: translateY(-60px); opacity: 1; }
          50%  { opacity: 0.6; }
          100% { transform: translateY(60px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
