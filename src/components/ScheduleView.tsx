import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getScheduleEntries,
  saveScheduleEntry,
  getStudents,
  saveStudent,
  getTeachers,
  subscribeDataChange,
  STORAGE_KEYS_INTERNAL,
} from '../lib/storage';
import { ScheduleEntry, Student, Teacher } from '../types';
import {
  WORKING_DAYS,
  TIME_SLOTS,
  INSTRUMENTS,
  TimeSlot,
  Instrument,
  buildShiftKey,
  teacherCoversInstrument,
  makeEmptyShift,
} from '../lib/scheduleService';
import {
  User,
  Plus,
  Trash2,
  Users,
  Search,
  X,
  Music,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { useToast, useConfirm } from './Toast';

export const ScheduleView: React.FC = () => {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(getScheduleEntries());
  const [students] = useState<Student[]>(getStudents());
  const [teachers] = useState<Teacher[]>(getTeachers());
  const toast = useToast();
  const confirm = useConfirm();

  const [activeDay, setActiveDay] = useState<string>(WORKING_DAYS[0]);

  // Modal State for adding student or assigning teacher to a specific (Day, TimeSlot, Instrument)
  const [editingSlot, setEditingSlot] = useState<{
    day: string;
    slot: string;
    instrument: Instrument;
  } | null>(null);

  const [studentSearch, setStudentSearch] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  const refreshData = useCallback(() => {
    setSchedule(getScheduleEntries());
  }, []);

  // Subscribe to schedule + student changes so the view always reflects
  // the latest data (Risk R4: previous version only loaded once on mount).
  useEffect(() => {
    const unsubscribe = subscribeDataChange((key) => {
      if (
        key === STORAGE_KEYS_INTERNAL.SCHEDULE ||
        key === STORAGE_KEYS_INTERNAL.STUDENTS ||
        key === STORAGE_KEYS_INTERNAL.TEACHERS
      ) {
        refreshData();
      }
    });
    return unsubscribe;
  }, [refreshData]);

  /**
   * Returns the persisted shift for a triple, or a stable empty placeholder.
   * The placeholder's id matches what saveScheduleEntry will produce, so
   * downstream views (AttendanceView) see the same id before and after
   * the first save — no risk of orphan attendance rows.
   */
  const getEntry = useCallback(
    (day: string, slot: string, instrument: Instrument): ScheduleEntry => {
      const found = schedule.find(
        (e) => e.dayOfWeek === day && e.timeSlot === slot && e.instrument === instrument
      );
      if (found) return found;
      return makeEmptyShift(day, slot, instrument, 'tch_hieuvu');
    },
    [schedule]
  );

  const handleOpenSlotModal = (day: string, slot: string, instrument: Instrument) => {
    const currentEntry = getEntry(day, slot, instrument);
    setEditingSlot({ day, slot, instrument });
    setSelectedTeacherId(currentEntry.teacherId || 'tch_hieuvu');
    setStudentSearch('');
  };

  const handleAddStudentToSlot = async (studentId: string) => {
    if (!editingSlot) return;
    const current = getEntry(editingSlot.day, editingSlot.slot, editingSlot.instrument);

    if (current.studentIds.includes(studentId)) {
      toast.warning('Học viên này đã có trong ca học.');
      return;
    }

    const updated: ScheduleEntry = {
      ...current,
      studentIds: [...current.studentIds, studentId],
      teacherId: selectedTeacherId || current.teacherId,
    };

    await saveScheduleEntry(updated);

    // Auto-enroll in the corresponding course class group if not already enrolled
    const classId = editingSlot.instrument === 'Piano' ? 'cls_piano' : editingSlot.instrument === 'Organ' ? 'cls_organ' : 'cls_guitar';
    const st = students.find((s) => s.id === studentId);
    if (st && (!st.enrolledClassIds || !st.enrolledClassIds.includes(classId))) {
      await saveStudent({
        ...st,
        enrolledClassIds: [...(st.enrolledClassIds || []), classId],
      });
    }

    refreshData();
    toast.success(`Đã thêm ${st?.fullName || 'học viên'} vào ${editingSlot.day} ca ${editingSlot.slot} · ${editingSlot.instrument}.`);
  };

  const handleRemoveStudentFromSlot = async (studentId: string) => {
    if (!editingSlot) return;
    const current = getEntry(editingSlot.day, editingSlot.slot, editingSlot.instrument);
    const st = students.find((s) => s.id === studentId);
    const ok = await confirm({
      title: 'Rút học viên khỏi ca học',
      message: `Rút ${st?.fullName || 'học viên này'} khỏi ${editingSlot.day} ca ${editingSlot.slot} · ${editingSlot.instrument}?\n\nHọc viên sẽ không còn xuất hiện ở điểm danh của ca này nữa.`,
      confirmText: 'Rút khỏi ca',
      cancelText: 'Hủy',
      variant: 'warning',
    });
    if (!ok) return;

    const updated: ScheduleEntry = {
      ...current,
      studentIds: current.studentIds.filter((id) => id !== studentId),
    };

    await saveScheduleEntry(updated);
    refreshData();
    toast.success(`Đã rút ${st?.fullName || 'học viên'} khỏi ca học.`);
  };

  const handleSaveTeacherForSlot = async (teacherId: string) => {
    if (!editingSlot) return;
    setSelectedTeacherId(teacherId);

    const current = getEntry(editingSlot.day, editingSlot.slot, editingSlot.instrument);
    const updated: ScheduleEntry = {
      ...current,
      teacherId,
    };

    await saveScheduleEntry(updated);
    refreshData();
  };

  // Color badges for instruments
  const instrumentColors: Record<Instrument, { bg: string; tag: string; border: string }> = {
    Piano: {
      bg: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
      tag: 'bg-blue-600 text-white',
      border: 'border-blue-500/20 hover:border-blue-500/40',
    },
    Organ: {
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
      tag: 'bg-emerald-600 text-white',
      border: 'border-emerald-500/20 hover:border-emerald-500/40',
    },
    Guitar: {
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
      tag: 'bg-amber-600 text-white',
      border: 'border-amber-500/20 hover:border-amber-500/40',
    },
  };

  /** Build the canonical shift id for the modal's currently-edited slot. */
  const editingShiftId = useMemo(
    () => (editingSlot ? buildShiftKey(editingSlot.day, editingSlot.slot, editingSlot.instrument) : ''),
    [editingSlot]
  );

  /** Check if the teacher currently selected in the modal actually covers
   *  the slot's instrument. Used to show a warning. */
  const selectedTeacherMismatch = useMemo(() => {
    if (!editingSlot || !selectedTeacherId) return false;
    const teacher = teachers.find((t) => t.id === selectedTeacherId);
    return !teacherCoversInstrument(teacher, editingSlot.instrument);
  }, [editingSlot, selectedTeacherId, teachers]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#141414] via-[#1a1712] to-[#141414] border border-[#b48648]/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-wide uppercase">Thời Khóa Biểu (TKB) Ca Học</h2>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#b48648]/20 text-[#b48648] border border-[#b48648]/30">
              Thứ 2 - Thứ 6 (17h - 20h)
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Mỗi ca học được định danh duy nhất bởi <b>Thứ · Giờ · Môn</b>. Hệ thống tự đồng bộ ID ca với module điểm danh — mọi thao tác chỉ chạm đúng một dòng dữ liệu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#b48648]" />
            <span>T2 - T6 | 4 Ca (17h, 18h, 19h, 20h)</span>
          </div>
        </div>
      </div>

      {/* Day Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
        {WORKING_DAYS.map((day) => {
          const isActive = activeDay === day;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                isActive
                  ? 'bg-[#b48648] text-black shadow-lg gold-btn-shadow scale-105'
                  : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{day}</span>
            </button>
          );
        })}
      </div>

      {/* Grid Matrix for Active Day */}
      <div className="space-y-6">
        {TIME_SLOTS.map((slot) => (
          <div key={slot} className="glass-panel rounded-2xl p-5 space-y-4">
            {/* Slot Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#b48648]/20 border border-[#b48648]/30 flex items-center justify-center text-[#b48648] font-mono font-bold text-sm">
                  {slot}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm uppercase tracking-wide">
                    {activeDay} - Ca {slot} ({slot === '17h' ? '17:00 - 18:00' : slot === '18h' ? '18:00 - 19:00' : slot === '19h' ? '19:00 - 20:00' : '20:00 - 21:00'})
                  </h3>
                  <p className="text-[11px] text-slate-400">Có sẵn các bộ môn: Piano, Organ và Guitar</p>
                </div>
              </div>

              <span className="text-[11px] text-slate-400 font-semibold bg-white/5 px-3 py-1 rounded-full border border-white/10">
                Ca học 60 phút
              </span>
            </div>

            {/* 3 Instruments Cards in Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {INSTRUMENTS.map((inst) => {
                const entry = getEntry(activeDay, slot, inst);
                const assignedTeacher = teachers.find((t) => t.id === entry.teacherId);
                const assignedStudents = students.filter((s) => entry.studentIds.includes(s.id));
                const colors = instrumentColors[inst];
                const teacherMismatch = !teacherCoversInstrument(assignedTeacher, inst);

                return (
                  <div
                    key={inst}
                    className={`bg-white/[0.03] border ${colors.border} rounded-xl p-4 space-y-3 flex flex-col justify-between transition-all`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Music className="w-4 h-4 text-[#b48648]" />
                          <span className="font-bold text-white text-sm">{inst}</span>
                        </div>

                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${colors.tag}`}>
                          {assignedStudents.length} Học Viên
                        </span>
                      </div>

                      {/* Teacher line */}
                      <div className="text-xs text-slate-300 flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
                        <span className="text-slate-400">Giáo Viên:</span>
                        <span className={`font-semibold ${teacherMismatch ? 'text-rose-400' : 'text-[#b48648]'}`}>
                          {assignedTeacher ? assignedTeacher.fullName : 'Chưa phân công'}
                        </span>
                      </div>

                      {teacherMismatch && (
                        <div className="flex items-start gap-1.5 text-[10px] text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-lg px-2 py-1.5">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>Giáo viên không dạy bộ môn này. Vui lòng đổi giáo viên.</span>
                        </div>
                      )}

                      {/* Student List in this Slot */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] text-slate-400 font-medium">Danh Sách Học Viên Trực Tiếp Ca {slot}:</div>
                        {assignedStudents.length === 0 ? (
                          <div className="text-[11px] text-slate-500 italic py-1">Chưa có học viên xếp vào ca này.</div>
                        ) : (
                          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                            {assignedStudents.map((st) => (
                              <div
                                key={st.id}
                                className="flex items-center justify-between bg-white/5 px-2.5 py-1 rounded-lg text-xs text-white border border-white/5"
                              >
                                <span className="font-medium truncate">{st.fullName}</span>
                                <span className="font-mono text-[10px] text-slate-400">{st.code}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenSlotModal(activeDay, slot, inst)}
                      className="w-full py-2 rounded-xl bg-white/10 hover:bg-[#b48648] hover:text-black text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all mt-2 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Xếp Học Viên / Đổi GV</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Slot Editing */}
      {editingSlot && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel border border-[#b48648]/40 rounded-3xl p-6 w-full max-w-xl space-y-5 relative shadow-2xl animate-fade-in">
            <button
              onClick={() => setEditingSlot(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-[#b48648]/20 text-[#b48648] font-mono text-xs font-bold border border-[#b48648]/30 uppercase">
                  {editingSlot.day} - Ca {editingSlot.slot}
                </span>
                <span className="font-bold text-white text-base">{editingSlot.instrument}</span>
                <span className="font-mono text-[10px] text-slate-500 break-all">ID: {editingShiftId}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Phân công giáo viên & xếp học viên trực tiếp vào ca học {editingSlot.instrument}. Mọi thay đổi sẽ đồng bộ realtime với module điểm danh.
              </p>
            </div>

            {/* Select Teacher */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Giáo Viên Đảm Nhận Ca Học:</label>
              <select
                value={selectedTeacherId}
                onChange={(e) => handleSaveTeacherForSlot(e.target.value)}
                className={`w-full bg-white/5 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none ${
                  selectedTeacherMismatch ? 'border-rose-500/60' : 'border-white/10 focus:border-[#b48648]'
                }`}
              >
                {teachers.map((t) => {
                  const covers = teacherCoversInstrument(t, editingSlot.instrument);
                  return (
                    <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                      {t.fullName} ({t.code} - Chuyên {t.instruments.join(', ')})
                      {!covers ? ' ⚠ không dạy môn này' : ''}
                    </option>
                  );
                })}
              </select>
              {selectedTeacherMismatch && (
                <div className="flex items-center gap-1.5 text-[11px] text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-lg px-2.5 py-1.5">
                  <AlertTriangle className="w-3 h-3" />
                  Giáo viên này không nằm trong danh sách chuyên môn {editingSlot.instrument}. Cân nhắc trước khi lưu.
                </div>
              )}
            </div>

            {/* Currently Assigned Students */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Học Viên Đã Xếp Ca ({getEntry(editingSlot.day, editingSlot.slot, editingSlot.instrument).studentIds.length}):
              </label>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {getEntry(editingSlot.day, editingSlot.slot, editingSlot.instrument).studentIds.map((stId) => {
                  const st = students.find((s) => s.id === stId);
                  if (!st) return null;
                  return (
                    <div
                      key={stId}
                      className="flex items-center justify-between bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-xs text-white"
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-[#b48648]" />
                        <span className="font-medium">{st.fullName}</span>
                        <span className="font-mono text-[10px] text-slate-400">({st.code})</span>
                      </div>

                      <button
                        onClick={() => handleRemoveStudentFromSlot(stId)}
                        className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/20"
                        title="Rút khỏi ca này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
                {getEntry(editingSlot.day, editingSlot.slot, editingSlot.instrument).studentIds.length === 0 && (
                  <div className="text-[11px] text-slate-500 italic py-2 text-center border border-dashed border-slate-700 rounded-lg">
                    Chưa có học viên nào. Tìm & thêm bên dưới.
                  </div>
                )}
              </div>
            </div>

            {/* Search & Add New Student */}
            <div className="space-y-2 border-t border-white/10 pt-3">
              <label className="block text-xs font-semibold text-slate-300">Thêm Học Viên Vào Ca Này:</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm tên hoặc mã học viên..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#b48648]"
                />
              </div>

              {(() => {
                const assignedSet = new Set(
                  getEntry(editingSlot.day, editingSlot.slot, editingSlot.instrument).studentIds
                );
                const candidates = students
                  .filter(
                    (s) =>
                      !assignedSet.has(s.id) &&
                      (studentSearch.trim() === '' ||
                        s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
                        s.code.toLowerCase().includes(studentSearch.toLowerCase()))
                  )
                  .slice(0, 30);
                if (candidates.length === 0) {
                  return (
                    <div className="text-[11px] text-slate-500 italic py-2 text-center border border-dashed border-slate-700 rounded-lg">
                      Không tìm thấy học viên phù hợp.
                    </div>
                  );
                }
                return (
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {candidates.map((st) => (
                      <div
                        key={st.id}
                        className="flex items-center justify-between bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl text-xs text-slate-200"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-white truncate">{st.fullName}</span>
                          <span className="text-[10px] text-slate-400 ml-2 font-mono">Mã: {st.code}</span>
                          {st.status !== 'Active' && (
                            <span className="text-[10px] text-amber-400 ml-2">({st.status})</span>
                          )}
                        </div>

                        <button
                          onClick={() => handleAddStudentToSlot(st.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#b48648] hover:bg-[#8a6331] text-black font-bold text-[11px] flex items-center gap-1 transition-all shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm</span>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                <Users className="w-3 h-3" />
                Ca sẽ lưu với ID: <span className="text-slate-300">{editingShiftId}</span>
              </div>
              <button
                onClick={() => setEditingSlot(null)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
