import { ScheduleEntry, Student, Teacher, AttendanceRecord, AttendanceStatus, ClassGroup } from '../types';

/**
 * Schedule Service — single source of truth for "what is a class shift".
 *
 * The core invariant: a shift is uniquely identified by the tuple
 * (dayOfWeek, timeSlot, instrument). A stable string ID is derived from
 * this tuple so attendance records, schedule entries, and CSV exports all
 * refer to the same logical entity across renders, devices, and users.
 *
 * Previous implementation generated IDs containing `Date.now()`, which
 * produced non-deterministic IDs and led to duplicate ScheduleEntry rows
 * for the same shift (Risk R1 in the audit). All UI and storage layers
 * must go through this service to avoid that drift.
 */

export const WEEKDAY_VN = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'] as const;
export type WeekdayVN = (typeof WEEKDAY_VN)[number];

export const TIME_SLOTS = ['17h', '18h', '19h', '20h'] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

export const INSTRUMENTS = ['Piano', 'Organ', 'Guitar'] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

/** Working days only — mirrors the TKB UI and prevents accidental T7/CN shifts. */
export const WORKING_DAYS: WeekdayVN[] = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];

/**
 * Stable, URL-safe identifier for a shift. Derived only from the
 * triple (day, timeSlot, instrument) so two computations of the same shift
 * always agree. Format: `shift|{daySlug}|{slot}|{instrumentLower}`.
 */
export function buildShiftKey(dayOfWeek: string, timeSlot: string, instrument: string): string {
  const daySlug = dayOfWeek
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const slotSlug = timeSlot.toLowerCase().replace(/\s+/g, '');
  const instSlug = instrument.toLowerCase();
  return `shift|${daySlug}|${slotSlug}|${instSlug}`;
}

/** Human-readable label for a shift, used everywhere the UI surfaces a shift. */
export function buildShiftLabel(
  dayOfWeek: string,
  timeSlot: string,
  instrument: string,
  dateStr?: string
): string {
  const dateSuffix = dateStr ? ` · ${dateStr}` : '';
  return `${dayOfWeek} ${timeSlot} · ${instrument}${dateSuffix}`;
}

/**
 * Map a JS Date.getDay() (0=Sun..6=Sat) to a Vietnamese weekday label.
 * Returns null for Sun because the TKB only operates on weekdays.
 */
export function getDayOfWeekVN(date: Date): WeekdayVN | null {
  const idx = date.getDay();
  if (idx === 0 || idx === 6) return null; // Sunday or Saturday → not in TKB
  return WEEKDAY_VN[idx] as WeekdayVN;
}

export function parseDateString(dateStr: string): Date {
  // Treat YYYY-MM-DD as a local date to avoid TZ off-by-one.
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Returns the canonical, deterministic ID for a shift triple. All
 * ScheduleEntry and AttendanceRecord rows that share a triple should
 * share this ID.
 */
export function shiftId(dayOfWeek: string, timeSlot: string, instrument: string): string {
  return buildShiftKey(dayOfWeek, timeSlot, instrument);
}

/**
 * Return a placeholder ScheduleEntry for the triple. Used by the UI to
 * render a shift card before any data has been persisted. The ID is
 * deterministic and matches the persisted entry once one exists.
 */
export function makeEmptyShift(
  dayOfWeek: string,
  timeSlot: string,
  instrument: string,
  fallbackTeacherId: string
): ScheduleEntry {
  return {
    id: shiftId(dayOfWeek, timeSlot, instrument),
    dayOfWeek,
    timeSlot,
    instrument: instrument as Instrument,
    studentIds: [],
    teacherId: fallbackTeacherId,
    room: `Phòng ${instrument} 1`,
  };
}

/**
 * De-duplicate a list of ScheduleEntry against the canonical shift key.
 * If duplicates exist (data imported from an older session), the entry
 * with the largest studentIds array wins because it represents the most
 * accumulated history. Persisted results should overwrite storage to
 * collapse duplicates.
 */
export function dedupeShifts(entries: ScheduleEntry[]): ScheduleEntry[] {
  const map = new Map<string, ScheduleEntry>();
  for (const e of entries) {
    const key = buildShiftKey(e.dayOfWeek, e.timeSlot, e.instrument);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, e);
      continue;
    }
    const winner =
      e.studentIds.length >= existing.studentIds.length ? e : existing;
    map.set(key, winner);
  }
  return Array.from(map.values());
}

/** Validation: does the teacher cover the instrument? Used to surface
 *  misconfiguration when assigning a teacher to a shift in ScheduleView. */
export function teacherCoversInstrument(teacher: Teacher | undefined, instrument: string): boolean {
  if (!teacher) return false;
  return teacher.instruments.includes(instrument as Instrument);
}

/** Build a deterministic sessionName for an attendance session. Format is
 *  identical regardless of who creates the row, which makes audit log
 *  search reliable. */
export function buildSessionName(
  dayOfWeek: string,
  timeSlot: string,
  instrument: string,
  dateStr: string
): string {
  return `Ca ${timeSlot} · ${instrument} · ${dayOfWeek} (${dateStr})`;
}

/**
 * Resolve the roster of students assigned to a shift. Normalizes the
 * older "may contain student codes" quirk by mapping any non-ID
 * references back to a Student.id when possible. Returns the IDs in
 * their persisted order so the UI shows a stable list.
 */
export function resolveRosterIds(shift: ScheduleEntry | undefined, allStudents: Student[]): string[] {
  if (!shift) return [];
  const idByCode = new Map(allStudents.map((s) => [s.code, s.id]));
  return shift.studentIds
    .map((ref) => (allStudents.some((s) => s.id === ref) ? ref : idByCode.get(ref) || ref))
    .filter((id, idx, arr) => arr.indexOf(id) === idx); // dedupe
}

/** Helper: build the full Student array for a shift's roster. */
export function resolveRoster(shift: ScheduleEntry | undefined, allStudents: Student[]): Student[] {
  const ids = resolveRosterIds(shift, allStudents);
  const byId = new Map(allStudents.map((s) => [s.id, s]));
  return ids.map((id) => byId.get(id)).filter((s): s is Student => Boolean(s));
}

/** Get the attendance record for a (shift, student, date) triple, or undefined. */
export function findAttendanceRecord(
  records: AttendanceRecord[],
  sessionId: string,
  studentId: string,
  dateStr: string
): AttendanceRecord | undefined {
  return records.find(
    (r) => r.sessionId === sessionId && r.studentId === studentId && r.learnDate === dateStr
  );
}

/** Aggregate attendance counts for a single shift on a given date. */
export interface ShiftAttendanceStats {
  total: number;
  present: number;
  excused: number;
  unexcused: number;
  pending: number;
}

export function computeShiftStats(
  shift: ScheduleEntry | undefined,
  records: AttendanceRecord[],
  allStudents: Student[],
  dateStr: string
): ShiftAttendanceStats {
  const roster = resolveRoster(shift, allStudents);
  if (roster.length === 0 || !shift) {
    return { total: 0, present: 0, excused: 0, unexcused: 0, pending: 0 };
  }
  const sessionId = shift.id;
  let present = 0;
  let excused = 0;
  let unexcused = 0;
  let pending = 0;
  for (const student of roster) {
    const rec = findAttendanceRecord(records, sessionId, student.id, dateStr);
    const status: AttendanceStatus = rec ? rec.status : 'Pending';
    if (status === 'Present') present += 1;
    else if (status === 'Excused') excused += 1;
    else if (status === 'Unexcused') unexcused += 1;
    else pending += 1;
  }
  return { total: roster.length, present, excused, unexcused, pending };
}

/** Get a teacher by id with safe fallback. */
export function findTeacher(teachers: Teacher[], teacherId?: string): Teacher | undefined {
  if (!teacherId) return undefined;
  return teachers.find((t) => t.id === teacherId);
}

/**
 * Resolve the weekly class sessions for a class group. Always returns
 * concrete entries in the shape `{ dayOfWeek, timeSlot }`. Falls back to
 * the legacy `scheduleDays` + `timeSlot` pair when the modern field is
 * empty, so old data renders correctly.
 */
export function getClassSessions(cls: ClassGroup | undefined): Array<{ dayOfWeek: string; timeSlot: string }> {
  if (!cls) return [];
  if (cls.classSessions && cls.classSessions.length > 0) {
    return cls.classSessions.map((s) => ({ dayOfWeek: s.dayOfWeek, timeSlot: s.timeSlot }));
  }
  const days = cls.scheduleDays || [];
  const timeSlot = cls.timeSlot || '17h';
  return days.map((d) => ({ dayOfWeek: d, timeSlot }));
}

/**
 * Normalize a list of (day, time) pairs into a stable, sorted grid:
 *  - de-duplicated
 *  - ordered by day-of-week (Thứ 2 → Thứ 6)
 *  - within the same day, ordered by timeSlot (17h → 18h → 19h → 20h)
 */
export function normalizeClassSessions(
  sessions: Array<{ dayOfWeek: string; timeSlot: string }>
): Array<{ dayOfWeek: string; timeSlot: string }> {
  const seen = new Set<string>();
  const out: Array<{ dayOfWeek: string; timeSlot: string }> = [];
  for (const s of sessions) {
    const key = `${s.dayOfWeek}|${s.timeSlot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.sort((a, b) => {
    const dayCmp = WORKING_DAYS.indexOf(a.dayOfWeek as never) - WORKING_DAYS.indexOf(b.dayOfWeek as never);
    if (dayCmp !== 0) return dayCmp;
    return TIME_SLOTS.indexOf(a.timeSlot as never) - TIME_SLOTS.indexOf(b.timeSlot as never);
  });
}

/**
 * Build a 2D lookup of day -> timeSlot -> boolean for fast rendering in
 * the class modal grid.
 */
export function buildSessionsGrid(
  sessions: Array<{ dayOfWeek: string; timeSlot: string }>
): Record<string, Record<string, boolean>> {
  const grid: Record<string, Record<string, boolean>> = {};
  for (const day of WORKING_DAYS) {
    grid[day] = {} as Record<string, boolean>;
    for (const slot of TIME_SLOTS) {
      grid[day][slot] = false;
    }
  }
  for (const s of sessions) {
    if (grid[s.dayOfWeek]) {
      grid[s.dayOfWeek][s.timeSlot] = true;
    }
  }
  return grid;
}

/** Total number of weekly sessions for a class. */
export function countWeeklySessions(cls: ClassGroup | undefined): number {
  return getClassSessions(cls).length;
}

/**
 * Map a `ClassGroup` to its corresponding instrument. The mapping is
 * deterministic and based on the convention used by the seed data
 * (cls_piano → Piano, cls_organ → Organ, cls_guitar → Guitar). Falls
 * back to matching the courseId against the well-known crs_piano/organ/
 * guitar taxonomy. Returns undefined for classes that don't correspond
 * to any of the three instruments.
 */
export function classGroupToInstrument(cls: ClassGroup | undefined): Instrument | undefined {
  if (!cls) return undefined;
  const id = cls.id.toLowerCase();
  if (id.includes('piano')) return 'Piano';
  if (id.includes('organ')) return 'Organ';
  if (id.includes('guitar')) return 'Guitar';
  const courseId = cls.courseId.toLowerCase();
  if (courseId.includes('piano')) return 'Piano';
  if (courseId.includes('organ')) return 'Organ';
  if (courseId.includes('guitar')) return 'Guitar';
  return undefined;
}

/**
 * Build a synchronous, in-memory `ScheduleEntry` for a given class session
 * (ClassGroup × dayOfWeek × timeSlot). The entry is *not* persisted to
 * TKB storage — it's a virtual representation so the attendance view can
 * render a shift for today/this date without requiring the operator to
 * have manually created every (day, slot, instrument) tuple in TKB.
 *
 * Required behavior:
 *  - id is deterministic and matches `buildShiftKey` so attendance
 *    records already saved under the canonical key continue to display.
 *  - studentIds is the union of all students enrolled in the class group.
 *  - room and teacherId are inherited from the class group.
 */
export function buildShiftFromSession(
  cls: ClassGroup,
  session: { dayOfWeek: string; timeSlot: string },
  enrolledStudentIds: string[]
): ScheduleEntry {
  const instrument = classGroupToInstrument(cls) || 'Piano';
  return {
    id: buildShiftKey(session.dayOfWeek, session.timeSlot, instrument),
    dayOfWeek: session.dayOfWeek,
    timeSlot: session.timeSlot,
    instrument,
    studentIds: enrolledStudentIds,
    teacherId: cls.teacherId,
    room: cls.room,
    classGroupId: cls.id,
  };
}

/**
 * Build the full list of shift cards for a given calendar date.
 *
 * Data source priority (each step falls back to the next when empty):
 *  1. **ScheduleEntry rows from TKB** — what the operator manually
 *     assigned to a (day, slot, instrument) shift in ScheduleView. This
 *     is the source of truth when the operator has set up the weekly
 *     roster directly per shift.
 *  2. **3 fixed class groups (Piano / Organ / Guitar)** — used as a
 *     gentle fallback when no TKB shift exists for that triple. The
 *     roster of a class is the union of all students enrolled in it.
 *
 * The two sources are merged by shift key (day + slot + instrument).
 * A TKB-driven shift wins over a class-driven one because it represents
 * a more specific intent (e.g. "Piano 19h on Tuesday only has these 3
 * HV, not all 12 enrolled in the Piano class").
 *
 * Returns an empty array if the date is not a working day (T7/CN).
 */
export function buildShiftsForDate(
  dateStr: string,
  classes: ClassGroup[],
  students: Student[],
  scheduleEntries?: ScheduleEntry[]
): ScheduleEntry[] {
  const date = new Date(dateStr + 'T00:00:00');
  const vn = getDayOfWeekVN(date);
  if (!vn) return [];

  // Index TKB shifts by canonical key so we can look them up quickly.
  const tkbByKey = new Map<string, ScheduleEntry>();
  if (scheduleEntries && scheduleEntries.length > 0) {
    for (const entry of scheduleEntries) {
      if (entry.dayOfWeek !== vn) continue;
      const key = buildShiftKey(entry.dayOfWeek, entry.timeSlot, entry.instrument);
      const existing = tkbByKey.get(key);
      // Prefer the entry with the most students (most recent history).
      if (!existing || entry.studentIds.length >= existing.studentIds.length) {
        tkbByKey.set(key, entry);
      }
    }
  }

  // Build class-driven shifts as fallback with empty roster for unassigned shifts.
  const fixedIds = ['cls_piano', 'cls_organ', 'cls_guitar'];
  const fixedClasses = classes.filter((c) => fixedIds.includes(c.id));

  const classByKey = new Map<string, ScheduleEntry>();
  for (const cls of fixedClasses) {
    const sessions = getClassSessions(cls).filter((s) => s.dayOfWeek === vn);
    for (const session of sessions) {
      const shift = buildShiftFromSession(cls, session, []);
      const key = buildShiftKey(shift.dayOfWeek, shift.timeSlot, shift.instrument);
      classByKey.set(key, shift);
    }
  }

  // Merge: TKB entries win; class entries fill the gaps.
  const merged = new Map<string, ScheduleEntry>();
  for (const [key, shift] of classByKey.entries()) merged.set(key, shift);
  for (const [key, shift] of tkbByKey.entries()) merged.set(key, shift);

  return Array.from(merged.values()).sort((a, b) => {
    const slotCmp = TIME_SLOTS.indexOf(a.timeSlot as never) - TIME_SLOTS.indexOf(b.timeSlot as never);
    if (slotCmp !== 0) return slotCmp;
    return INSTRUMENTS.indexOf(a.instrument as never) - INSTRUMENTS.indexOf(b.instrument as never);
  });
}
