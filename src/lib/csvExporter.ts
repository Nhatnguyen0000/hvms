import { AttendanceRecord, ScheduleEntry, Student, Teacher } from '../types';

/**
 * Helper to escape CSV cell content safely for Excel / Sheets
 */
function escapeCSV(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Export Attendance Sheet to a beautifully formatted Vietnamese CSV with UTF-8 BOM
 */
export function exportAttendanceCSV(
  shift: ScheduleEntry,
  selectedDate: string,
  students: Student[],
  attendanceRecords: AttendanceRecord[],
  teacher?: Teacher
): void {
  const dayName = getDayNameFromDate(selectedDate);
  const teacherName = teacher?.fullName || 'Trung Tâm Âm Nhạc Hiếu Vũ';

  // Match attendance rows by sessionId (canonical) with back-compat for
  // legacy rows that only had classGroupId set to the shift id.
  const findRecord = (studentId: string) =>
    attendanceRecords.find(
      (a) =>
        a.studentId === studentId &&
        a.learnDate === selectedDate &&
        (a.sessionId === shift.id || a.classGroupId === shift.id)
    );

  const getStatus = (studentId: string) => findRecord(studentId)?.status ?? 'Pending';
  const getNotes = (studentId: string) => findRecord(studentId)?.notes || '';
  const getUpdatedAt = (studentId: string) => findRecord(studentId)?.updatedAt || '';

  let presentCount = 0;
  let excusedCount = 0;
  let unexcusedCount = 0;
  let pendingCount = 0;

  students.forEach((s) => {
    const st = getStatus(s.id);
    if (st === 'Present') presentCount++;
    else if (st === 'Excused') excusedCount++;
    else if (st === 'Unexcused') unexcusedCount++;
    else pendingCount++;
  });

  const formattedDate = formatDateVN(selectedDate);

  // Build CSV Rows
  const csvLines: string[] = [];

  // Header Banner Info
  csvLines.push(`${escapeCSV('TRUNG TÂM ÂM NHẠC HIẾU VŨ - BẢNG ĐIỂM DANH CA HỌC')}`);
  csvLines.push(`${escapeCSV('Khẩu hiệu: Khơi Nguồn Đam Mê · Ươm Mầm Tài Năng Âm Nhạc (Piano · Organ · Guitar)')}`);
  csvLines.push(`${escapeCSV(`Ngày học: ${formattedDate} (${dayName})`)}`);
  csvLines.push(
    `${escapeCSV(
      `Ca học: ${shift.timeSlot} | Bộ môn: ${shift.instrument} | Phòng: ${shift.room || 'Phòng Học'} | Giáo viên: ${teacherName}`
    )}`
  );
  csvLines.push(
    `${escapeCSV(
      `Thống kê ca học: Sĩ số ${students.length} học viên | Có mặt: ${presentCount} | Vắng có phép: ${excusedCount} | Vắng không phép: ${unexcusedCount} | Chưa điểm danh: ${pendingCount}`
    )}`
  );
  csvLines.push(''); // Blank row separator

  // Table Column Headers
  const tableHeaders = [
    'STT',
    'Mã Học Viên',
    'Họ Và Tên Học Viên',
    'Số Điện Thoại',
    'Trạng Thái Điểm Danh',
    'Ghi Chú',
    'Thời Gian Cập Nhật',
  ];
  csvLines.push(tableHeaders.map((h) => escapeCSV(h)).join(','));

  // Table Data Rows
  students.forEach((s, idx) => {
    const status = getStatus(s.id);
    const statusLabel =
      status === 'Present'
        ? 'CÓ MẶT'
        : status === 'Excused'
        ? 'VẮNG CÓ PHÉP'
        : status === 'Unexcused'
        ? 'VẮNG KHÔNG PHÉP'
        : 'CHƯA ĐIỂM DANH';

    const row = [
      idx + 1,
      s.code,
      s.fullName,
      s.phone || '',
      statusLabel,
      getNotes(s.id),
      getUpdatedAt(s.id),
    ];
    csvLines.push(row.map((val) => escapeCSV(val)).join(','));
  });

  // Footer / Signature Section
  csvLines.push('');
  csvLines.push(`${escapeCSV('NGƯỜI LẬP BẢNG ĐIỂM DANH')},,,${escapeCSV('GIÁO VIÊN XÁC NHẬN')}`);
  csvLines.push(`${escapeCSV('(Ký và ghi rõ họ tên)')},,,${escapeCSV('(Ký và ghi rõ họ tên)')}`);

  // Create UTF-8 BOM String
  const csvContent = '\uFEFF' + csvLines.join('\n');

  // Trigger File Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeDate = selectedDate.replace(/-/g, '');
  const safeTime = shift.timeSlot.replace(/[^a-zA-Z0-9]/g, '');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `DiemDanh_HieuVu_${safeDate}_Ca${safeTime}_${shift.instrument}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getDayNameFromDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  switch (day) {
    case 1:
      return 'Thứ 2';
    case 2:
      return 'Thứ 3';
    case 3:
      return 'Thứ 4';
    case 4:
      return 'Thứ 5';
    case 5:
      return 'Thứ 6';
    case 6:
      return 'Thứ 7';
    default:
      return 'Chủ Nhật';
  }
}

function formatDateVN(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}
