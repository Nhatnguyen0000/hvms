import { User, Student, Teacher, Course, ClassGroup, ScheduleEntry, TuitionTransaction, AttendanceRecord, AuditLog } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr_admin',
    username: 'vutrunghieu',
    fullName: 'VŨ TRUNG HIẾU',
    role: 'Admin',
    avatar: '',
    createdAt: '2026-01-01T08:00:00Z',
  },
  {
    id: 'usr_staff',
    username: 'nhanvien',
    fullName: 'Cô Mai Anh (Lễ Tân)',
    role: 'Staff',
    avatar: '',
    createdAt: '2026-01-15T08:00:00Z',
  },
];

export const INITIAL_COURSES: Course[] = [
  {
    id: 'crs_piano',
    code: 'KH_PIANO',
    name: 'Piano',
    durationMonths: 1,
    totalSessions: 8,
    referenceFee: 450000,
    description: 'Khóa học Piano chuẩn quốc tế, rèn luyện tư duy âm nhạc và kỹ thuật ngón.',
    color: '#3b82f6', // blue
  },
  {
    id: 'crs_organ',
    code: 'KH_ORGAN',
    name: 'Organ',
    durationMonths: 1,
    totalSessions: 8,
    referenceFee: 500000,
    description: 'Khóa học Organ thành thạo đệm hát, điệu nhạc và tiết tấu.',
    color: '#10b981', // emerald
  },
  {
    id: 'crs_guitar',
    code: 'KH_GUITAR',
    name: 'Guitar',
    durationMonths: 1,
    totalSessions: 8,
    referenceFee: 400000,
    description: 'Khóa học Guitar đệm hát, hợp âm, bấm tỉa và hòa âm.',
    color: '#f59e0b', // amber
  },
];

export const INITIAL_TEACHERS: Teacher[] = [
  {
    id: 'tch_hieuvu',
    code: 'GV001',
    fullName: 'Thầy Nguyễn Hiếu Vũ',
    phone: '0908123456',
    email: 'hieuvu.music@gmail.com',
    instruments: ['Piano', 'Organ', 'Guitar'],
    status: 'Active',
    avatarUrl: '',
    bio: 'Trưởng Trung Tâm Hiếu Vũ - 15 năm kinh nghiệm giảng dạy Âm nhạc.',
  },
];

export const INITIAL_CLASSES: ClassGroup[] = [
  {
    id: 'cls_piano',
    code: 'LH_PIANO',
    name: 'Lớp Piano',
    courseId: 'crs_piano',
    teacherId: 'tch_hieuvu',
    room: 'PHÒNG TRUNG TÂM',
    classSessions: [
      { dayOfWeek: 'Thứ 2', timeSlot: '17h' },
      { dayOfWeek: 'Thứ 2', timeSlot: '18h' },
      { dayOfWeek: 'Thứ 3', timeSlot: '17h' },
      { dayOfWeek: 'Thứ 3', timeSlot: '18h' },
      { dayOfWeek: 'Thứ 4', timeSlot: '17h' },
      { dayOfWeek: 'Thứ 4', timeSlot: '18h' },
      { dayOfWeek: 'Thứ 5', timeSlot: '17h' },
      { dayOfWeek: 'Thứ 5', timeSlot: '18h' },
      { dayOfWeek: 'Thứ 6', timeSlot: '17h' },
      { dayOfWeek: 'Thứ 6', timeSlot: '18h' },
    ],
    maxStudents: 30,
  },
  {
    id: 'cls_organ',
    code: 'LH_ORGAN',
    name: 'Lớp Organ',
    courseId: 'crs_organ',
    teacherId: 'tch_hieuvu',
    room: 'PHÒNG TRUNG TÂM',
    classSessions: [
      { dayOfWeek: 'Thứ 2', timeSlot: '19h' },
      { dayOfWeek: 'Thứ 2', timeSlot: '20h' },
      { dayOfWeek: 'Thứ 3', timeSlot: '19h' },
      { dayOfWeek: 'Thứ 3', timeSlot: '20h' },
      { dayOfWeek: 'Thứ 4', timeSlot: '19h' },
      { dayOfWeek: 'Thứ 4', timeSlot: '20h' },
      { dayOfWeek: 'Thứ 5', timeSlot: '19h' },
      { dayOfWeek: 'Thứ 5', timeSlot: '20h' },
      { dayOfWeek: 'Thứ 6', timeSlot: '19h' },
      { dayOfWeek: 'Thứ 6', timeSlot: '20h' },
    ],
    maxStudents: 30,
  },
  {
    id: 'cls_guitar',
    code: 'LH_GUITAR',
    name: 'Lớp Guitar',
    courseId: 'crs_guitar',
    teacherId: 'tch_hieuvu',
    room: 'PHÒNG TRUNG TÂM',
    classSessions: [
      { dayOfWeek: 'Thứ 2', timeSlot: '17h' },
      { dayOfWeek: 'Thứ 2', timeSlot: '18h' },
      { dayOfWeek: 'Thứ 2', timeSlot: '19h' },
      { dayOfWeek: 'Thứ 2', timeSlot: '20h' },
      { dayOfWeek: 'Thứ 3', timeSlot: '17h' },
      { dayOfWeek: 'Thứ 3', timeSlot: '18h' },
      { dayOfWeek: 'Thứ 3', timeSlot: '19h' },
      { dayOfWeek: 'Thứ 3', timeSlot: '20h' },
      { dayOfWeek: 'Thứ 4', timeSlot: '17h' },
      { dayOfWeek: 'Thứ 4', timeSlot: '18h' },
      { dayOfWeek: 'Thứ 4', timeSlot: '19h' },
      { dayOfWeek: 'Thứ 4', timeSlot: '20h' },
      { dayOfWeek: 'Thứ 5', timeSlot: '17h' },
      { dayOfWeek: 'Thứ 5', timeSlot: '18h' },
      { dayOfWeek: 'Thứ 5', timeSlot: '19h' },
      { dayOfWeek: 'Thứ 5', timeSlot: '20h' },
      { dayOfWeek: 'Thứ 6', timeSlot: '17h' },
      { dayOfWeek: 'Thứ 6', timeSlot: '18h' },
      { dayOfWeek: 'Thứ 6', timeSlot: '19h' },
      { dayOfWeek: 'Thứ 6', timeSlot: '20h' },
    ],
    maxStudents: 30,
  },
];

export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_SCHEDULE_ENTRIES: ScheduleEntry[] = [];

export const INITIAL_TRANSACTIONS: TuitionTransaction[] = [];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
