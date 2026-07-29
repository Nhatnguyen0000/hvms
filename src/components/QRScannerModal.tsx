import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { Student } from '../types';
import { getStudents } from '../lib/storage';
import { QrCode, Camera, X, CheckCircle2, RefreshCcw } from 'lucide-react';

interface QRScannerModalProps {
  onClose: () => void;
  onScanStudent: (student: Student, rawPayload: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ onClose, onScanStudent }) => {
  const [students] = useState<Student[]>(() => getStudents());

  const [lastScannedMsg, setLastScannedMsg] = useState<string | null>(null);
  const [lastScannedSuccess, setLastScannedSuccess] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScannedPayloadRef = useRef<string>('');
  const cooldownRef = useRef<boolean>(false);

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

  // Process raw payload — camera scan only
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

  // Start camera on mount, stop on unmount
  useEffect(() => {
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
        setCameraError('Không thể truy cập camera. Vui lòng cấp quyền camera cho trình duyệt.');
      });

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
  }, [scanFrame]);

  const restartCamera = () => {
    // Stop existing stream
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsScanning(false);
    setCameraError(null);
    // Re-init
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
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
        setCameraError('Không thể truy cập camera. Vui lòng cấp quyền camera cho trình duyệt.');
      });
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
              <p className="text-xs text-slate-400">Nhận diện học viên &amp; lưu Có Mặt tự động</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Content */}
        <div className="p-6 space-y-4">
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
            <div className="space-y-3">
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
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
                    {isScanning && (
                      <div className="absolute left-2 right-2 h-0.5 bg-amber-400/80 animate-[scan_2s_linear_infinite]" style={{ top: '50%' }} />
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  isScanning
                    ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-900/80 text-slate-400 border border-slate-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isScanning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {isScanning ? 'Đang quét…' : 'Đang khởi động…'}
                </div>
              </div>

              <p className="text-center text-xs text-slate-400">
                Đưa mã QR thẻ học viên vào khung vàng — hệ thống tự nhận diện và điểm danh ngay
              </p>

              <button
                onClick={restartCamera}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Khởi động lại camera
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

      {/* Scanning line animation keyframe */}
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
