import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { ActiveTab, Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { ToastProvider, ConfirmProvider } from './components/Toast';
import { Student } from './types';
import { initSupabaseDataSync, migrateToEncryptedStorage } from './lib/storage';

// Lazy load all views for code splitting
const DashboardView = lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const StudentsView = lazy(() => import('./components/StudentsView').then(m => ({ default: m.StudentsView })));
const TeachersView = lazy(() => import('./components/TeachersView').then(m => ({ default: m.TeachersView })));
const CoursesView = lazy(() => import('./components/CoursesView').then(m => ({ default: m.CoursesView })));
const ScheduleView = lazy(() => import('./components/ScheduleView').then(m => ({ default: m.ScheduleView })));
const AttendanceView = lazy(() => import('./components/AttendanceView').then(m => ({ default: m.AttendanceView })));
const TuitionView = lazy(() => import('./components/TuitionView').then(m => ({ default: m.TuitionView })));
const AuditLogsView = lazy(() => import('./components/AuditLogsView').then(m => ({ default: m.AuditLogsView })));
const SettingsView = lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));

import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Receipt,
  ScrollText,
  Menu,
  PlusCircle,
  X,
} from 'lucide-react';

function ViewSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-1">
      <div className="h-12 bg-slate-800/60 rounded-2xl" />
      <div className="h-48 bg-slate-800/40 rounded-2xl" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-32 bg-slate-800/30 rounded-2xl" />
        <div className="h-32 bg-slate-800/30 rounded-2xl" />
        <div className="h-32 bg-slate-800/30 rounded-2xl" />
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const { user, isAuthenticated, hasPermission, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [recordPaymentStudent, setRecordPaymentStudent] = useState<Student | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    initSupabaseDataSync();
    migrateToEncryptedStorage();
  }, []);

  const handleOpenRecordPayment = useCallback((student?: Student | null) => {
    if (!hasPermission('record_payment')) return;
    setRecordPaymentStudent(student || null);
    setIsRecordPaymentOpen(true);
  }, [hasPermission]);

  const handleCloseRecordPayment = useCallback(() => {
    setIsRecordPaymentOpen(false);
    setRecordPaymentStudent(null);
  }, []);

  const handleRecordPaymentSuccess = useCallback(() => {
    setIsRecordPaymentOpen(false);
    setRecordPaymentStudent(null);
  }, []);

  const mobileNavSections = useMemo(() => [
    {
      title: 'TỔNG QUAN',
      items: [
        { id: 'dashboard' as ActiveTab, icon: LayoutDashboard, label: 'Bàn Làm Việc', permission: 'view_dashboard' as const },
      ],
    },
    {
      title: 'QUẢN LÝ ĐÀO TẠO',
      items: [
        { id: 'students' as ActiveTab, icon: Users, label: 'Quản Lý Học Viên', permission: 'manage_students' as const },
        { id: 'teachers' as ActiveTab, icon: GraduationCap, label: 'Giáo Viên', permission: 'manage_teachers' as const },
        { id: 'courses' as ActiveTab, icon: BookOpen, label: 'Khóa Học & Lớp', permission: 'manage_courses' as const },
        { id: 'schedule' as ActiveTab, icon: CalendarDays, label: 'Thời Khóa Biểu', permission: 'manage_schedule' as const },
        { id: 'attendance' as ActiveTab, icon: CheckCircle2, label: 'Điểm Danh Lớp', permission: 'take_attendance' as const },
      ],
    },
    {
      title: 'TÀI CHÍNH',
      items: [
        { id: 'tuition' as ActiveTab, icon: Receipt, label: 'Học Phí & Biên Lai', permission: 'view_reports' as const },
      ],
    },
    {
      title: 'HỆ THỐNG',
      items: [
        { id: 'audit' as ActiveTab, icon: ScrollText, label: 'Nhật Ký System', permission: 'view_audit' as const },
      ],
    },
  ], []);

  const handleMobileNav = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  }, []);

  // Role badge color
  const roleBadgeColor = user?.role === 'Admin' ? 'text-amber-400 bg-amber-500/15 border-amber-500/30' : 'text-blue-400 bg-blue-500/15 border-blue-500/30';

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-slate-100 font-sans antialiased selection:bg-[#b48648] selection:text-black flex flex-col relative overflow-x-hidden">
      {/* Atmospheric Blurs */}
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-[#b48648] rounded-full blur-[150px] opacity-10 pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] bg-[#3b5998] rounded-full blur-[180px] opacity-10 pointer-events-none z-0" />

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-30" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Mobile Full-Screen Menu */}
      <div className={`md:hidden fixed top-0 right-0 h-full w-80 bg-[#141414]/98 backdrop-blur-xl border-l border-white/10 z-40 transform transition-transform duration-300 flex flex-col justify-between ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div>
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <span className="font-extrabold text-[#b48648] text-base block">Menu Điều Hướng</span>
              <span className={`text-xs px-2 py-0.5 rounded border font-semibold mt-1 inline-block ${roleBadgeColor}`}>
                {user?.role === 'Admin' ? 'VŨ TRUNG HIẾU' : 'Nhân Viên'}
              </span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="w-9 h-9 rounded-xl bg-white/10 text-slate-300 flex items-center justify-center hover:bg-white/20">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-4 space-y-5 max-h-[calc(100vh-140px)] overflow-y-auto">
            {mobileNavSections.map((sec, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="text-xs font-black text-[#b48648] uppercase tracking-wider px-2 border-b border-[#b48648]/20 pb-1">
                  {sec.title}
                </div>
                {sec.items.map(({ id, icon: Icon, label, permission }) => {
                  const hasAccess = hasPermission(permission);
                  const isActive = activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => hasAccess && handleMobileNav(id)}
                      className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-base font-bold transition-all ${
                        !hasAccess ? 'opacity-40 cursor-not-allowed text-slate-600' :
                        isActive
                          ? 'bg-gradient-to-r from-[#b48648] to-[#9a6e35] text-black font-extrabold shadow-lg shadow-amber-600/30'
                          : 'text-slate-200 hover:bg-white/5'
                      }`}
                      title={!hasAccess ? 'Bạn không có quyền truy cập' : undefined}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-black' : 'text-[#b48648]'}`} />
                      <span>{label}</span>
                      {!hasAccess && <span className="ml-auto text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Khóa</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full py-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-base font-bold hover:bg-rose-500/25 transition-all flex items-center justify-center gap-2"
          >
            Đăng Xuất
          </button>
        </div>
      </div>

      {/* Top Navbar */}
      <Navbar onNavigateTab={setActiveTab} onLogout={logout} />

      {/* Main Container */}
      <div className="flex-1 flex w-full relative z-10">
        {/* Desktop Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* View Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden w-full max-w-none">
          <Suspense fallback={<ViewSkeleton />}>
            {activeTab === 'dashboard' && hasPermission('view_dashboard') && (
              <DashboardView
                onOpenRecordPayment={() => handleOpenRecordPayment(null)}
                onOpenRecordPaymentWithStudent={(std) => handleOpenRecordPayment(std)}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}
            {activeTab === 'students' && hasPermission('manage_students') && (
              <StudentsView onOpenRecordPaymentForStudent={(std) => handleOpenRecordPayment(std)} />
            )}
            {activeTab === 'teachers' && hasPermission('manage_teachers') && <TeachersView />}
            {activeTab === 'courses' && hasPermission('manage_courses') && <CoursesView />}
            {activeTab === 'schedule' && hasPermission('manage_schedule') && <ScheduleView />}
            {activeTab === 'attendance' && hasPermission('take_attendance') && <AttendanceView />}
            {activeTab === 'tuition' && hasPermission('view_reports') && (
              <TuitionView onOpenRecordPayment={() => handleOpenRecordPayment(null)} />
            )}
            {activeTab === 'audit' && hasPermission('view_audit') && <AuditLogsView />}
            {activeTab === 'settings' && hasPermission('view_reports') && <SettingsView />}
          </Suspense>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#121212]/95 backdrop-blur-md border-t border-white/10 z-40 px-1 py-1.5 flex items-center justify-between">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center p-2 rounded-xl text-[10px] font-semibold ${activeTab === 'dashboard' ? 'text-[#b48648] font-bold' : 'text-slate-400'}`}>
          <LayoutDashboard className="w-5 h-5" />
          <span className="mt-0.5">Tổng Quan</span>
        </button>
        <button onClick={() => setActiveTab('students')} className={`flex flex-col items-center p-2 rounded-xl text-[10px] font-semibold ${activeTab === 'students' ? 'text-[#b48648] font-bold' : 'text-slate-400'}`}>
          <Users className="w-5 h-5" />
          <span className="mt-0.5">Học Viên</span>
        </button>
        <button onClick={() => handleOpenRecordPayment(null)} className="flex flex-col items-center p-2 rounded-xl text-[10px] font-semibold text-[#b48648] -mt-4">
          <div className="w-12 h-12 rounded-full bg-[#b48648] flex items-center justify-center shadow-lg shadow-amber-600/30">
            <PlusCircle className="w-6 h-6 text-black" />
          </div>
          <span className="mt-0.5">Thu Tiền</span>
        </button>
        <button onClick={() => setActiveTab('tuition')} className={`flex flex-col items-center p-2 rounded-xl text-[10px] font-semibold ${activeTab === 'tuition' ? 'text-[#b48648] font-bold' : 'text-slate-400'}`}>
          <Receipt className="w-5 h-5" />
          <span className="mt-0.5">Học Phí</span>
        </button>
        <button onClick={() => setIsMobileMenuOpen(true)} className="flex flex-col items-center p-2 rounded-xl text-[10px] font-semibold text-slate-400 hover:text-white">
          <Menu className="w-5 h-5" />
          <span className="mt-0.5">Khác</span>
        </button>
      </nav>

      {/* Global Record Payment Modal */}
      {isRecordPaymentOpen && (
        <RecordPaymentModal
          initialStudent={recordPaymentStudent}
          onClose={handleCloseRecordPayment}
          onSuccess={handleRecordPaymentSuccess}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#b48648]/30 border-t-[#b48648] rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <AuthenticatedApp />;
}
