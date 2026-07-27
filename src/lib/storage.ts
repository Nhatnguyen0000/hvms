import {
  Student,
  Teacher,
  Course,
  ClassGroup,
  ScheduleEntry,
  TuitionTransaction,
  AttendanceRecord,
  AuditLog,
  User,
  PaymentMethod,
  Invoice,
  Payment,
  InvoiceStatus,
} from '../types';

import {
  INITIAL_STUDENTS,
  INITIAL_TEACHERS,
  INITIAL_COURSES,
  INITIAL_CLASSES,
  INITIAL_TRANSACTIONS,
  INITIAL_ATTENDANCE,
  INITIAL_AUDIT_LOGS,
  INITIAL_USERS,
  INITIAL_SCHEDULE_ENTRIES,
} from './initialData';

import { computeTransactionSecurity, rehashTransaction } from './cryptoEngine';
import { getSupabaseClient } from './supabase';
import { secureStorage } from './secureStorage';
import { buildShiftKey, dedupeShifts } from './scheduleService';

const STORAGE_KEYS = {
  STUDENTS: 'allegro_students',
  TEACHERS: 'allegro_teachers',
  COURSES: 'allegro_courses',
  CLASSES: 'allegro_classes',
  SCHEDULE: 'allegro_schedule_entries',
  TRANSACTIONS: 'allegro_transactions',
  INVOICES: 'allegro_invoices',
  PAYMENTS: 'allegro_payments',
  ATTENDANCE: 'allegro_attendance',
  AUDIT_LOGS: 'allegro_audit_logs',
  CURRENT_USER: 'allegro_current_user',
} as const;

// Re-export the storage keys for views that need to subscribe to data
// changes for a specific key. Using a separate export name keeps the raw
// string map internal-only.
export const STORAGE_KEYS_INTERNAL = STORAGE_KEYS;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

const SENSITIVE_KEYS: StorageKey[] = [
  STORAGE_KEYS.STUDENTS,
  STORAGE_KEYS.TEACHERS,
  STORAGE_KEYS.TRANSACTIONS,
  STORAGE_KEYS.INVOICES,
  STORAGE_KEYS.PAYMENTS,
  STORAGE_KEYS.AUDIT_LOGS,
  STORAGE_KEYS.CURRENT_USER,
  STORAGE_KEYS.ATTENDANCE,
  STORAGE_KEYS.CLASSES,
  // BUGFIX: these two were missing, which meant migrateToEncryptedStorage()
  // never rehydrated them from encrypted storage on boot. Writes via
  // saveScheduleEntry()/saveCourse() were persisted correctly to
  // localStorage["enc_..."], but every reload silently fell back to the
  // seed defaults (INITIAL_SCHEDULE_ENTRIES / INITIAL_COURSES) because the
  // in-memory cache was never repopulated from the encrypted copy. This is
  // what made students just assigned to a shift in the schedule appear to
  // "vanish" after a page reload — the data was never actually lost.
  STORAGE_KEYS.SCHEDULE,
  STORAGE_KEYS.COURSES,
];

// In-memory cache of decrypted payloads. The cache is the single source of
// truth for synchronous reads after boot. Writes flush to the encrypted
// backing store via secureStorage.setItem and then update the cache.
const memoryCache = new Map<StorageKey, unknown>();

// Tracks which keys have been hydrated from encrypted storage. Until a key
// is hydrated, reads fall back to the provided default value.
const hydratedKeys = new Set<StorageKey>();

// Allows components to subscribe to data changes so views that don't own
// the data (e.g. TuitionView when a payment is created from a global modal)
// can refresh themselves without coupling to the storage layer.
type DataChangeListener = (key: StorageKey) => void;
const dataChangeListeners = new Set<DataChangeListener>();

export function subscribeDataChange(listener: DataChangeListener): () => void {
  dataChangeListeners.add(listener);
  return () => dataChangeListeners.delete(listener);
}

function notifyDataChange(key: StorageKey): void {
  dataChangeListeners.forEach((l) => {
    try {
      l(key);
    } catch (err) {
      console.warn('dataChangeListener failed:', err);
    }
  });
}

/**
 * Hydrate the in-memory cache from encrypted storage. Must be called once
 * before any synchronous read is performed. Falls back to plain localStorage
 * for the first run (before migration) and then to seed defaults.
 */
export async function migrateToEncryptedStorage(): Promise<void> {
  for (const key of SENSITIVE_KEYS) {
    await readFromSecure(key);
  }
}

/**
 * Internal read: pulls encrypted value (or plain fallback) into memoryCache
 * and returns the cached value. Subsequent reads are served from memory.
 */
async function readFromSecure<T>(key: StorageKey): Promise<T> {
  const value = await secureStorage.getItem<T>(key, undefined as unknown as T);
  // secureStorage.getItem returns the default (undefined cast) when nothing
  // exists; callers should provide the seed default via getItem().
  if (value !== undefined && value !== null) {
    memoryCache.set(key, value);
    // BUGFIX (defensive): a component may have already rendered with the
    // synchronous fallback (plain localStorage / seed default) before this
    // hydration finished — e.g. a lazy view mounted right as the app
    // booted. Without this notification, that component would keep
    // showing stale/empty data until some unrelated write happened to
    // touch the same key. Firing the same event used for writes lets any
    // subscribed view (ScheduleView, AttendanceView, TuitionView, ...)
    // self-heal as soon as the real decrypted data is available.
    notifyDataChange(key);
  }
  hydratedKeys.add(key);
  return value as T;
}

function getItem<T>(key: StorageKey, defaultValue: T): T {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }
  // First synchronous read before hydration is complete. We must serve
  // something sensible so the UI can render. Read from plain localStorage
  // (legacy data) and seed the cache. The async hydration will overwrite
  // it once it completes.
  if (typeof window !== 'undefined' && window.localStorage) {
    const plain = localStorage.getItem(key);
    if (plain) {
      try {
        const parsed = JSON.parse(plain) as T;
        memoryCache.set(key, parsed);
        return parsed;
      } catch {
        // fall through to default
      }
    }
  }
  memoryCache.set(key, defaultValue);
  return defaultValue;
}

async function setItem<T>(key: StorageKey, value: T): Promise<void> {
  memoryCache.set(key, value);
  hydratedKeys.add(key);
  try {
    await secureStorage.setItem(key, value);
  } catch (err) {
    console.error(`Error writing ${key} to encrypted storage:`, err);
  }
  notifyDataChange(key);
}

// User Auth State — Note: all sensitive keys are now encrypted. The current
// user is stored encrypted but read synchronously after hydration.
export function getCurrentUser(): User {
  return getItem<User>(STORAGE_KEYS.CURRENT_USER, INITIAL_USERS[0]);
}

export async function setCurrentUser(user: User): Promise<void> {
  await setItem(STORAGE_KEYS.CURRENT_USER, user);
}

// Students CRUD
export function getStudents(): Student[] {
  return getItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
}

export async function saveStudent(student: Student): Promise<Student> {
  const students = getStudents();
  const existingIdx = students.findIndex((s) => s.id === student.id);

  let updated: Student[];
  if (existingIdx >= 0) {
    students[existingIdx] = student;
    updated = [...students];
  } else {
    updated = [student, ...students];
  }

  await setItem(STORAGE_KEYS.STUDENTS, updated);
  addAuditLog(
    getCurrentUser().fullName,
    existingIdx >= 0 ? 'UPDATE_STUDENT' : 'CREATE_STUDENT',
    `Cập nhật/Thêm mới học viên ${student.code} - ${student.fullName}`
  );
  syncDataToSupabase('students', student);
  return student;
}

export async function deleteStudent(id: string): Promise<void> {
  const students = getStudents().filter((s) => s.id !== id);
  await setItem(STORAGE_KEYS.STUDENTS, students);
  addAuditLog(getCurrentUser().fullName, 'DELETE_STUDENT', `Xóa hồ sơ học viên ID: ${id}`);

  const supabase = getSupabaseClient();
  if (supabase) {
    supabase.from('students').delete().eq('id', id).then();
  }
}

// Teachers CRUD
export function getTeachers(): Teacher[] {
  return getItem<Teacher[]>(STORAGE_KEYS.TEACHERS, INITIAL_TEACHERS);
}

export async function saveTeacher(teacher: Teacher): Promise<Teacher> {
  const teachers = getTeachers();
  const idx = teachers.findIndex((t) => t.id === teacher.id);
  let updated: Teacher[];
  if (idx >= 0) {
    teachers[idx] = teacher;
    updated = [...teachers];
  } else {
    updated = [teacher, ...teachers];
  }
  await setItem(STORAGE_KEYS.TEACHERS, updated);
  addAuditLog(
    getCurrentUser().fullName,
    idx >= 0 ? 'UPDATE_TEACHER' : 'CREATE_TEACHER',
    `Cập nhật/Thêm giáo viên ${teacher.code} - ${teacher.fullName}`
  );
  syncDataToSupabase('teachers', teacher);
  return teacher;
}

// Courses & Class Groups CRUD
export function getCourses(): Course[] {
  return getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
}

export async function saveCourse(course: Course): Promise<Course> {
  const courses = getCourses();
  const idx = courses.findIndex((c) => c.id === course.id);
  let updated: Course[];
  if (idx >= 0) {
    courses[idx] = course;
    updated = [...courses];
  } else {
    updated = [course, ...courses];
  }
  await setItem(STORAGE_KEYS.COURSES, updated);
  syncDataToSupabase('courses', course);
  return course;
}

export function getClassGroups(): ClassGroup[] {
  const stored = getItem<ClassGroup[]>(STORAGE_KEYS.CLASSES, INITIAL_CLASSES);
  // Always guarantee the 3 fixed classes (Piano/Organ/Guitar) exist and
  // are never deleted. Custom classes persisted in earlier sessions are
  // kept for backward compatibility but cannot be added to anymore.
  const fixedIds = ['cls_piano', 'cls_organ', 'cls_guitar'];
  const fixedMap = new Map(
    INITIAL_CLASSES.filter((c) => fixedIds.includes(c.id)).map((c) => [c.id, c])
  );
  // Preserve overridden fields (teacherId, maxStudents) on fixed classes
  // if the user has edited them.
  const mergedFixed = fixedIds.map((id) => {
    const storedItem = stored.find((c) => c.id === id);
    return storedItem ? { ...fixedMap.get(id)!, ...storedItem, id } : fixedMap.get(id)!;
  });
  const custom = stored.filter((c) => !fixedIds.includes(c.id));
  return [...mergedFixed, ...custom];
}

/**
 * Get the current enrollment count for a class group.
 */
export function getClassEnrollmentCount(classGroupId: string): number {
  const students = getStudents();
  return students.filter((s) => s.enrolledClassIds.includes(classGroupId)).length;
}

/**
 * Check if a class group has capacity for more students.
 * Returns { hasCapacity: boolean; current: number; max: number; message: string }
 */
export function checkClassCapacity(
  classGroupId: string,
  newStudentCount: number = 1
): { hasCapacity: boolean; current: number; max: number; message: string } {
  const cls = getClassGroups().find((c) => c.id === classGroupId);
  if (!cls) {
    return { hasCapacity: false, current: 0, max: 0, message: 'Lớp học không tồn tại' };
  }
  const current = getClassEnrollmentCount(classGroupId);
  const max = cls.maxStudents;
  const hasCapacity = current + newStudentCount <= max;
  const message = hasCapacity
    ? `Lớp ${cls.name} hiện có ${current}/${max} học viên - còn ${max - current} chỗ trống`
    : `Lớp ${cls.name} đã đầy (${current}/${max}). Không thể thêm học viên.`;
  return { hasCapacity, current, max, message };
}

/**
 * Validate if a student can be enrolled in specific class groups.
 * Returns array of validation results for each class group.
 */
export function validateStudentClassEnrollment(
  studentId: string,
  classGroupIds: string[]
): { classId: string; className: string; isValid: boolean; message: string }[] {
  const students = getStudents();
  const student = students.find((s) => s.id === studentId);
  const existingClassIds = student?.enrolledClassIds || [];

  return classGroupIds.map((classId) => {
    const isAlreadyEnrolled = existingClassIds.includes(classId);
    const isAdding = !isAlreadyEnrolled;
    const capacity = checkClassCapacity(classId, isAdding ? 1 : 0);
    const cls = getClassGroups().find((c) => c.id === classId);

    if (!isAdding) {
      return { classId, className: cls?.name || classId, isValid: true, message: 'Đã đăng ký' };
    }
    if (!capacity.hasCapacity) {
      return { classId, className: cls?.name || classId, isValid: false, message: capacity.message };
    }
    return { classId, className: cls?.name || classId, isValid: true, message: capacity.message };
  });
}

export async function saveClassGroup(classGroup: ClassGroup): Promise<ClassGroup> {
  const classes = getClassGroups();
  const fixedIds = ['cls_piano', 'cls_organ', 'cls_guitar'];
  const isFixed = fixedIds.includes(classGroup.id);

  // Normalize: enforce the single-room rule on fixed classes, and
  // convert any legacy (scheduleDays, timeSlot) pair into the modern
  // classSessions grid before saving.
  const sessionFromLegacy =
    classGroup.classSessions && classGroup.classSessions.length > 0
      ? classGroup.classSessions
      : (classGroup.scheduleDays || []).map((d) => ({
        dayOfWeek: d,
        timeSlot: classGroup.timeSlot || '17h',
      }));

  const normalized: ClassGroup = isFixed
    ? {
      ...classGroup,
      room: 'PHÒNG TRUNG TÂM',
      classSessions: sessionFromLegacy,
    }
    : {
      ...classGroup,
      classSessions: sessionFromLegacy,
    };

  const idx = classes.findIndex((c) => c.id === normalized.id);
  let updated: ClassGroup[];
  if (idx >= 0) {
    classes[idx] = normalized;
    updated = [...classes];
  } else {
    updated = [normalized, ...classes];
  }

  await setItem(STORAGE_KEYS.CLASSES, updated);
  addAuditLog(
    getCurrentUser().fullName,
    idx >= 0 ? 'UPDATE_CLASS' : 'CREATE_CLASS',
    `Lớp học ${normalized.code} - ${normalized.name} (Phòng: ${normalized.room}) | ${normalized.classSessions.length} ca/tuần`
  );
  syncDataToSupabase('class_groups', normalized);
  return normalized;
}

export async function deleteClassGroup(classGroupId: string): Promise<boolean> {
  const fixedIds = ['cls_piano', 'cls_organ', 'cls_guitar'];
  if (fixedIds.includes(classGroupId)) {
    return false; // Cannot delete fixed classes
  }
  const classes = getClassGroups();
  const target = classes.find((c) => c.id === classGroupId);
  if (!target) return false;
  const updated = classes.filter((c) => c.id !== classGroupId);
  await setItem(STORAGE_KEYS.CLASSES, updated);
  addAuditLog(
    getCurrentUser().fullName,
    'DELETE_CLASS',
    `Đã xoá lớp học ${target.code} - ${target.name}`
  );
  return true;
}

// Schedule Entries CRUD (TKB 17h, 18h, 19h, 20h - Piano, Organ, Guitar)
export function getScheduleEntries(): ScheduleEntry[] {
  const raw = getItem<ScheduleEntry[]>(STORAGE_KEYS.SCHEDULE, INITIAL_SCHEDULE_ENTRIES);
  return dedupeShifts(raw);
}

/**
 * Upsert a ScheduleEntry by its canonical (day, slot, instrument) key.
 * The persisted id is always the deterministic shiftKey, so re-saving
 * the same shift from any view collapses to a single row and the
 * attendance records (which reference the same id) keep working.
 */
export async function saveScheduleEntry(entry: ScheduleEntry): Promise<ScheduleEntry> {
  const entries = getScheduleEntries();
  const canonicalId = buildShiftKey(entry.dayOfWeek, entry.timeSlot, entry.instrument);
  const normalized: ScheduleEntry = { ...entry, id: canonicalId };

  const idx = entries.findIndex(
    (e) => buildShiftKey(e.dayOfWeek, e.timeSlot, e.instrument) === canonicalId
  );

  let updated: ScheduleEntry[];
  if (idx >= 0) {
    entries[idx] = normalized;
    updated = [...entries];
  } else {
    updated = [...entries, normalized];
  }

  await setItem(STORAGE_KEYS.SCHEDULE, updated);
  syncDataToSupabase('schedule_entries', normalized);
  return normalized;
}

export async function saveAllScheduleEntries(updatedEntries: ScheduleEntry[]): Promise<void> {
  const normalized = updatedEntries.map((e) => ({
    ...e,
    id: buildShiftKey(e.dayOfWeek, e.timeSlot, e.instrument),
  }));
  const deduped = dedupeShifts(normalized);
  await setItem(STORAGE_KEYS.SCHEDULE, deduped);
  for (const entry of deduped) {
    syncDataToSupabase('schedule_entries', entry);
  }
}

// Helper function to automatically sync record changes to Supabase in background
async function syncDataToSupabase(tableName: string, record: any): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    let dbRecord: any = { ...record };
    if (tableName === 'students') {
      dbRecord = {
        id: record.id,
        code: record.code,
        full_name: record.fullName,
        date_of_birth: record.dateOfBirth ?? null,
        gender: record.gender,
        phone: record.phone,
        email: record.email ?? null,
        address: record.address ?? null,
        parent_name: record.parentName ?? null,
        parent_phone: record.parentPhone ?? null,
        status: record.status,
        join_date: record.joinDate,
        notes: record.notes,
        enrolled_class_ids: record.enrolledClassIds || [],
        avatar_url: record.avatarUrl,
      };
    } else if (tableName === 'teachers') {
      dbRecord = {
        id: record.id,
        code: record.code,
        full_name: record.fullName,
        phone: record.phone,
        email: record.email,
        instruments: record.instruments || [],
        status: record.status,
        avatar_url: record.avatarUrl,
        bio: record.bio,
      };
    } else if (tableName === 'courses') {
      dbRecord = {
        id: record.id,
        code: record.code,
        name: record.name,
        duration_months: record.durationMonths,
        total_sessions: record.totalSessions,
        reference_fee: record.referenceFee,
        description: record.description,
        color: record.color,
      };
    } else if (tableName === 'class_groups') {
      dbRecord = {
        id: record.id,
        code: record.code,
        name: record.name,
        course_id: record.courseId,
        teacher_id: record.teacherId,
        room: record.room,
        schedule_days: record.scheduleDays || [],
        time_slot: record.timeSlot,
        max_students: record.maxStudents,
      };
    } else if (tableName === 'schedule_entries') {
      dbRecord = {
        id: record.id,
        day_of_week: record.dayOfWeek,
        time_slot: record.timeSlot,
        instrument: record.instrument,
        student_ids: record.studentIds || [],
        teacher_id: record.teacherId,
        room: record.room,
      };
    } else if (tableName === 'tuition_transactions') {
      dbRecord = {
        id: record.id,
        invoice_number: record.invoiceNumber,
        student_id: record.studentId,
        student_name: record.studentName,
        amount: record.amount,
        payment_date: record.paymentDate,
        payment_method: record.paymentMethod,
        period: record.period,
        collector_name: record.collectorName,
        notes: record.notes,
        is_voided: record.isVoided,
        voided_at: record.voidedAt,
        void_reason: record.voidReason,
        printed_at: record.printedAt,
        sequence_number: record.sequenceNumber,
        previous_hash: record.previousHash,
        integrity_hash: record.integrityHash,
        digital_signature: record.digitalSignature,
      };
    } else if (tableName === 'attendance_records') {
      dbRecord = {
        id: record.id,
        session_id: record.sessionId || record.classGroupId,
        class_group_id: record.classGroupId, // legacy
        learn_date: record.learnDate,
        session_name: record.sessionName,
        student_id: record.studentId,
        status: record.status,
        notes: record.notes,
        updated_at: record.updatedAt,
      };
    } else if (tableName === 'audit_logs') {
      dbRecord = {
        id: record.id,
        timestamp: record.timestamp,
        user_name: record.userName,
        action: record.action,
        details: record.details,
      };
    }

    await supabase.from(tableName).upsert(dbRecord);
  } catch (err) {
    console.warn(`Supabase auto-sync failed for ${tableName}:`, err);
  }
}

// Synchronize connected Supabase DB on app boot
export async function initSupabaseDataSync(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    // 1. Fetch Students
    const { data: studentsData } = await supabase.from('students').select('*');
    if (studentsData && studentsData.length > 0) {
      const parsedStudents: Student[] = studentsData.map((s: any) => ({
        id: s.id,
        code: s.code,
        fullName: s.full_name,
        dateOfBirth: s.date_of_birth,
        gender: s.gender,
        phone: s.phone,
        email: s.email,
        address: s.address,
        parentName: s.parent_name,
        parentPhone: s.parent_phone,
        status: s.status,
        joinDate: s.join_date,
        notes: s.notes,
        enrolledClassIds: s.enrolled_class_ids || [],
        avatarUrl: s.avatar_url,
      }));
      await setItem(STORAGE_KEYS.STUDENTS, parsedStudents);
    } else {
      const current = getStudents();
      for (const s of current) await syncDataToSupabase('students', s);
    }

    // 2. Fetch Teachers
    const { data: teachersData } = await supabase.from('teachers').select('*');
    if (teachersData && teachersData.length > 0) {
      const parsedTeachers: Teacher[] = teachersData.map((t: any) => ({
        id: t.id,
        code: t.code,
        fullName: t.full_name,
        phone: t.phone,
        email: t.email,
        instruments: t.instruments || [],
        status: t.status,
        avatarUrl: t.avatar_url,
        bio: t.bio,
      }));
      await setItem(STORAGE_KEYS.TEACHERS, parsedTeachers);
    } else {
      const current = getTeachers();
      for (const t of current) await syncDataToSupabase('teachers', t);
    }

    // 3. Fetch Transactions
    const { data: txData } = await supabase.from('tuition_transactions').select('*');
    if (txData && txData.length > 0) {
      const parsedTxs: TuitionTransaction[] = txData.map((t: any) => ({
        id: t.id,
        invoiceNumber: t.invoice_number,
        studentId: t.student_id,
        studentName: t.student_name,
        amount: Number(t.amount),
        paymentDate: t.payment_date,
        paymentMethod: t.payment_method,
        period: t.period,
        collectorName: t.collector_name,
        notes: t.notes,
        isVoided: Boolean(t.is_voided),
        voidedAt: t.voided_at,
        voidReason: t.void_reason,
        printedAt: t.printed_at,
        sequenceNumber: Number(t.sequence_number),
        previousHash: t.previous_hash,
        integrityHash: t.integrity_hash,
        digitalSignature: t.digital_signature,
      }));
      await setItem(STORAGE_KEYS.TRANSACTIONS, parsedTxs);
    } else {
      const current = getTuitionTransactions();
      for (const tx of current) await syncDataToSupabase('tuition_transactions', tx);
    }
  } catch (e) {
    console.warn('Supabase initial fetch sync:', e);
  }
}

// Tuition Calculation Engine (Fixing Issue #3 from Report: Sums ALL enrolled courses)
export function getExpectedTuitionFee(studentId: string): {
  totalExpectedFee: number;
  courseBreakdown: { courseName: string; className: string; fee: number }[];
} {
  const student = getStudents().find((s) => s.id === studentId);
  if (!student) {
    return { totalExpectedFee: 0, courseBreakdown: [] };
  }

  const classGroups = getClassGroups();
  const courses = getCourses();

  let totalExpectedFee = 0;
  const courseBreakdown: { courseName: string; className: string; fee: number }[] = [];

  if (student.enrolledClassIds && student.enrolledClassIds.length > 0) {
    student.enrolledClassIds.forEach((classId) => {
      const cls = classGroups.find((c) => c.id === classId);
      if (cls) {
        const crs = courses.find((c) => c.id === cls.courseId);
        const fee = crs ? crs.referenceFee : 450000;
        totalExpectedFee += fee;
        courseBreakdown.push({
          courseName: crs ? crs.name : 'Khóa học',
          className: cls.name,
          fee,
        });
      }
    });
  }

  // If no enrolled classes yet, but student is Active, default to Piano fee (450,000 VND)
  if (courseBreakdown.length === 0 && student.status === 'Active') {
    const pianoCrs = courses.find((c) => c.id === 'crs_piano') || courses[0];
    const defaultFee = pianoCrs ? pianoCrs.referenceFee : 450000;
    totalExpectedFee = defaultFee;
    courseBreakdown.push({
      courseName: pianoCrs ? pianoCrs.name : 'Piano',
      className: 'Lớp Khóa Học Chưa Xếp',
      fee: defaultFee,
    });
  }

  return { totalExpectedFee, courseBreakdown };
}

export function getStudentTuitionSummary(studentId: string): {
  totalExpectedFee: number;
  totalPaid: number;
  remainingAmount: number;
  courseBreakdown: { courseName: string; className: string; fee: number }[];
  transactions: TuitionTransaction[];
} {
  const { totalExpectedFee, courseBreakdown } = getExpectedTuitionFee(studentId);
  const transactions = getTuitionTransactions().filter(
    (t) => t.studentId === studentId && !t.isVoided
  );

  const totalPaid = transactions.reduce((sum, t) => sum + t.amount, 0);
  const remainingAmount = Math.max(0, totalExpectedFee - totalPaid);

  return {
    totalExpectedFee,
    totalPaid,
    remainingAmount,
    courseBreakdown,
    transactions,
  };
}

// Tuition Transactions CRUD with Hash Chain
export function getTuitionTransactions(): TuitionTransaction[] {
  return getItem<TuitionTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
}

// =====================================================================
// New billing domain: Invoices + Payments
// =====================================================================

export function getInvoices(): Invoice[] {
  return getItem<Invoice[]>(STORAGE_KEYS.INVOICES, []);
}

export function getInvoice(invoiceId: string): Invoice | undefined {
  return getInvoices().find((i) => i.id === invoiceId);
}

export async function saveInvoice(invoice: Invoice): Promise<Invoice> {
  const invoices = getInvoices();
  const idx = invoices.findIndex((i) => i.id === invoice.id);
  const updated = idx >= 0 ? (() => { const next = [...invoices]; next[idx] = invoice; return next; })() : [invoice, ...invoices];
  await setItem(STORAGE_KEYS.INVOICES, updated);
  syncDataToSupabase('invoices', invoice);
  return invoice;
}

export function getPayments(): Payment[] {
  return getItem<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
}

export function getPaymentsByInvoice(invoiceId: string): Payment[] {
  return getPayments().filter((p) => p.invoiceId === invoiceId);
}

export async function savePayment(payment: Payment): Promise<Payment> {
  const payments = getPayments();
  const idx = payments.findIndex((p) => p.id === payment.id);
  const updated = idx >= 0 ? (() => { const next = [...payments]; next[idx] = payment; return next; })() : [payment, ...payments];
  await setItem(STORAGE_KEYS.PAYMENTS, updated);
  syncDataToSupabase('payments', payment);
  return payment;
}

/**
 * Format a Date as `YYYY-MM-DD HH:mm:ss` in local time, used for all
 * payment / void / printed timestamps in the system so reports show
 * the operator's wall clock.
 */
export function formatDateTimeLocal(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  const hh = d.getHours().toString().padStart(2, '0');
  const mi = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

/**
 * Format a Date as `YYYY-MM-DD`.
 */
export function formatDateLocal(d: Date = new Date()): string {
  return formatDateTimeLocal(d).slice(0, 10);
}

/**
 * Generate a monotonic sequence number that is collision-resistant even
 * when two payment actions run in the same millisecond (e.g. multiple tabs
 * or a fast double-click). Combines wall-clock and a per-session counter.
 */
function nextSequenceNumber(): number {
  const base = Date.now() * 1000; // microsecond resolution
  // Random suffix keeps uniqueness across tabs without coordination.
  const rand = Math.floor(Math.random() * 1000);
  return base + rand;
}

/**
 * Invoice number = PT-YYYY-MM-XXXX. Uses the highest known sequence as
 * the canonical counter to avoid the month-count race condition that
 * plagued the legacy implementation (two tabs reading the same list
 * could both pick the next slot).
 */
function nextInvoiceNumber(prefix: 'PT' | 'BL', existing: string[]): string {
  const now = new Date();
  const monthPrefix = `${prefix}-${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-`;
  const sameMonth = existing.filter((n) => n.startsWith(monthPrefix));
  // Strip the prefix and parse the trailing number
  const max = sameMonth.reduce((acc, n) => {
    const tail = n.slice(monthPrefix.length);
    const num = parseInt(tail, 10);
    return Number.isFinite(num) && num > acc ? num : acc;
  }, 0);
  return `${monthPrefix}${(max + 1).toString().padStart(4, '0')}`;
}

export async function recordPayment(params: {
  studentId: string;
  studentName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  period: string;
  notes?: string;
}): Promise<TuitionTransaction> {
  const transactions = getTuitionTransactions();
  const currentUser = getCurrentUser();

  // Find latest sequence & hash
  const sorted = [...transactions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const lastTx = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  // Use a collision-resistant monotonic sequence. If by rare chance the
  // generated sequence collides with an existing one (e.g. clock skew), bump
  // it past the largest known sequence so uniqueness is guaranteed.
  let sequenceNumber = nextSequenceNumber();
  const usedSeq = new Set(sorted.map((t) => t.sequenceNumber));
  while (usedSeq.has(sequenceNumber)) {
    sequenceNumber += 1;
  }

  const previousHash = lastTx ? lastTx.integrityHash : '0000000000000000000000000000000000000000000000000000000000000000';

  // Generate invoice number — month-scoped counter so the printed label stays
  // short and human-readable (BL-YYYY-MM-XXXX) while the chain sequence
  // remains globally unique.
  const now = new Date();
  const yearStr = now.getFullYear();
  const monthStr = (now.getMonth() + 1).toString().padStart(2, '0');
  const monthPrefix = `BL-${yearStr}-${monthStr}-`;
  const monthCount = sorted.filter((t) => t.invoiceNumber.startsWith(monthPrefix)).length;
  const seqStr = (monthCount + 1).toString().padStart(4, '0');
  const invoiceNumber = `${monthPrefix}${seqStr}`;

  const paymentDate = `${yearStr}-${monthStr}-${now.getDate().toString().padStart(2, '0')} ${now
    .getHours()
    .toString()
    .padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

  const txData = {
    previousHash,
    invoiceNumber,
    studentId: params.studentId,
    amount: params.amount,
    paymentDate,
    sequenceNumber,
  };

  const { integrityHash, digitalSignature } = await computeTransactionSecurity(txData);

  const newTx: TuitionTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    invoiceNumber,
    studentId: params.studentId,
    studentName: params.studentName,
    amount: params.amount,
    paymentDate,
    paymentMethod: params.paymentMethod,
    period: params.period,
    collectorName: currentUser.fullName,
    notes: params.notes,
    isVoided: false,
    sequenceNumber,
    previousHash,
    integrityHash,
    digitalSignature,
  };

  const updatedTransactions = [...transactions, newTx];
  await setItem(STORAGE_KEYS.TRANSACTIONS, updatedTransactions);

  addAuditLog(
    currentUser.fullName,
    'RECORD_PAYMENT',
    `Lập biên lai ${newTx.invoiceNumber} số tiền ${params.amount.toLocaleString('vi-VN')}đ cho ${params.studentName}. Hash: ${integrityHash.slice(0, 8)}...`
  );

  syncDataToSupabase('tuition_transactions', newTx);

  return newTx;
}

// =====================================================================
// New recordPayment (V2): writes to Payment + Invoice, fixes over-payment
// and chain race conditions.
// =====================================================================

export interface RecordPaymentV2Params {
  invoiceId: string;
  studentId: string;
  studentName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  period?: string;
  notes?: string;
  bankReference?: string;
  vietQRPayload?: string;
  /** Allow the payment to exceed remaining (credit / over-pay). */
  allowOverPayment?: boolean;
}

export interface RecordPaymentV2Result {
  payment: Payment;
  invoice: Invoice;
}

/**
 * Record a payment against an invoice. This is the new canonical entry
 * point for tuition receipts going forward.
 *
 * Fixes over the legacy implementation:
 *  - Validates amount > 0 and (by default) amount <= invoice remaining.
 *  - Updates invoice.status automatically (Partial / Paid).
 *  - Receipt number is derived from the highest known sequence, not
 *    from a month-count that could race across tabs.
 *  - Hash chain is built from the new Payment[] stream; legacy chain
 *    continues independently on `tuition_transactions`.
 */
export async function recordPaymentV2(params: RecordPaymentV2Params): Promise<RecordPaymentV2Result> {
  const invoice = getInvoice(params.invoiceId);
  if (!invoice) throw new Error('Không tìm thấy hóa đơn');
  if (params.amount <= 0) throw new Error('Số tiền phải lớn hơn 0');
  if (invoice.status === 'Voided') throw new Error('Hóa đơn đã bị hủy, không thể thu');

  const remaining = invoice.totalAmount - invoice.paidAmount;
  if (!params.allowOverPayment && params.amount > remaining + 1) {
    throw new Error(
      `Số tiền thu (${params.amount.toLocaleString('vi-VN')}đ) vượt quá số còn nợ (${remaining.toLocaleString(
        'vi-VN'
      )}đ). Vui lòng tick "Cho phép nộp dư" nếu muốn ghi nhận credit.`
    );
  }

  const payments = getPayments();
  const sorted = [...payments].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const lastPayment = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  let sequenceNumber = nextSequenceNumber();
  const usedSeq = new Set(sorted.map((p) => p.sequenceNumber));
  while (usedSeq.has(sequenceNumber)) sequenceNumber += 1;

  const previousHash = lastPayment
    ? lastPayment.integrityHash
    : '0000000000000000000000000000000000000000000000000000000000000000';

  const receiptNumber = nextInvoiceNumber('BL', payments.map((p) => p.receiptNumber));
  const paymentDate = formatDateTimeLocal();

  const hashInput = {
    previousHash,
    invoiceNumber: receiptNumber,
    studentId: params.studentId,
    amount: params.amount,
    paymentDate,
    sequenceNumber,
  };
  const { integrityHash, digitalSignature } = await computeTransactionSecurity(hashInput);

  const payment: Payment = {
    id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    receiptNumber,
    invoiceId: invoice.id,
    studentId: params.studentId,
    studentName: params.studentName,
    amount: params.amount,
    paymentDate,
    paymentMethod: params.paymentMethod,
    bankReference: params.bankReference,
    vietQRPayload: params.vietQRPayload,
    collectorName: getCurrentUser().fullName,
    notes: params.notes ?? params.period,
    isVoided: false,
    sequenceNumber,
    previousHash,
    integrityHash,
    digitalSignature,
  };

  // Compute new invoice totals
  const newPaidAmount = invoice.paidAmount + params.amount;
  let newStatus: InvoiceStatus = invoice.status;
  if (newPaidAmount >= invoice.totalAmount - 1) newStatus = 'Paid';
  else if (newPaidAmount > 0) newStatus = 'Partial';
  if (invoice.status === 'Issued' && newStatus === 'Partial') newStatus = 'Partial';

  const updatedInvoice: Invoice = {
    ...invoice,
    paidAmount: newPaidAmount,
    status: newStatus,
  };

  await savePayment(payment);
  await saveInvoice(updatedInvoice);

  addAuditLog(
    getCurrentUser().fullName,
    'RECORD_PAYMENT',
    `Thu ${params.amount.toLocaleString('vi-VN')}đ từ ${params.studentName} (HĐ ${invoice.invoiceNumber}, BL ${receiptNumber}). Hash: ${integrityHash.slice(0, 8)}...`
  );

  return { payment, invoice: updatedInvoice };
}

// Void metadata is excluded from the hash input, so voiding alone does NOT
// invalidate the chain. The chain only protects immutable financial fields.
export async function voidTransaction(id: string, reason: string): Promise<TuitionTransaction> {
  const transactions = getTuitionTransactions();
  const idx = transactions.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error('Không tìm thấy biên lai');

  const now = new Date();
  const voidedAt = formatDateTimeLocal(now);

  const tx = transactions[idx];
  const updatedTx: TuitionTransaction = {
    ...tx,
    isVoided: true,
    voidedAt,
    voidReason: reason,
  };

  const newTransactions = [...transactions];
  newTransactions[idx] = updatedTx;
  await setItem(STORAGE_KEYS.TRANSACTIONS, newTransactions);

  addAuditLog(
    getCurrentUser().fullName,
    'VOID_PAYMENT',
    `HỦY biên lai ${tx.invoiceNumber} (Học viên: ${tx.studentName}). Lý do: ${reason}.`
  );

  // Sync to Supabase so void state is preserved across devices.
  syncDataToSupabase('tuition_transactions', updatedTx);

  return updatedTx;
}

/**
 * Void a Payment (V2). Rolls back the invoice's paidAmount and status.
 */
export async function voidPayment(paymentId: string, reason: string): Promise<Payment> {
  const payments = getPayments();
  const idx = payments.findIndex((p) => p.id === paymentId);
  if (idx === -1) throw new Error('Không tìm thấy biên lai');

  const payment = payments[idx];
  if (payment.isVoided) return payment;

  const updated: Payment = {
    ...payment,
    isVoided: true,
    voidedAt: formatDateTimeLocal(),
    voidReason: reason,
  };

  const newPayments = [...payments];
  newPayments[idx] = updated;
  await setItem(STORAGE_KEYS.PAYMENTS, newPayments);

  // Roll back the invoice
  const invoice = getInvoice(payment.invoiceId);
  if (invoice) {
    const newPaid = Math.max(0, invoice.paidAmount - payment.amount);
    const newStatus: InvoiceStatus = newPaid <= 0 ? 'Issued' : 'Partial';
    const updatedInvoice: Invoice = { ...invoice, paidAmount: newPaid, status: newStatus };
    await saveInvoice(updatedInvoice);
  }

  addAuditLog(
    getCurrentUser().fullName,
    'VOID_PAYMENT',
    `HỦY biên lai ${payment.receiptNumber} (${payment.studentName}). Lý do: ${reason}.`
  );

  return updated;
}

/**
 * Cascade-rehash every transaction from a given sequence number onward.
 * Each rehashed tx uses the freshly computed integrityHash of the previous
 * tx as its new previousHash, keeping the chain internally consistent.
 * Used after any in-place mutation of a transaction that affects immutable
 * fields (e.g. amount correction, manual re-issue).
 */
export async function cascadeRehashChain(fromSequenceNumber: number): Promise<TuitionTransaction[]> {
  const transactions = getTuitionTransactions();
  const sorted = [...transactions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const startIdx = sorted.findIndex((t) => t.sequenceNumber >= fromSequenceNumber);
  if (startIdx <= 0) return sorted;

  let prevHash = sorted[startIdx - 1].integrityHash;
  const updated: TuitionTransaction[] = [...sorted];

  for (let i = startIdx; i < sorted.length; i++) {
    const cur = sorted[i];
    if (cur.previousHash !== prevHash) {
      const newTx: TuitionTransaction = { ...cur, previousHash: prevHash };
      const rehashed = await rehashTransaction(newTx);
      updated[i] = rehashed;
      prevHash = rehashed.integrityHash;
    } else {
      prevHash = cur.integrityHash;
    }
  }

  await setItem(STORAGE_KEYS.TRANSACTIONS, updated);
  return updated;
}

export async function markPrinted(id: string): Promise<void> {
  const transactions = getTuitionTransactions();
  const idx = transactions.findIndex((t) => t.id === id);
  if (idx >= 0) {
    const printedAt = formatDateTimeLocal();
    const updatedTx = { ...transactions[idx], printedAt };
    const updatedTransactions = [...transactions];
    updatedTransactions[idx] = updatedTx;
    await setItem(STORAGE_KEYS.TRANSACTIONS, updatedTransactions);
    syncDataToSupabase('tuition_transactions', updatedTx);
    return;
  }
  // Fallback to Payment[] V2
  const payments = getPayments();
  const pidx = payments.findIndex((p) => p.id === id);
  if (pidx >= 0) {
    const printedAt = formatDateTimeLocal();
    const updatedPay = { ...payments[pidx], printedAt };
    const updatedPayments = [...payments];
    updatedPayments[pidx] = updatedPay;
    await setItem(STORAGE_KEYS.PAYMENTS, updatedPayments);
    syncDataToSupabase('payments', updatedPay);
  }
}

// Attendance CRUD — keyed by (sessionId, studentId, learnDate) so that
// every attendance row points to the same canonical shift the rest of the
// app uses. Legacy rows that only had classGroupId are still read (so we
// don't lose data) but new writes always set both fields.
export function getAttendance(): AttendanceRecord[] {
  return getItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, INITIAL_ATTENDANCE);
}

function findAttendanceIndex(
  records: AttendanceRecord[],
  sessionId: string,
  studentId: string,
  learnDate: string
): number {
  return records.findIndex(
    (r) =>
      r.studentId === studentId &&
      r.learnDate === learnDate &&
      (r.sessionId === sessionId ||
        // legacy rows: classGroupId matched the shift id
        (r.classGroupId && r.classGroupId === sessionId))
  );
}

export async function saveAttendanceRecord(record: AttendanceRecord): Promise<AttendanceRecord> {
  const records = getAttendance();
  // The record must carry a sessionId. Fall back to classGroupId for
  // backward compatibility with pre-rename rows.
  const sessionId = record.sessionId || record.classGroupId || '';
  const idx = findAttendanceIndex(records, sessionId, record.studentId, record.learnDate);

  // Bug F fix: short-circuit if status and notes are unchanged — avoids
  // pointless writes, audit log spam and Supabase traffic.
  if (idx >= 0) {
    const existing = records[idx];
    if (
      existing.status === record.status &&
      (existing.notes || '') === (record.notes || '') &&
      existing.sessionId === sessionId
    ) {
      return existing;
    }
  }

  const normalized: AttendanceRecord = {
    ...record,
    sessionId,
    classGroupId: sessionId, // keep both for back-compat
  };

  let updated: AttendanceRecord[];
  const previousStatus = idx >= 0 ? records[idx].status : null;
  if (idx >= 0) {
    records[idx] = normalized;
    updated = [...records];
  } else {
    updated = [normalized, ...records];
  }

  await setItem(STORAGE_KEYS.ATTENDANCE, updated);
  syncDataToSupabase('attendance_records', normalized);

  // Bug K fix: audit log every individual tick (was previously only
  // logged by the batch "Lưu & Ghi Nhận" flow).
  addAuditLog(
    getCurrentUser().fullName,
    idx >= 0 ? 'UPDATE_ATTENDANCE' : 'CREATE_ATTENDANCE',
    `${previousStatus ? `${previousStatus} -> ${record.status}` : record.status} cho học viên ${record.studentId} tại ca ${sessionId} ngày ${record.learnDate}.`
  );

  return normalized;
}

export async function completeSessionAttendance(
  sessionId: string,
  learnDate: string,
  sessionName: string,
  records: { studentId: string; status: 'Present' | 'Excused' | 'Unexcused'; notes?: string }[]
): Promise<void> {
  // Bug J fix: skip silently if nothing to record.
  if (!records || records.length === 0) return;

  const allAttendance = getAttendance();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  let counter = 0;
  const changed: AttendanceRecord[] = [];

  for (const rec of records) {
    const existingIdx = findAttendanceIndex(allAttendance, sessionId, rec.studentId, learnDate);

    const newRecord: AttendanceRecord = {
      id:
        existingIdx >= 0
          ? allAttendance[existingIdx].id
          : `att_${Date.now()}_${counter++}_${rec.studentId}`,
      sessionId,
      classGroupId: sessionId, // legacy alias
      learnDate,
      sessionName,
      studentId: rec.studentId,
      status: rec.status,
      notes: rec.notes || '',
      updatedAt: now,
    };

    if (existingIdx >= 0) {
      allAttendance[existingIdx] = newRecord;
    } else {
      allAttendance.push(newRecord);
    }
    changed.push(newRecord);
  }

  await setItem(STORAGE_KEYS.ATTENDANCE, allAttendance);
  for (const rec of changed) {
    syncDataToSupabase('attendance_records', rec);
  }

  addAuditLog(
    getCurrentUser().fullName,
    'COMPLETE_ATTENDANCE',
    `Hoàn tất điểm danh ca ${sessionName} - Ngày: ${learnDate}. Tổng số: ${records.length} học viên.`
  );
}

// Audit Logs
export function getAuditLogs(): AuditLog[] {
  return getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
}

export function addAuditLog(userName: string, action: string, details: string): void {
  const logs = getAuditLogs();
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now
      .getHours()
      .toString()
      .padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now
        .getSeconds()
        .toString()
        .padStart(2, '0')}`;

  const newLog: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: timeStr,
    userName,
    action,
    details,
  };

  // Fire-and-forget write to encrypted storage. Fire-and-forget is safe
  // here because the in-memory cache is updated synchronously and the
  // encrypted write completes shortly after. Audit logs are append-only and
  // never used to gate subsequent in-process behavior.
  void setItem(STORAGE_KEYS.AUDIT_LOGS, [newLog, ...logs]);
  syncDataToSupabase('audit_logs', newLog);
}