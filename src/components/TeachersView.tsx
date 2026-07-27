import React, { useState } from 'react';
import { Teacher } from '../types';
import { getTeachers, getClassGroups } from '../lib/storage';
import { TeacherModal } from './TeacherModal';
import { GraduationCap, Plus, Phone, Mail, BookOpen, Edit } from 'lucide-react';

export const TeachersView: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>(getTeachers());
  const classGroups = getClassGroups();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [teacherToEdit, setTeacherToEdit] = useState<Teacher | null>(null);

  const refresh = () => {
    setTeachers(getTeachers());
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Đội Ngũ Giáo Viên & Nhạc Công</h2>
          <p className="text-slate-400 text-xs mt-1">
            Danh sách giảng viên Trung Tâm Âm Nhạc Hiếu Vũ, nhạc cụ giảng dạy và các lớp phụ trách.
          </p>
        </div>

        <button
          onClick={() => {
            setTeacherToEdit(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Giáo Viên Mới</span>
        </button>
      </div>

      {/* Teachers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {teachers.map((tch) => {
          const assignedClasses = classGroups.filter((c) => c.teacherId === tch.id);

          return (
            <div
              key={tch.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center shrink-0">
                      <span className="text-purple-300 font-bold text-sm">
                        {tch.fullName.split(' ').pop()?.slice(0, 2).toUpperCase() || 'GV'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">{tch.fullName}</h3>
                      <span className="font-mono text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        {tch.code}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      tch.status === 'Active'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {tch.status === 'Active' ? 'Đang dạy' : 'Tạm nghỉ'}
                  </span>
                </div>

                <div className="text-xs space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-purple-400" /> SĐT:
                    </span>
                    <span className="font-semibold">{tch.phone}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block mb-1">Nhạc cụ phụ trách:</span>
                    <div className="flex flex-wrap gap-1">
                      {tch.instruments.map((inst) => (
                        <span
                          key={inst}
                          className="px-2 py-0.5 rounded-md bg-slate-800 text-purple-300 text-[10px] font-semibold border border-slate-700"
                        >
                          {inst}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-2 italic">
                    "{tch.bio || 'Chuyên gia âm nhạc giảng dạy tại Hiếu Vũ Music Center.'}"
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold">
                  <BookOpen className="w-3.5 h-3.5 text-purple-400" /> Phụ trách {assignedClasses.length} lớp
                </span>

                <button
                  onClick={() => {
                    setTeacherToEdit(tch);
                    setIsModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-all"
                >
                  <Edit className="w-3.5 h-3.5 text-purple-400" />
                  <span>Sửa Hồ Sơ</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <TeacherModal
          teacherToEdit={teacherToEdit}
          onClose={() => setIsModalOpen(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
};
