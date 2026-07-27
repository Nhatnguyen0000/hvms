import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getStudents,
  getClassGroups,
  getTeachers,
  getScheduleEntries,
  getAttendance,
  completeSessionAttendance,
  saveAttendanceRecord,
  subscribeDataChange,
  STORAGE_KEYS_INTERNAL,
} from '../lib/storage';

import { AttendanceStatus, AttendanceRecord, ScheduleEntry } from '../types';
import {
  WORKING_DAYS,
  TIME_SLOTS,
  Instrument,
  getDayOfWeekVN,
  parseDateString,
  buildSessionName,
  resolveRoster,
  findAttendanceRecord,
  computeShiftStats,
  findTeacher,
  buildShiftKey,
  buildShiftsForDate,
} from '../lib/scheduleService';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Sparkles,
  UserCheck,
  Filter,
  FileSpreadsheet,
  MessageSquare,
  AlertTriangle,
  CalendarOff,
  Users,
  QrCode,
} from 'lucide-react';
import { exportAttendanceCSV } from '../lib/csvExporter';
import { useToast, useConfirm } from './Toast';
import { QRScannerModal } from './QRScannerModal';

/**
 * AttendanceView — Điểm danh theo ngày hôm đó.
 *
 * Mỗi ngày học được dựng tự động từ 3 lớp cố định (Piano/Organ/Guitar):
 *  - Với ngày được chọn, tra cứu thứ trong tuần (T2..T6).
 *  - Lọc `classSessions` của 3 lớp theo thứ đó.
 *  - Mỗi session trở thành 1 ca học (ShiftEntry) với id bất biến
 *    `shift|{day}|{slot}|{instrument}`.
 *  - Học viên trong ca = các học viên đã được xếp vào lớp đó.
 *
 * Nhờ vậy operator không phải xếp ca thủ công trong TKB; kiểm thử điểm
 * danh ngày hôm nay chỉ cần chọn ngày = hôm nay, các ca học sẽ tự hiện
 * ra từ lịch tuần của lớp.
 */
export const AttendanceView: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Default to today's date if it's a working day, otherwise next Monday.
    const today = new Date();
    if (getDayOfWeekVN(today)) {
      return today.toISOString().slice(0, 10);
    }
    const d = new Date(today);
    d.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 1));
    return d.toISOString().slice(0, 10);
  });

  // Selected shift triple — drives the roster panel and persists across
  // refreshes thanks to its deterministic id.
  const [activeShift, setActiveShift] = useState<{
    day: string;
    slot: string;
    instrument: Instrument;
  } | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [qrScanLogs, setQrScanLogs] = useState<
    { id: string; timestamp: string; studentName: string; studentCode: string; shiftInfo: string }[]
  >([]);
  const toast = useToast();
  const confirm = useConfirm();

  const dayInfo = useMemo(() => {
    const date = parseDateString(selectedDate);
    const vn = getDayOfWeekVN(date);
    return { vn, isWorkingDay: vn !== null };
  }, [selectedDate]);

  // Refresh data on any storage change so the view always shows fresh state.
  useEffect(() => {
    const unsubscribe = subscribeDataChange((key) => {
      if (
        key === STORAGE_KEYS_INTERNAL.ATTENDANCE ||
        key === STORAGE_KEYS_INTERNAL.CLASSES ||
        key === STORAGE_KEYS_INTERNAL.STUDENTS ||
        key === STORAGE_KEYS_INTERNAL.SCHEDULE
      ) {
        setRefreshTrigger((p) => p + 1);
      }
    });
    return unsubscribe;
  }, []);

  const allStudents = useMemo(() => getStudents(), [refreshTrigger]);
  const classGroups = useMemo(() => getClassGroups(), [refreshTrigger]);
  const teachers = useMemo(() => getTeachers(), [refreshTrigger]);
  const allAttendance = useMemo(() => getAttendance(), [refreshTrigger]);
  const scheduleEntries = useMemo(() => getScheduleEntries(), [refreshTrigger]);

  // Build the list of shifts for the selected date. TKB entries take
  // priority over class-group sessions so that any student manually
  // assigned to a (day, slot, instrument) shift in ScheduleView shows
  // up here immediately — real-time, no manual reload.
  const shiftsForDate: ScheduleEntry[] = useMemo(() => {
    return buildShiftsForDate(selectedDate, classGroups, allStudents, scheduleEntries);
  }, [selectedDate, classGroups, allStudents, scheduleEntries]);

  // Auto-select the first shift of the day when none is active or the
  // active shift no longer applies (different day, removed entry, etc.).
  useEffect(() => {
    if (shiftsForDate.length === 0) {
      setActiveShift(null);
      return;
    }
    if (
      !activeShift ||
      !shiftsForDate.some(
        (s) =>
          s.dayOfWeek === activeShift.day &&
          s.timeSlot === activeShift.slot &&
          s.instrument === activeShift.instrument
      )
    ) {
      const first = shiftsForDate[0];
      setActiveShift({ day: first.dayOfWeek, slot: first.timeSlot, instrument: first.instrument });
    }
  }, [shiftsForDate, activeShift]);

  /** Use the active shift directly — it's already a complete ScheduleEntry
   *  resolved from the class group. */
  const activeShiftEntry = useMemo(() => {
    if (!activeShift) return undefined;
    return shiftsForDate.find(
      (s) =>
        s.dayOfWeek === activeShift.day &&
        s.timeSlot === activeShift.slot &&
        s.instrument === activeShift.instrument
    );
  }, [activeShift, shiftsForDate]);

  const activeShiftId = useMemo(
    () => (activeShift ? buildShiftKey(activeShift.day, activeShift.slot, activeShift.instrument) : ''),
    [activeShift]
  );

  const roster = useMemo(() => resolveRoster(activeShiftEntry, allStudents), [activeShiftEntry, allStudents]);
  const shiftTeacher = useMemo(
    () => findTeacher(teachers, activeShiftEntry?.teacherId),
    [teachers, activeShiftEntry]
  );
  const sessionName = useMemo(
    () =>
      activeShift
        ? buildSessionName(activeShift.day, activeShift.slot, activeShift.instrument, selectedDate)
        : '',
    [activeShift, selectedDate]
  );

  const stats = useMemo(
    () => computeShiftStats(activeShiftEntry, allAttendance, allStudents, selectedDate),
    [activeShiftEntry, allAttendance, allStudents, selectedDate]
  );

  const getRecord = useCallback(
    (studentId: string): AttendanceRecord | undefined =>
      findAttendanceRecord(allAttendance, activeShiftId, studentId, selectedDate),
    [allAttendance, activeShiftId, selectedDate]
  );

  const getStatus = useCallback(
    (studentId: string): AttendanceStatus => getRecord(studentId)?.status ?? 'Pending',
    [getRecord]
  );

  const getNotes = useCallback(
    (studentId: string): string => getRecord(studentId)?.notes || '',
    [getRecord]
  );

  const handleMarkStatus = useCallback(
    async (studentId: string, status: AttendanceStatus, notes?: string) => {
      if (!activeShift) return;
      const existing = getRecord(studentId);

      // Bug C fix: confirm when marking Unexcused (silent destructive op).
      if (status === 'Unexcused' && existing?.status !== 'Unexcused') {
        const ok = await confirm({
          title: 'Đánh dấu vắng KHÔNG PHÉP',
          message: 'Hành động này sẽ được ghi vào nhật ký hệ thống và ảnh hưởng đến thống kê chuyên cần.\n\nBạn có chắc chắn?',
          confirmText: 'Đồng ý đánh dấu',
          cancelText: 'Hủy',
          variant: 'danger',
        });
        if (!ok) return;
      }

      // Bug E fix: clamp notes to 200 chars and trim.
      const cleanedNotes = (notes ?? existing?.notes ?? '').toString().trim().slice(0, 200);

      // Bug F fix: short-circuit when nothing actually changed — saves a
      // write, audit log entry and Supabase round-trip.
      if (existing && existing.status === status && (existing.notes || '') === cleanedNotes) {
        return;
      }

      const record: AttendanceRecord = {
        id:
          existing?.id ??
          `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${studentId}`,
        sessionId: activeShiftId,
        classGroupId: activeShiftEntry?.classGroupId ?? activeShiftId, // Bug A fix
        learnDate: selectedDate,
        sessionName,
        studentId,
        status,
        notes: cleanedNotes,
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      };
      await saveAttendanceRecord(record);
      setRefreshTrigger((p) => p + 1);
    },
    [activeShift, activeShiftId, activeShiftEntry, getRecord, selectedDate, sessionName, confirm]
  );

  const handleUpdateNotes = useCallback(
    (studentId: string, notes: string) => {
      const cur = getStatus(studentId);
      void handleMarkStatus(studentId, cur, notes);
    },
    [getStatus, handleMarkStatus]
  );

  const handleCompleteShiftAuto = useCallback(async () => {
    if (!activeShift) return;
    if (roster.length === 0) {
      toast.warning('Ca học này chưa có học viên nào. Vui lòng xếp học viên vào ca trước.');
      return;
    }
    const pending = roster.filter((s) => getStatus(s.id) === 'Pending').length;
    // Bug D fix: confirm the implicit default-to-Present behavior.
    if (pending > 0) {
      const ok = await confirm({
        title: 'Lưu & Ghi nhận ca học',
        message: `Còn ${pending} học viên chưa được điểm danh.\n\n✔ Đồng ý = mặc định CÓ MẶT cho tất cả học viên chưa tick.\n✖ Hủy = quay lại điểm danh thủ công trước.`,
        confirmText: 'Đồng ý lưu',
        cancelText: 'Hủy',
        variant: 'warning',
      });
      if (!ok) return;
    }

    const recordsToComplete = roster.map((s) => {
      const curStatus = getStatus(s.id);
      const curNotes = getNotes(s.id);
      const finalStatus: 'Present' | 'Excused' | 'Unexcused' =
        curStatus === 'Pending' ? 'Present' : curStatus;
      return { studentId: s.id, status: finalStatus, notes: curNotes };
    });

    await completeSessionAttendance(activeShiftId, selectedDate, sessionName, recordsToComplete);
    toast.success(
      `Đã lưu điểm danh Ca ${activeShift.slot} · ${activeShift.instrument} (${activeShift.day}). ${recordsToComplete.length} học viên, mặc định chưa chọn = Có Mặt.`
    );
    setRefreshTrigger((p) => p + 1);
  }, [activeShift, roster, getStatus, getNotes, activeShiftId, selectedDate, sessionName, toast, confirm]);

  const handleExportCSV = useCallback(() => {
    if (!activeShift || !activeShiftEntry) {
      toast.warning('Vui lòng chọn ca học trước khi xuất CSV.');
      return;
    }
    if (roster.length === 0) {
      toast.warning('Ca học này chưa có học viên — không thể xuất CSV.');
      return; // Bug H fix: don't generate an empty file
    }
    try {
      exportAttendanceCSV(activeShiftEntry, selectedDate, roster, allAttendance, shiftTeacher);
      toast.success(
        `Đã xuất CSV Ca ${activeShift.slot} · ${activeShift.instrument} · ${activeShift.day} (${selectedDate}).`
      );
    } catch (err: any) {
      toast.error(`Lỗi khi xuất file CSV: ${err.message || 'Lỗi hệ thống'}`);
    }
  }, [activeShift, activeShiftEntry, roster, allAttendance, shiftTeacher, selectedDate]);

  const handleGoToToday = useCallback(() => {
    const today = new Date();
    setSelectedDate(today.toISOString().slice(0, 10));
  }, []);

  const dateLabel = dayInfo.isWorkingDay ? dayInfo.vn : 'Cuối tuần';
  const headerDayLabel = dayInfo.isWorkingDay ? dateLabel : `Cuối tuần (${selectedDate})`;
  const isToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return selectedDate === today;
  }, [selectedDate]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div>
          <div className="flex items-center gap-2 text-[#b48648] text-xs font-bold uppercase tracking-wider mb-1">
            <Clock className="w-4 h-4 text-[#b48648]" />
            <span>ĐIỂM DANH THEO NGÀY HÔM ĐÓ</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Điểm Danh · {headerDayLabel}
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Ca học = <b>(Thứ · Giờ · Môn)</b>. Hệ thống ưu tiên danh sách từ <b>Thời Khóa Biểu</b> (TKB);
            chỉ khi TKB chưa có sẽ fallback về lịch tuần của lớp. Thêm HV vào TKB → Điểm danh cập nhật ngay.
          </p>
          {activeShift && (
            <div className="mt-2 inline-flex items-center gap-2 text-[10px] text-slate-500 font-mono">
              <span>Session ID:</span>
              <span className="text-slate-300">{activeShiftId}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsQRScannerOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all active:scale-95 border border-amber-300"
            title="Quét thẻ QR học viên để tự động điểm danh"
          >
            <QrCode className="w-4 h-4 text-slate-950" />
            <span>Quét Mã QR Điểm Danh</span>
          </button>

          <button
            onClick={handleGoToToday}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 flex items-center gap-2 transition-all"
            title="Quay lại ngày hôm nay"
          >
            <Clock className="w-4 h-4 text-[#b48648]" />
            <span>Hôm Nay</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!dayInfo.isWorkingDay || !activeShift}
            className="px-4 py-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Xuất File CSV điểm danh mở thẳng bằng Microsoft Excel hoặc Google Sheets"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Xuất File CSV Điểm Danh</span>
          </button>

          <button
            onClick={handleCompleteShiftAuto}
            disabled={!dayInfo.isWorkingDay || !activeShift || roster.length === 0}
            className="px-4 py-2.5 rounded-xl bg-[#b48648] hover:bg-amber-600 text-black font-extrabold text-xs shadow-lg shadow-amber-600/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            <span>Lưu & Ghi Nhận (1-Click)</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3.5 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-[#b48648] font-medium flex items-center justify-between shadow-lg">
          <span>{msg}</span>
          <button
            onClick={() => setMsg(null)}
            className="text-slate-400 hover:text-white font-bold text-xs px-2 py-0.5 rounded bg-slate-700"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Weekend warning */}
      {!dayInfo.isWorkingDay && (
        <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-2xl text-amber-200 text-sm flex items-start gap-3">
          <CalendarOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-300 mb-0.5">Ngày {selectedDate} không thuộc lịch học trong tuần</div>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              Trung tâm chỉ mở ca từ Thứ 2 đến Thứ 6. Bấm <b>"Hôm Nay"</b> để chuyển về ngày làm việc gần nhất.
            </p>
          </div>
        </div>
      )}

      {/* Date & Day Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <label className="text-xs font-bold text-slate-300 uppercase shrink-0">Ngày Điểm Danh:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-[#b48648]"
          />
          <span
            className={`px-3 py-1 rounded-lg text-xs font-bold border ${
              isToday
                ? 'bg-[#b48648] text-black border-[#b48648] animate-pulse'
                : dayInfo.isWorkingDay
                ? 'bg-[#b48648]/15 text-[#b48648] border-[#b48648]/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {isToday ? `${dateLabel} · HÔM NAY` : dateLabel}
          </span>
          {isToday && (
            <span className="text-[10px] text-emerald-400 font-bold uppercase">
              ◉ Đang điểm danh ngày hôm nay
            </span>
          )}
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-3 bg-slate-800/80 p-2 rounded-xl border border-slate-700 text-xs w-full md:w-auto justify-around">
          <div className="px-3 text-center">
            <span className="text-[10px] text-slate-400 uppercase block">Có Mặt</span>
            <span className="font-extrabold text-emerald-400 text-sm">{stats.present}</span>
          </div>
          <div className="px-3 text-center border-x border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase block">Vắng Phép</span>
            <span className="font-extrabold text-amber-400 text-sm">{stats.excused}</span>
          </div>
          <div className="px-3 text-center border-r border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase block">Vắng K.Phép</span>
            <span className="font-extrabold text-rose-400 text-sm">{stats.unexcused}</span>
          </div>
          <div className="px-3 text-center">
            <span className="text-[10px] text-slate-400 uppercase block">Chưa Đ.Danh</span>
            <span className="font-extrabold text-slate-400 text-sm">{stats.pending}</span>
          </div>
        </div>
      </div>

      {/* Shifts Selector Grid — rendered per (day, slot, instrument) */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#b48648]" />
            <span>
              CA HỌC NGÀY {dateLabel.toUpperCase()} · {selectedDate} ({shiftsForDate.length} ca)
            </span>
          </div>
          {dayInfo.isWorkingDay && shiftsForDate.length > 0 && (
            <span className="text-[11px] text-[#b48648] font-bold">
              TKB + lịch tuần lớp học
            </span>
          )}
        </div>

        {shiftsForDate.length === 0 ? (
          <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400 space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-bold text-slate-200">
              {dayInfo.isWorkingDay
                ? `Ngày ${dateLabel} không có ca học nào được mở trong lịch tuần của 3 lớp.`
                : 'Ngày cuối tuần — trung tâm không mở ca.'}
            </p>
            <p className="texttext-xs">
              Vào <b>Thời Khóa Biểu</b> để thêm học viên vào từng ca (Piano / Organ / Guitar theo từng Thứ · Giờ).
              Hoặc tick chọn ca học trong lớp tại <b>Môn Học & Lớp Học</b>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {shiftsForDate.map((shift) => {
              const isActive =
                activeShift !== null &&
                shift.dayOfWeek === activeShift.day &&
                shift.timeSlot === activeShift.slot &&
                shift.instrument === activeShift.instrument;
              return (
                <button
                  key={shift.id}
                  onClick={() =>
                    setActiveShift({
                      day: shift.dayOfWeek,
                      slot: shift.timeSlot,
                      instrument: shift.instrument,
                    })
                  }
                  className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                    isActive
                      ? 'bg-[#b48648]/20 border-[#b48648] text-white shadow-lg shadow-amber-600/10'
                      : 'bg-slate-900 border-slate-700 hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-slate-800 text-[#b48648] border border-[#b48648]/30">
                      {shift.timeSlot}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {shift.instrument}
                    </span>
                  </div>

                  <div className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    <span>{shift.dayOfWeek}</span>
                    <span>·</span>
                    <span className="text-slate-300 truncate">{shift.room || 'Phòng học'}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                    <span>
                      Sĩ số: <strong className="text-amber-300">{shift.studentIds.length} HV</strong>
                    </span>
                    {isToday && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                        Hôm Nay
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Attendance Roster for Selected Shift */}
      {activeShift && activeShiftEntry && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-5 bg-slate-800/80 border-b border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-white text-base flex items-center gap-2 flex-wrap">
                <UserCheck className="w-5 h-5 text-[#b48648]" />
                <span>
                  Bảng Điểm Danh · {activeShift.day} · Ca {activeShift.slot} · {activeShift.instrument}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">({activeShiftId})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Phòng học:{' '}
                <span className="text-slate-200 font-semibold">
                  {activeShiftEntry.room || 'Phòng Âm Nhạc'}
                </span>{' '}
                · Giáo viên:{' '}
                <span className="text-[#b48648] font-bold">
                  {shiftTeacher?.fullName || 'Chưa phân công'}
                </span>{' '}
                · Ngày:{' '}
                <span className="text-white font-semibold">
                  {selectedDate}
                  {isToday && <span className="text-emerald-400 ml-1">(Hôm Nay)</span>}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                Sĩ số ca: <strong className="text-white">{roster.length} học viên</strong>
              </span>
            </div>
          </div>

          {/* Roster Table List */}
          <div className="divide-y divide-slate-800">
            {roster.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-amber-400" />
                <p className="text-sm font-bold text-slate-200">
                  Ca {activeShift.slot} · {activeShift.instrument} chưa có học viên nào.
                </p>
                <p className="text-xs">
                  Vào <b>Thời Khóa Biểu</b> và chọn ca <b>{activeShift.slot} · {activeShift.instrument}</b>{' '}
                  để thêm học viên. Danh sách sẽ tự cập nhật ở đây ngay.
                </p>
              </div>
            ) : (
              roster
                .filter((student) => student.status === 'Active' || student.status === 'Reserved') // Bug I fix
                .map((student, idx) => {
                const status = getStatus(student.id);
                const notes = getNotes(student.id);
                return (
                  <div
                    key={student.id}
                    className="p-4 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-800/40 transition-all"
                  >
                    {/* Student Info */}
                    <div className="flex items-center gap-3 min-w-[240px]">
                      <span className="text-xs font-mono font-bold text-slate-500 w-5">
                        {(idx + 1).toString().padStart(2, '0')}
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#b48648]/20 to-amber-600/10 border border-[#b48648]/30 flex items-center justify-center shrink-0">
                        <span className="text-[#b48648] font-bold text-xs tracking-tight">
                          {student.fullName.split(' ').pop()?.slice(0, 2).toUpperCase() || 'HV'}
                        </span>
                      </div>

                      <div>
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          <span>{student.fullName}</span>
                          <span className="font-mono text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20">
                            {student.code}
                          </span>
                          {student.status !== 'Active' && (
                            <span className="text-[10px] text-amber-400 font-semibold">
                              ({student.status === 'Reserved' ? 'Bảo lưu' : 'Nghỉ'})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          SĐT: {student.phone || 'Chưa cập nhật'}
                        </div>
                      </div>
                    </div>

                    {/* Notes Input */}
                    <div className="flex-1 max-w-xs relative">
                      <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-700/80 focus-within:border-[#b48648] rounded-xl px-2.5 py-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => handleUpdateNotes(student.id, e.target.value)}
                          placeholder="Ghi chú (trễ, lý do nghỉ...)"
                          className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-500"
                        />
                      </div>
                    </div>

                    {/* Status Toggle Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleMarkStatus(student.id, 'Present')}
                        title="Học viên có mặt tại ca học"
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                          status === 'Present'
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Có Mặt</span>
                      </button>

                      <button
                        onClick={() => handleMarkStatus(student.id, 'Excused')}
                        title="Vắng có lý do — học phí vẫn tính (mặc định). Có thể đổi trong Cài đặt."
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                          status === 'Excused'
                            ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Vắng Phép</span>
                      </button>

                      <button
                        onClick={() => handleMarkStatus(student.id, 'Unexcused')}
                        title="Vắng KHÔNG phép — sẽ hiện confirm trước khi lưu. Hành vi nghiêm trọng."
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                          status === 'Unexcused'
                            ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Vắng K.Phép</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Footer safety net: when no shift is active at all */}
      {!activeShift && shiftsForDate.length > 0 && (
        <div className="p-6 bg-slate-900/70 border border-slate-800 rounded-2xl text-center text-slate-400 text-sm">
          <AlertTriangle className="w-6 h-6 mx-auto text-amber-400 mb-2" />
          Đang chờ bạn chọn một ca học ở danh sách phía trên để bắt đầu điểm danh.
        </div>
      )}

      {/* QR Scan Log Stream */}
      {qrScanLogs.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-amber-300 uppercase">
            <div className="flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>Nhật Ký Quét QR Điểm Danh Trong Ngày ({qrScanLogs.length})</span>
            </div>
            <button
              onClick={() => setQrScanLogs([])}
              className="text-[10px] text-slate-400 hover:text-white"
            >
              Xóa nhật ký
            </button>
          </div>

          <div className="divide-y divide-slate-800 text-xs font-mono">
            {qrScanLogs.map((log) => (
              <div key={log.id} className="py-1.5 flex items-center justify-between text-slate-300">
                <div>
                  <span className="text-emerald-400 font-bold">[{log.timestamp}]</span>{' '}
                  <span className="font-bold text-white">{log.studentName}</span>{' '}
                  <span className="text-indigo-400">({log.studentCode})</span>
                </div>
                <div className="text-slate-400 text-[11px] font-sans">{log.shiftInfo}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {isQRScannerOpen && (
        <QRScannerModal
          onClose={() => setIsQRScannerOpen(false)}
          onScanStudent={async (student) => {
            const timeStr = new Date().toLocaleTimeString('vi-VN');
            void handleMarkStatus(student.id, 'Present');
            const shiftLabel = activeShift
              ? `Ca ${activeShift.slot} · ${activeShift.instrument}`
              : 'Ca học trong ngày';
            setQrScanLogs((prev) => [
              {
                id: `qrlog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                timestamp: timeStr,
                studentName: student.fullName,
                studentCode: student.code,
                shiftInfo: shiftLabel,
              },
              ...prev,
            ]);
            toast.success(`✅ ĐÃ ĐIỂM DANH: ${student.fullName} (${student.code}) -> CÓ MẶT`);
          }}
        />
      )}
    </div>
  );
};
