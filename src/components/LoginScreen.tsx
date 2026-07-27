import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { AlertCircle, LogIn, User } from 'lucide-react';

export function LoginScreen() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdminLogin = async () => {
    setIsLoading(true);
    setError(null);
    const result = await login('admin@hieuvu.com', 'admin');
    if (!result.success) {
      setError(result.error || 'Đăng nhập thất bại');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-[#b48648] rounded-full blur-[200px] opacity-10" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-[#3b5998] rounded-full blur-[180px] opacity-8" />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        {/* Logo + Branding */}
        <div className="text-center mb-8">
          <img
            src="/HieuVu_Logo.png"
            alt="Logo Hiếu Vũ Music"
            className="inline-block w-28 h-28 object-contain mb-4"
          />
          <h1 className="text-2xl font-black text-white tracking-tight uppercase whitespace-nowrap">
            Trung Tâm Âm Nhạc Hiếu Vũ
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Hệ Thống Quản Lý Đào Tạo Âm Nhạc
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#141414] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1c1710] to-[#141414] px-6 py-5 border-b border-[#b48648]/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#b48648]/20 flex items-center justify-center">
                <User className="w-5 h-5 text-[#b48648]" />
              </div>
              <div>
                <h2 className="font-bold text-white text-lg">Đăng Nhập Hệ Thống</h2>
                <p className="text-xs text-slate-400">Chào mừng <b className="text-[#b48648]">VŨ TRUNG HIẾU</b> — Chủ trung tâm</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {error && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleAdminLogin}
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-[#b48648] hover:bg-[#8a6331] disabled:opacity-50 text-black font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-amber-900/30"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Đăng Nhập Với Tài Khoản VŨ TRUNG HIẾU</span>
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-500">
              Tài khoản <b className="text-slate-300">VŨ TRUNG HIẾU</b> — Chủ trung tâm
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          &copy; 2026 Trung Tâm Âm Nhạc Hiếu Vũ. Bảo vệ bản quyền.
        </p>
      </div>
    </div>
  );
}
