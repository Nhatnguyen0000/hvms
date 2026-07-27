import React, { useState, useMemo } from 'react';
import { ClassGroup } from '../types';
import { getCourses, getTeachers, saveClassGroup } from '../lib/storage';
import { useToast } from './Toast';
import {
  WORKING_DAYS,
  TIME_SLOTS,
  normalizeClassSessions,
  buildSessionsGrid,
  countWeeklySessions,
} from '../lib/scheduleService';
import { X, Save, Music, Lock, MapPin, Grid3x3, Check } from 'lucide-react';

interface ClassModalProps {
  classToEdit: ClassGroup;
  onClose: () => void;
  onSaved: () => void;
}

const FIXED_ROOM = 'PHÒNG TRUNG TÂM';

/**
 * ClassModal — chỉnh sửa lớp học cố định (Piano/Organ/Guitar).
 * Modal cho phép chọn lịch ca học trong tuần dạng grid Thứ × Ca (17h/18h/19h/20h).
 * Tick vào ô = lớp học ca đó trong tuần. Bỏ tick = bỏ ca đó.
 */
export const ClassModal: React.FC<ClassModalProps> = ({
  classToEdit,
  onClose,
  onSaved,
}) => {
  const courses = getCourses();
  const teachers = getTeachers();
  const toast = useToast();

  const [teacherId, setTeacherId] = useState(classToEdit.teacherId || teachers[0]?.id || '');
  const [maxStudents, setMaxStudents] = useState(classToEdit.maxStudents || 30);

  // Build initial grid from existing sessions (legacy + modern both supported).
  const initialGrid = useMemo(() => {
    const existingSessions = normalizeClassSessions(
      classToEdit.classSessions && classToEdit.classSessions.length > 0
        ? classToEdit.classSessions
        : (classToEdit.scheduleDays || []).map((d) => ({
            dayOfWeek: d,
            timeSlot: classToEdit.timeSlot || '17h',
          }))
    );
    return buildSessionsGrid(existingSessions);
  }, [classToEdit]);

  const [grid, setGrid] = useState<Record<string, Record<string, boolean>>>(initialGrid);

  const linkedCourse = courses.find((c) => c.id === classToEdit.courseId);

  const toggleCell = (day: string, slot: string) => {
    setGrid((prev) => ({
      ...prev,
      [day]: { ...prev[day], [slot]: !prev[day][slot] },
    }));
  };

  /** Build the sessionCount summary for the header. */
  const sessionCount = useMemo(() => {
    let n = 0;
    for (const day of WORKING_DAYS) {
      for (const slot of TIME_SLOTS) {
        if (grid[day]?.[slot]) n += 1;
      }
    }
    return n;
  }, [grid]);

  /** Build a synthetic ClassGroup to pass countWeeklySessions for the preview. */
  const previewClass: ClassGroup = useMemo(() => {
    const sessions: { dayOfWeek: string; timeSlot: string }[] = [];
    for (const day of WORKING_DAYS) {
      for (const slot of TIME_SLOTS) {
        if (grid[day]?.[slot]) sessions.push({ dayOfWeek: day, timeSlot: slot });
      }
    }
    return { ...classToEdit, classSessions: sessions };
  }, [grid, classToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId) return;
    const sessions: { dayOfWeek: string; timeSlot: string }[] = [];
    for (const day of WORKING_DAYS) {
      for (const slot of TIME_SLOTS) {
        if (grid[day]?.[slot]) sessions.push({ dayOfWeek: day, timeSlot: slot });
      }
    }
    const normalized = normalizeClassSessions(sessions);

    const classData: ClassGroup = {
      ...classToEdit,
      teacherId,
      room: FIXED_ROOM,
      classSessions: normalized,
      maxStudents: Number(maxStudents),
    };

    await saveClassGroup(classData);
    onSaved();
    onClose();
    toast.success(
      classToEdit
        ? `Đã cập nhật lớp ${classToEdit.name}.`
        : `Đã lưu lớp học.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-slate-800/80 px-6 py-4 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center font-bold">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Chỉnh Sửa Lớp Học · Lịch Ca Học Tuần</h3>
              <p className="text-xs text-slate-400 font-mono">{classToEdit.code}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Read-only info: name + course + room */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Tên lớp:</span>
              <span className="font-bold text-white">{classToEdit.name}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Môn học:</span>
              <span className="font-bold text-[#b48648]">
                {linkedCourse?.name || classToEdit.courseId}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Phòng học:
              </span>
              <span className="font-bold text-white flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-500" />
                {FIXED_ROOM}
              </span>
            </div>
          </div>

          {/* Teacher + max students */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Giáo Viên Giảng Dạy
              </label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} ({t.code} - Chuyên {t.instruments.join(', ')})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Sĩ Số Tối Đa
              </label>
              <input
                type="number"
                value={maxStudents}
                onChange={(e) => setMaxStudents(Number(e.target.value))}
                min={1}
                max={50}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                required
              />
            </div>
          </div>

          {/* Weekly grid: rows = days, cols = time slots */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                <Grid3x3 className="w-3.5 h-3.5" />
                Lịch Ca Học Trong Tuần (Tick vào ô để chọn)
              </label>
              <span className="text-[11px] font-bold text-[#b48648]">
                Đã chọn {sessionCount} ca / tuần
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-700/60 rounded-xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800/60">
                    <th className="px-3 py-2 text-left text-slate-400 uppercase font-bold text-[10px]">
                      Thứ \ Ca
                    </th>
                    {TIME_SLOTS.map((slot) => (
                      <th
                        key={slot}
                        className="px-3 py-2 text-center text-[#b48648] font-mono font-bold text-xs"
                      >
                        {slot}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {WORKING_DAYS.map((day) => (
                    <tr key={day} className="border-t border-slate-800/60">
                      <td className="px-3 py-2 text-slate-300 font-semibold text-xs">
                        {day}
                      </td>
                      {TIME_SLOTS.map((slot) => {
                        const checked = !!grid[day]?.[slot];
                        return (
                          <td key={slot} className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleCell(day, slot)}
                              className={`w-full h-9 rounded-lg border transition-all flex items-center justify-center gap-1 ${
                                checked
                                  ? 'bg-[#b48648] border-[#b48648] text-black shadow-md shadow-amber-600/30'
                                  : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:border-slate-500 hover:bg-slate-700/50'
                              }`}
                              title={`${day} · ${slot}`}
                            >
                              {checked && <Check className="w-3.5 h-3.5" />}
                              {!checked && (
                                <span className="text-[10px] font-mono text-slate-600">
                                  {slot}
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-500">
              Tip: Mỗi ca tương ứng với 1 buổi học 60 phút. Tick chọn các ca muốn mở trong tuần. Bỏ tick = đóng ca đó.
            </p>
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-600/30 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Lưu Lớp Học · {countWeeklySessions(previewClass)} ca/tuần</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
