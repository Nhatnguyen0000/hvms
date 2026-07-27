import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Course, ClassGroup } from '../types';
import {
  getCourses,
  getClassGroups,
  getTeachers,
  getStudents,
  subscribeDataChange,
  STORAGE_KEYS_INTERNAL,
} from '../lib/storage';
import { formatVND } from '../lib/currencyHelper';
import { ClassModal } from './ClassModal';
import {
  WORKING_DAYS,
  TIME_SLOTS,
  getClassSessions,
  countWeeklySessions,
} from '../lib/scheduleService';
import { Music, Users, MapPin, User, Edit, Layers, Lock, Grid3x3, Check } from 'lucide-react';

/**
 * CoursesView — Hiển thị 3 lớp học cố định (Piano/Organ/Guitar).
 *
 * Mỗi lớp gắn liền với một môn học (Course) và dùng chung PHÒNG TRUNG TÂM.
 * Hệ thống không cho phép tạo/xoá lớp; chỉ chỉnh sửa giáo viên, ca học,
 * ngày học và sĩ số tối đa. Học viên được xếp vào lớp từ StudentFormModal
 * hoặc sẽ tự động rơi vào "lớp gốc" của môn khi thêm học viên mới.
 */
export const CoursesView: React.FC = () => {
  const [courses] = useState<Course[]>(getCourses());
  const [classGroups, setClassGroups] = useState<ClassGroup[]>(getClassGroups());
  const teachers = getTeachers();
  const students = getStudents();

  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);

  const refresh = useCallback(() => {
    setClassGroups(getClassGroups());
  }, []);

  // Subscribe to storage changes so the view always reflects the latest
  // teacher/maxStudents edits.
  useEffect(() => {
    const unsubscribe = subscribeDataChange((key) => {
      if (
        key === STORAGE_KEYS_INTERNAL.CLASSES ||
        key === STORAGE_KEYS_INTERNAL.STUDENTS ||
        key === STORAGE_KEYS_INTERNAL.TEACHERS
      ) {
        refresh();
      }
    });
    return unsubscribe;
  }, [refresh]);

  /** Build a quick lookup map of class id -> enrolled count. */
  const enrollmentByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const cls of classGroups) map.set(cls.id, 0);
    for (const student of students) {
      for (const cid of student.enrolledClassIds || []) {
        map.set(cid, (map.get(cid) || 0) + 1);
      }
    }
    return map;
  }, [classGroups, students]);

  const teacherById = useMemo(
    () => new Map(teachers.map((t) => [t.id, t])),
    [teachers]
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#141414] via-[#1a1712] to-[#141414] border border-[#b48648]/30 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-wide uppercase">
              Môn Học & Lớp Học
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#b48648]/20 text-[#b48648] border border-[#b48648]/30">
              3 Lớp Cố Định · PHÒNG TRUNG TÂM
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Trung tâm vận hành <b>3 lớp học cố định</b> tương ứng 3 bộ môn{' '}
            <b>Piano, Organ, Guitar</b>. Cả 3 lớp dùng chung <b>PHÒNG TRUNG TÂM</b>.
            Việc xếp ca học cụ thể (Thứ · Giờ · Môn) được quản lý chi tiết trong{' '}
            <b>Thời Khóa Biểu (TKB)</b>.
          </p>
        </div>
      </div>

      {/* Course Cards: Piano, Organ, Guitar — locked pricing */}
      <div className="space-y-3">
        <h3 className="font-bold text-white text-[#b48648] text-sm uppercase tracking-wide flex items-center gap-2">
          <Music className="w-4 h-4" /> Bảng Học Phí Định Mức (Cố Định)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {courses.map((crs) => {
            const linkedClass = classGroups.find((c) => c.courseId === crs.id);
            const enrolledCount = linkedClass
              ? enrollmentByClass.get(linkedClass.id) || 0
              : 0;

            return (
              <div
                key={crs.id}
                className="glass-panel hover:border-[#b48648]/50 rounded-2xl p-5 space-y-3 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-[#b48648] bg-[#b48648]/10 px-2.5 py-1 rounded-md border border-[#b48648]/20">
                    {crs.code}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    {crs.durationMonths} tháng ({crs.totalSessions} buổi)
                  </span>
                </div>

                <h4 className="font-extrabold text-white text-xl">{crs.name}</h4>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                  {crs.description}
                </p>

                <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Học phí định mức:</span>
                  <span className="font-black text-[#b48648] text-base">
                    {formatVND(crs.referenceFee)}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 font-semibold text-right flex items-center justify-end gap-1.5">
                  <Lock className="w-3 h-3" />
                  <span>Đơn giá cố định — không sửa.</span>
                </div>

                {linkedClass && (
                  <div className="pt-2 border-t border-white/5 text-[11px] text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-indigo-400" />
                    <span>Đang có:</span>
                    <strong className="text-white">{enrolledCount}</strong>
                    <span>học viên theo học.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* The 3 fixed class groups */}
      <div className="space-y-3 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-sm uppercase tracking-wide flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#b48648]" /> 3 Lớp Học Vận Hành
          </h3>
          <span className="text-[10px] text-slate-500 font-semibold uppercase">
            Hệ thống cố định — không tạo thêm / không xoá
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {classGroups.map((cls) => {
            const crs = courses.find((c) => c.id === cls.courseId);
            const tch = teacherById.get(cls.teacherId);
            const enrolledStudents = students.filter((s) =>
              s.enrolledClassIds?.includes(cls.id)
            );
            const sessions = getClassSessions(cls);
            // Build the grid once per render — keys are days, values are
            // booleans for each TIME_SLOT.
            const dayGrid: Record<string, Record<string, boolean>> = {};
            for (const day of WORKING_DAYS) {
              dayGrid[day] = {};
              for (const slot of TIME_SLOTS) dayGrid[day][slot] = false;
            }
            for (const s of sessions) {
              if (dayGrid[s.dayOfWeek]) dayGrid[s.dayOfWeek][s.timeSlot] = true;
            }

            return (
              <div
                key={cls.id}
                className="glass-panel rounded-2xl p-5 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-[#b48648] bg-[#b48648]/10 px-2 py-0.5 rounded border border-[#b48648]/20">
                          {cls.code}
                        </span>
                        <h4 className="font-bold text-white text-base">{cls.name}</h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 font-medium">
                        Môn: <span className="text-[#b48648]">{crs?.name}</span>
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-white/5 text-[#b48648] text-[11px] font-bold border border-white/10 whitespace-nowrap">
                      Sĩ số {enrolledStudents.length}/{cls.maxStudents}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-300 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#b48648]" />
                      <span>
                        GV Phụ Trách:{' '}
                        <span className="text-white font-semibold">
                          {tch?.fullName || 'Chưa phân công'}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                      <span>
                        Phòng:{' '}
                        <span className="text-white font-semibold flex items-center gap-1">
                          <Lock className="w-3 h-3 text-slate-500" />
                          PHÒNG TRUNG TÂM
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Grid3x3 className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        Tổng số ca / tuần:{' '}
                        <span className="text-white font-bold">
                          {countWeeklySessions(cls)} ca
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Weekly class grid */}
                  <div className="pt-2 border-t border-white/5">
                    <div className="text-[11px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">
                      Lịch Ca Học Tuần
                    </div>
                    <div className="overflow-x-auto border border-slate-700/60 rounded-lg">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="bg-slate-800/60">
                            <th className="px-1.5 py-1 text-left text-slate-500 font-bold w-10">
                              Ca
                            </th>
                            {WORKING_DAYS.map((day) => (
                              <th
                                key={day}
                                className="px-1 py-1 text-center text-slate-400 font-bold"
                              >
                                {day.replace('Thứ ', 'T')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {TIME_SLOTS.map((slot) => (
                            <tr key={slot} className="border-t border-slate-800/60">
                              <td className="px-1.5 py-1 text-[#b48648] font-mono font-bold text-center">
                                {slot}
                              </td>
                              {WORKING_DAYS.map((day) => {
                                const active = dayGrid[day][slot];
                                return (
                                  <td key={day} className="px-1 py-1 text-center">
                                    {active ? (
                                      <div
                                        className="mx-auto w-6 h-6 rounded-md bg-[#b48648] text-black flex items-center justify-center shadow-sm shadow-amber-600/40"
                                        title={`${day} · ${slot}`}
                                      >
                                        <Check className="w-3 h-3" />
                                      </div>
                                    ) : (
                                      <div
                                        className="mx-auto w-6 h-6 rounded-md bg-slate-800/50 border border-slate-700/50"
                                        title={`${day} · ${slot} (đóng)`}
                                      />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {sessions.length === 0 && (
                      <p className="text-[10px] text-amber-400 mt-2 font-semibold">
                        ⚠ Lớp chưa có ca học nào trong tuần. Bấm "Chỉnh Sửa" để chọn ca.
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <div className="text-[11px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3 text-emerald-400" />
                      Danh sách học viên ({enrolledStudents.length}):
                    </div>
                    <div className="text-[11px] text-slate-300 max-h-20 overflow-y-auto space-y-0.5 pr-1">
                      {enrolledStudents.length === 0 ? (
                        <span className="text-slate-500 italic">Chưa có học viên.</span>
                      ) : (
                        enrolledStudents.map((s) => (
                          <div key={s.id} className="flex items-center justify-between">
                            <span className="truncate">• {s.fullName}</span>
                            <span className="font-mono text-[10px] text-slate-500 shrink-0">
                              {s.code}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setEditingClass(cls)}
                  className="mt-2 w-full px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Edit className="w-3.5 h-3.5 text-[#b48648]" />
                  <span>Chỉnh Sửa (Giáo Viên · Ca Học · Sĩ Số)</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {editingClass && (
        <ClassModal
          classToEdit={editingClass}
          onClose={() => setEditingClass(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
};
