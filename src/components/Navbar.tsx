import React, { useState, useRef, useEffect } from 'react';
import { getStudents, getTeachers, getCourses } from '../lib/storage';
import { UserCheck, Shield, Search, X, Users, GraduationCap, Music, ArrowRight, LogOut } from 'lucide-react';
import { ActiveTab } from './Sidebar';
import { useAuth } from '../lib/auth';

interface NavbarProps {
  onNavigateTab?: (tab: ActiveTab) => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigateTab, onLogout }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered search results
  const trimmedQuery = searchQuery.trim().toLowerCase();

  const matchingStudents = trimmedQuery
    ? getStudents().filter(
        (s) =>
          s.fullName.toLowerCase().includes(trimmedQuery) ||
          s.code.toLowerCase().includes(trimmedQuery) ||
          (s.phone && s.phone.toLowerCase().includes(trimmedQuery))
      ).slice(0, 4)
    : [];

  const matchingTeachers = trimmedQuery
    ? getTeachers().filter(
        (t) =>
          t.fullName.toLowerCase().includes(trimmedQuery) ||
          t.code.toLowerCase().includes(trimmedQuery) ||
          t.instruments.some((inst) => inst.toLowerCase().includes(trimmedQuery))
      ).slice(0, 4)
    : [];

  const matchingCourses = trimmedQuery
    ? getCourses().filter(
        (c) =>
          c.name.toLowerCase().includes(trimmedQuery) ||
          c.code.toLowerCase().includes(trimmedQuery)
      ).slice(0, 4)
    : [];

  const hasResults =
    matchingStudents.length > 0 || matchingTeachers.length > 0 || matchingCourses.length > 0;

  const handleSelectResult = (tab: ActiveTab) => {
    setIsDropdownOpen(false);
    setSearchQuery('');
    if (onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  return (
    <header className="bg-[#0d0d0d]/90 backdrop-blur-md border-b border-white/10 text-white px-4 sm:px-6 md:px-8 py-3 sticky top-0 z-30 shadow-2xl w-full">
      <div className="w-full flex items-center justify-between gap-4">
        {/* Official Brand Logo & Name */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-10 h-10 shrink-0">
            <img
              src="/HieuVu_Logo.png"
              alt="Logo Hiếu Vũ Music"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-xl tracking-wider text-white uppercase">
              TRUNG TÂM ÂM NHẠC HIẾU VŨ
            </h1>
            <p className="text-[11px] text-[#b48648] font-medium tracking-wide hidden lg:block">
              Nơi ươm mầm tài năng &amp; Đánh thức cảm xúc nghệ thuật
            </p>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative flex-1 max-w-md mx-2" ref={searchContainerRef}>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Tìm nhanh học viên, giáo viên, khóa học..."
              className="w-full bg-slate-900/90 border border-white/15 focus:border-[#b48648] text-slate-100 text-xs rounded-xl pl-9 pr-8 py-2 outline-none transition-all placeholder:text-slate-500 shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setIsDropdownOpen(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown Overlay */}
          {isDropdownOpen && trimmedQuery.length > 0 && (
            <div className="absolute top-11 left-0 right-0 bg-[#141414] border border-[#b48648]/40 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-2xl divide-y divide-white/10 max-h-[75vh] overflow-y-auto">
              {!hasResults && (
                <div className="p-4 text-center text-xs text-slate-400">
                  Không tìm thấy học viên, giáo viên hoặc khóa học nào phù hợp với <span className="text-[#b48648] font-bold">"{searchQuery}"</span>.
                </div>
              )}

              {/* Students Match Section */}
              {matchingStudents.length > 0 && (
                <div className="p-2.5">
                  <div className="px-2 py-1 text-[10px] font-extrabold text-[#b48648] uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#b48648]" />
                    <span>Học Viên ({matchingStudents.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {matchingStudents.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleSelectResult('students')}
                        className="w-full text-left p-2 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-[11px] flex items-center justify-center">
                            {s.fullName.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-100 group-hover:text-[#b48648] transition-colors">
                              {s.fullName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Mã: {s.code} {s.phone ? `· ${s.phone}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                              s.status === 'Active'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                : s.status === 'Reserved'
                                ? 'bg-amber-950 text-amber-400 border border-amber-500/30'
                                : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {s.status === 'Active' ? 'Đang học' : s.status === 'Reserved' ? 'Bảo lưu' : 'Nghỉ'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Teachers Match Section */}
              {matchingTeachers.length > 0 && (
                <div className="p-2.5">
                  <div className="px-2 py-1 text-[10px] font-extrabold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
                    <span>Giáo Viên ({matchingTeachers.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {matchingTeachers.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectResult('teachers')}
                        className="w-full text-left p-2 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 font-bold text-[11px] flex items-center justify-center">
                            {t.fullName.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-100 group-hover:text-purple-300 transition-colors">
                              {t.fullName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Bộ môn: {t.instruments.join(', ')}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Courses Match Section */}
              {matchingCourses.length > 0 && (
                <div className="p-2.5">
                  <div className="px-2 py-1 text-[10px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-amber-400" />
                    <span>Khóa Học ({matchingCourses.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {matchingCourses.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectResult('courses')}
                        className="w-full text-left p-2 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-lg font-bold text-[10px] flex items-center justify-center border text-amber-300 border-amber-500/40 bg-amber-500/10"
                          >
                            {c.code}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                              {c.name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Học phí định mức: {c.referenceFee.toLocaleString('vi-VN')}đ / tháng
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* System Badges & User Controller */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Status System Badge */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Bảo Mật</span>
          </div>

          {/* Account Profile Dropdown */}
          <div className="flex items-center gap-2.5 bg-white/5 p-1.5 pl-3 rounded-2xl border border-white/10" ref={userMenuRef}>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-extrabold text-white tracking-wide">
                {user?.fullName || 'VŨ TRUNG HIẾU'}
              </div>
              <div className="text-[10px] text-[#b48648] font-semibold">Chủ trung tâm · Đã đăng nhập</div>
            </div>
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-9 h-9 rounded-xl overflow-hidden cursor-pointer shadow-md hover:shadow-lg transition-shadow bg-transparent"
              >
                <img
                  src="/HieuVu_Logo.png"
                  alt="VŨ TRUNG HIẾU"
                  className="w-full h-full object-contain"
                />
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 top-11 w-64 bg-[#141414] border border-white/10 rounded-2xl shadow-2xl py-2 z-50 backdrop-blur-xl">
                  <div className="px-3 py-2 border-b border-white/10">
                    <div className="text-[11px] font-bold text-[#b48648] uppercase tracking-wider mb-1">Tài Khoản</div>
                    <div className="text-sm font-extrabold text-white">{user?.fullName || 'VŨ TRUNG HIẾU'}</div>
                    {user?.email && (
                      <div className="text-[10px] text-slate-400 mt-0.5">{user.email}</div>
                    )}
                  </div>
                  {onLogout && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-2.5 text-xs flex items-center gap-2 text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng Xuất</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

