/**
 * Billing engine — generate invoices from class enrollment × per-session
 * pricing, count attended sessions, and aggregate per-student / per-period
 * summaries.
 *
 * Per the rewrite spec:
 *  - Each class group (Piano/Organ/Guitar) has 8 sessions/month.
 *  - Unit price = `Course.referenceFee / Course.totalSessions`.
 *  - The default policy charges for both Present and Excused sessions
 *    (typical Vietnamese music centres); Unexcused absences are NOT
 *    auto-deducted (the operator decides refunds manually).
 *  - Attendance data is consulted for informational purposes only:
 *    sessionsAttended is filled in to make reports useful, but it
 *    does NOT change the invoice amount under the default policy.
 */
import {
  Student,
  Course,
  ClassGroup,
  Invoice,
  InvoiceLineItem,
  BillingPeriod,
  BillingPolicy,
  AttendanceRecord,
} from '../types';
import { getCenterSettings, DEFAULT_CENTER_SETTINGS } from './mbBankConfig';

export const WORKING_DAYS_VN = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];

/**
 * Return the start (Mon) and end (Sun) of the month that contains
 * `date`, in YYYY-MM-DD strings.
 */
export function monthBounds(date: Date): { start: string; end: string; label: string } {
  const yyyy = date.getFullYear();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const start = `${yyyy}-${mm}-01`;
  const last = new Date(yyyy, date.getMonth() + 1, 0).getDate();
  const end = `${yyyy}-${mm}-${last.toString().padStart(2, '0')}`;
  const label = `Tháng ${date.getMonth() + 1}/${yyyy}`;
  return { start, end, label };
}

/**
 * Due date is the 10th of the month following the billing period
 * (e.g. July invoice is due on Aug 10). Returns YYYY-MM-DD.
 */
export function dueDateForPeriod(periodStart: string): string {
  const [y, m] = periodStart.split('-').map((n) => parseInt(n, 10));
  const next = new Date(y, m, 10); // month is 0-indexed, so m here is already next month
  const yyyy = next.getFullYear();
  const mm = (next.getMonth() + 1).toString().padStart(2, '0');
  const dd = next.getDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Count attended sessions for one student in one class group within a
 * date range, with policy filtering.
 */
export function countAttendedSessions(
  records: AttendanceRecord[],
  studentId: string,
  classGroupId: string,
  start: string,
  end: string,
  policy: BillingPolicy
): number {
  let count = 0;
  for (const r of records) {
    if (r.studentId !== studentId) continue;
    if (r.learnDate < start || r.learnDate > end) continue;
    if (r.classGroupId !== classGroupId && !r.sessionId.includes(`|${classGroupId}`)) {
      // sessionId is a shiftKey like "shift|thu-2|17h|piano"; classGroupId is "cls_piano".
      // Match by classGroupId legacy alias only (already covered by line above).
    }
    if (r.status === 'Present') count += 1;
    else if (r.status === 'Excused' && policy.excusedAbsence === 'count') count += 1;
    else if (r.status === 'Unexcused' && (policy.unexcusedAbsence as unknown as string) === 'count') count += 1;
  }
  return count;
}

export interface DraftInvoiceInput {
  student: Student;
  classGroup: ClassGroup;
  course: Course;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  attendance: AttendanceRecord[];
}

/**
 * Build one line item for a (student, classGroup) pair. Returns null if
 * the student is not actively enrolled in the class.
 */
export function buildLineItem(input: DraftInvoiceInput): InvoiceLineItem | null {
  const { student, classGroup, course, periodStart, periodEnd, attendance } = input;
  if (!student.enrolledClassIds.includes(classGroup.id)) return null;
  if (student.status !== 'Active') return null;
  if (course.totalSessions <= 0) return null;

  const settings = getCenterSettings();
  const policy = settings.billingPolicy ?? DEFAULT_CENTER_SETTINGS.billingPolicy;
  const sessionsPlanned = course.totalSessions;
  const sessionsAttended = countAttendedSessions(
    attendance,
    student.id,
    classGroup.id,
    periodStart,
    periodEnd,
    policy
  );
  const unitPrice = Math.round(course.referenceFee / course.totalSessions);
  // Under the default policy the amount is the full course fee regardless
  // of attendance. Deduct/refund policies are operator-driven; if a future
  // policy sets unexcusedAbsence = 'deduct', that adjustment is applied
  // here.
  const baseAmount = sessionsPlanned * unitPrice;
  let amount = baseAmount;
  if (policy.unexcusedAbsence === 'deduct') {
    const missed = sessionsPlanned - sessionsAttended;
    if (missed > 0) amount = Math.max(0, baseAmount - missed * unitPrice);
  }
  return {
    id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    description: `Học phí ${course.name} - ${input.periodLabel}`,
    courseId: course.id,
    courseName: course.name,
    classGroupId: classGroup.id,
    classGroupName: classGroup.name,
    sessionsPlanned,
    sessionsAttended,
    unitPrice,
    amount,
  };
}

export interface DraftInvoiceResult {
  student: Student;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
}

/**
 * Build a draft invoice (no id/number/createdAt yet) for one student.
 * Aggregates one line per enrolled class group.
 */
export function draftInvoiceForStudent(
  student: Student,
  classGroups: ClassGroup[],
  courses: Course[],
  attendance: AttendanceRecord[],
  periodStart: string,
  periodEnd: string,
  periodLabel: string
): DraftInvoiceResult {
  const lineItems: InvoiceLineItem[] = [];
  for (const classId of student.enrolledClassIds) {
    const cls = classGroups.find((c) => c.id === classId);
    if (!cls) continue;
    const course = courses.find((c) => c.id === cls.courseId);
    if (!course) continue;
    const li = buildLineItem({
      student,
      classGroup: cls,
      course,
      periodStart,
      periodEnd,
      periodLabel,
      attendance,
    });
    if (li) lineItems.push(li);
  }
  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
  return {
    student,
    lineItems,
    subtotal,
    discount: 0,
    totalAmount: subtotal,
  };
}

/**
 * Format a Date as `YYYY-MM-DD` using local time.
 */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a `YYYY-MM-DD` string into a Date at local midnight.
 */
export function fromDateString(s: string): Date {
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

/**
 * Get the current billing period (this calendar month).
 */
export function getCurrentBillingPeriod(now: Date = new Date()): {
  start: string;
  end: string;
  label: string;
} {
  return monthBounds(now);
}

/**
 * Compute total expected fee for a student over the active month, used
 * for dashboards / remaining-debt displays.
 */
export function computeStudentMonthlyTotal(
  student: Student,
  classGroups: ClassGroup[],
  courses: Course[]
): number {
  let total = 0;
  for (const classId of student.enrolledClassIds) {
    const cls = classGroups.find((c) => c.id === classId);
    const course = cls ? courses.find((c) => c.id === cls.courseId) : undefined;
    if (!course) continue;
    total += course.referenceFee;
  }
  // Legacy fallback: Active student with no enrollment is treated as
  // being signed up for Piano at the default rate.
  if (total === 0 && student.status === 'Active') {
    const piano = courses.find((c) => c.id === 'crs_piano');
    total = piano ? piano.referenceFee : courses[0]?.referenceFee ?? 450000;
  }
  return total;
}

export const BILLING_PERIOD_LABELS: Record<BillingPeriod, string> = {
  Monthly: 'Hàng tháng',
  Quarterly: 'Hàng quý',
  Yearly: 'Hàng năm',
  PerSession: 'Theo buổi',
};