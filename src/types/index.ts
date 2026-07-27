export type UserRole = 'Admin' | 'Staff';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  email?: string;
  avatar?: string;
  createdAt: string;
}

export type StudentStatus = 'Active' | 'Reserved' | 'Dropped';

export interface Student {
  id: string;
  code: string; // e.g. 'HV001'
  fullName: string;
  /**
   * Legacy fields kept optional for backward compatibility with records
   * persisted before the form simplification. New entries are written
   * without these fields.
   */
  dateOfBirth?: string;
  gender: 'Nam' | 'Nữ' | 'Khác';
  phone: string;
  email?: string;
  address?: string;
  parentName?: string;
  parentPhone?: string;
  status: StudentStatus;
  joinDate: string;
  notes?: string;
  enrolledClassIds: string[]; // ClassGroup IDs
  avatarUrl?: string;
}

export interface Teacher {
  id: string;
  code: string; // e.g. 'GV001'
  fullName: string;
  phone: string;
  email: string;
  instruments: string[]; // e.g. ['Piano', 'Organ', 'Guitar']
  status: 'Active' | 'Inactive';
  avatarUrl?: string;
  bio?: string;
}

export interface Course {
  id: string;
  code: string; // e.g. 'KH_PIANO'
  name: string; // e.g. 'Piano'
  durationMonths: number;
  totalSessions: number;
  referenceFee: number; // e.g. 2,400,000 VND
  description?: string;
  color: string;
}

export interface ClassSession {
  dayOfWeek: string; // 'Thứ 2'...'Thứ 6'
  timeSlot: string; // '17h' | '18h' | '19h' | '20h'
}

export interface ClassGroup {
  id: string;
  code: string; // e.g. 'LH_PIANO'
  name: string; // e.g. 'Lớp Piano'
  courseId: string; // 'crs_piano', 'crs_organ', or 'crs_guitar'
  teacherId: string;
  room: string; // 'PHÒNG TRUNG TÂM'
  /**
   * Grid of weekly class sessions. Each entry is one concrete (day, time)
   * pair during which the class meets. Replaces the older pair of
   * (scheduleDays, timeSlot) which could only express a single time slot
   * repeated across multiple days.
   */
  classSessions: ClassSession[];
  /** @deprecated kept for backward compatibility with older rows. Use classSessions. */
  scheduleDays?: string[];
  /** @deprecated kept for backward compatibility with older rows. Use classSessions. */
  timeSlot?: string;
  maxStudents: number;
}

export interface ScheduleEntry {
  id: string;
  dayOfWeek: string; // 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'
  timeSlot: string; // '17h', '18h', '19h', '20h'
  instrument: 'Piano' | 'Organ' | 'Guitar';
  studentIds: string[];
  teacherId?: string;
  room?: string;
  /** Link to the owning class group (Piano / Organ / Guitar). */
  classGroupId?: string;
}

export type AttendanceStatus = 'Present' | 'Excused' | 'Unexcused' | 'Pending';

export interface AttendanceRecord {
  id: string;
  /**
   * Stable session identifier = shiftId from scheduleService
   * (e.g. "shift|thu-2|17h|piano"). All attendance rows for a given
   * (shift, date, student) triple share this key.
   */
  sessionId: string;
  /** @deprecated retained for backward compatibility with legacy rows. Prefer sessionId. */
  classGroupId?: string;
  learnDate: string; // YYYY-MM-DD
  sessionName: string; // e.g. 'Ca 17h · Piano · Thứ 2 (2026-07-24)'
  studentId: string;
  status: AttendanceStatus;
  notes?: string;
  updatedAt: string;
}

export type PaymentMethod = 'Cash' | 'Transfer';

export interface TuitionTransaction {
  id: string;
  invoiceNumber: string; // e.g. 'BL-2026-07-0012'
  studentId: string;
  studentName: string;
  amount: number;
  paymentDate: string; // YYYY-MM-DD HH:mm
  paymentMethod: PaymentMethod;
  period: string; // e.g. 'Học phí Khóa Piano K01'
  collectorName: string;
  notes?: string;
  isVoided: boolean;
  voidedAt?: string;
  voidReason?: string;
  printedAt?: string;
  sequenceNumber: number;
  previousHash: string;
  integrityHash: string;
  digitalSignature: string;
}

// =====================================================================
// Billing domain — Invoices + Payments (rewrite of tuition module)
// =====================================================================

export type BillingPeriod = 'Monthly' | 'Quarterly' | 'Yearly' | 'PerSession';

export type InvoiceStatus =
  | 'Draft'
  | 'Issued'
  | 'Partial'
  | 'Paid'
  | 'Overdue'
  | 'Voided';

/**
 * One line on an invoice — typically one class, one period, one course.
 * Sessions attended is informational; amount is computed at issue time
 * based on the configured `BillingPolicy` for that period.
 */
export interface InvoiceLineItem {
  id: string;
  description: string;
  courseId: string;
  courseName: string;
  classGroupId: string;
  classGroupName: string;
  sessionsPlanned: number;
  sessionsAttended: number;
  unitPrice: number;
  amount: number;
}

/**
 * Issued billing document for one student over a billing period.
 * Invoice number format: `PT-YYYY-MM-XXXX`.
 */
export interface Invoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  billingPeriod: BillingPeriod;
  periodLabel: string; // e.g. "Tháng 7/2026"
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  createdAt: string;
  notes?: string;
}

/**
 * A single payment against an invoice. Replaces the legacy
 * TuitionTransaction for new flows but the legacy type is kept for
 * backward compatibility with already-printed receipts.
 */
export interface Payment {
  id: string;
  receiptNumber: string; // e.g. 'BL-2026-07-0001'
  invoiceId: string;
  studentId: string;
  studentName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  bankReference?: string;
  vietQRPayload?: string;
  collectorName: string;
  notes?: string;
  isVoided: boolean;
  voidedAt?: string;
  voidReason?: string;
  printedAt?: string;
  sequenceNumber: number;
  previousHash: string;
  integrityHash: string;
  digitalSignature: string;
}

export interface BillingPolicy {
  /**
   * Whether to charge for `Excused` absences. Default `count` (i.e. they
   * still pay for the booked seat, like most Vietnamese music centres).
   */
  excusedAbsence: 'count' | 'donot_count';
  /**
   * Whether to deduct `Unexcused` absences from the invoice. Default
   * `donot_deduct` because most centres refund manually after review.
   */
  unexcusedAbsence: 'deduct' | 'donot_deduct';
}

export interface MBBankConfig {
  bin: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  template: 'compact' | 'compact2' | 'qr';
}

export interface CenterSettings {
  centerName: string;
  centerAddress: string;
  centerPhone: string;
  centerTaxCode: string;
  centerLogoDataUrl?: string;
  receiptFooter: string;
  billingPolicy: BillingPolicy;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  action: string;
  details: string;
  ipAddress?: string;
}

export interface VerificationResult {
  isValid: boolean;
  totalTransactions: number;
  verifiedTransactions: number;
  tamperedIndex: number | null;
  errorMessage?: string;
  logs: string[];
}

export interface WorkspaceConfig {
  spreadsheetId?: string;
  calendarId?: string;
  autoSyncSheets: boolean;
  autoSyncCalendar: boolean;
}
