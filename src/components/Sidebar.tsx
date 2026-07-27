import React from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Music,
  CalendarDays,
  CheckCircle2,
  Receipt,
  History,
  Settings,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'students'
  | 'teachers'
  | 'courses'
  | 'schedule'
  | 'attendance'
  | 'tuition'
  | 'audit'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

interface MenuItem {
  id: ActiveTab;
  label: string;
  description?: string;
  icon: React.FC<{ className?: string }>;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuSections: MenuSection[] = [
    {
      title: 'TỔNG QUAN',
      items: [
        { id: 'dashboard', label: 'Bàn Làm Việc', description: 'Trang chủ & thống kê', icon: LayoutDashboard },
      ],
    },
    {
      title: 'QUẢN LÝ ĐÀO TẠO',
      items: [
        { id: 'students', label: 'Quản Lý Học Viên', description: 'Danh sách & hồ sơ', icon: Users },
        { id: 'teachers', label: 'Đội Ngũ Giáo Viên', description: 'Giảng viên & môn dạy', icon: GraduationCap },
        { id: 'courses', label: 'Khóa Học & Lớp', description: 'Chương trình đào tạo', icon: Music },
        { id: 'schedule', label: 'Thời Khóa Biểu (TKB)', description: 'Xếp ca & phân lịch học', icon: CalendarDays },
        { id: 'attendance', label: 'Điểm Danh Lớp', description: 'Điểm danh theo ca học', icon: CheckCircle2 },
      ],
    },
    {
      title: 'TÀI CHÍNH & BIÊN LAI',
      items: [
        { id: 'tuition', label: 'Học Phí & Biên Lai', description: 'Thu tiền & xuất hóa đơn', icon: Receipt },
      ],
    },
    {
      title: 'CẤU HÌNH HỆ THỐNG',
      items: [
        { id: 'audit', label: 'Nhật Ký Hệ Thống', description: 'Lịch sử thao tác', icon: History },
        { id: 'settings', label: 'Cài Đặt Trung Tâm', description: 'Thiết lập & bảo mật', icon: Settings },
      ],
    },
  ];

  return (
    <aside className="w-72 bg-[#0c0c0d]/95 border-r border-slate-800/80 shrink-0 hidden md:flex flex-col p-4 min-h-[calc(100vh-65px)] backdrop-blur-xl shadow-2xl select-none">
      <div className="space-y-6">
        {menuSections.map((section, idx) => (
          <div key={idx} className="space-y-2">
            {/* Section Header */}
            <div className="flex items-center gap-2 px-3 py-1 text-xs font-black text-[#b48648] tracking-widest uppercase border-b border-[#b48648]/20 pb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#b48648]" />
              <span>{section.title}</span>
            </div>

            {/* Section Items */}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all relative group text-left ${
                      isActive
                        ? 'bg-gradient-to-r from-[#b48648] to-[#9a6e35] text-slate-950 font-extrabold shadow-lg shadow-amber-600/25 scale-[1.02] border border-amber-300/40'
                        : 'text-slate-200 hover:text-white hover:bg-slate-800/80 border border-transparent'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive ? 'text-slate-950' : 'text-[#b48648]'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm sm:text-base font-bold tracking-tight leading-tight ${
                          isActive ? 'text-slate-950 font-black' : 'text-slate-100'
                        }`}
                      >
                        {item.label}
                      </div>
                      {item.description && (
                        <div
                          className={`text-[11px] mt-0.5 truncate ${
                            isActive ? 'text-slate-900/80 font-medium' : 'text-slate-400 font-normal'
                          }`}
                        >
                          {item.description}
                        </div>
                      )}
                    </div>
                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-slate-950 shrink-0 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

