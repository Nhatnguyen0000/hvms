import React, { useState, useMemo } from 'react';
import { Student, StudentStatus } from '../types';
import { getClassGroups, getStudents, saveStudent, checkClassCapacity, validateStudentClassEnrollment } from '../lib/storage';
import { useToast } from './Toast';
import { X, UserPlus, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

interface StudentFormModalProps {
  studentToEdit?: Student | null;
  onClose: () => void;
  onSaved: () => void;
}

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  studentToEdit,
  onClose,
  onSaved,
}) => {
  const classGroups = getClassGroups();
  const existingStudents = getStudents();

  // Auto generate HV code if new
  const nextSeq = existingStudents.length + 1;
  const defaultCode = studentToEdit ? studentToEdit.code : `HV${nextSeq.toString().padStart(3, '0')}`;

  const [code, setCode] = useState(studentToEdit?.code || defaultCode);
  const [fullName, setFullName] = useState(studentToEdit?.fullName || '');
  const [gender, setGender] = useState<'Nam' | 'Nữ' | 'Khác'>(studentToEdit?.gender || 'Nam');
  const [phone, setPhone] = useState(studentToEdit?.phone || '');
  const [address, setAddress] = useState(studentToEdit?.address || '');
  const [status, setStatus] = useState<StudentStatus>(studentToEdit?.status || 'Active');
  const [notes, setNotes] = useState(studentToEdit?.notes || '');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(
    studentToEdit?.enrolledClassIds || []
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const toast = useToast();

  const toggleClass = (classId: string) => {
    if (selectedClassIds.includes(classId)) {
      setSelectedClassIds(selectedClassIds.filter((id) => id !== classId));
    } else {
      setSelectedClassIds([...selectedClassIds, classId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Vui lòng nhập Họ và Tên học viên');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Vui lòng nhập Số điện thoại liên hệ');
      return;
    }

    const studentData: Student = {
      id: studentToEdit ? studentToEdit.id : `std_${Date.now()}`,
      code,
      fullName: fullName.trim(),
      gender,
      phone: phone.trim(),
      address: address?.trim() || '',
      status,
      joinDate: studentToEdit ? studentToEdit.joinDate : new Date().toISOString().slice(0, 10),
      notes: notes.trim(),
      enrolledClassIds: selectedClassIds,
      avatarUrl:
        studentToEdit?.avatarUrl ||
        `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200`,
    };

    await saveStudent(studentData);
    onSaved();
    onClose();
    toast.success(
      studentToEdit
        ? `Đã cập nhật hồ sơ ${fullName.trim()}.`
        : `Đã thêm học viên mới: ${fullName.trim()}.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="bg-slate-800/80 px-6 py-4 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">
                {studentToEdit ? 'Chỉnh Sửa Hồ Sơ Học Viên' : 'Thêm Học Viên Mới'}
              </h3>
              <p className="text-xs text-slate-400">Trung Tâm Âm Nhạc Hiếu Vũ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-700/50 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 font-semibold">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mã Học Viên</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Họ Và Tên Học Viên *</label>
              <input
                type="text"
                placeholder="Ví dụ: Nguyễn Văn An"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Giới Tính</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Trạng Thái Học</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StudentStatus)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Active">Đang học</option>
                <option value="Reserved">Bảo lưu</option>
                <option value="Dropped">Nghỉ học</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Số Điện Thoại *</label>
              <input
                type="text"
                placeholder="0901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Số điện thoại dùng để liên hệ phụ huynh / học viên khi cần thiết.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Địa Chỉ Thường Trú (tuỳ chọn)</label>
            <input
              type="text"
              placeholder="123 Nguyễn Trãi, Quận 5..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Enrolled Classes Multi-Select */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <label className="block text-xs font-bold text-indigo-300 uppercase tracking-wider">
              Xếp Vào Lớp Học (Trung tâm có 3 lớp cố định Piano / Organ / Guitar)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {classGroups.map((cls) => {
                const isChecked = selectedClassIds.includes(cls.id);
                const capacity = checkClassCapacity(cls.id);
                const isFull = !capacity.hasCapacity;
                const isAdding = !isChecked;
                return (
                  <div
                    key={cls.id}
                    onClick={() => {
                      if (isAdding && isFull) return;
                      toggleClass(cls.id);
                    }}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-2 ${
                      isFull && isAdding
                        ? 'opacity-50 cursor-not-allowed bg-slate-800/40 border-slate-700/50 text-slate-500'
                        : isChecked
                        ? 'bg-indigo-950/60 border-indigo-500 text-white'
                        : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {isFull && isAdding ? (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : isChecked ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded border border-slate-500 shrink-0" />
                        )}
                        <span className="font-bold text-sm truncate">{cls.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {cls.room} · {cls.timeSlot}
                      </div>
                      {/* Capacity indicator */}
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isFull ? 'bg-rose-500' : capacity.current / capacity.max > 0.8 ? 'bg-amber-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.min(100, (capacity.current / capacity.max) * 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold shrink-0 ${
                          isFull ? 'text-rose-400' : capacity.current / capacity.max > 0.8 ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                          {capacity.current}/{capacity.max}
                          {isFull && isAdding ? ' ĐẦY' : isFull ? '' : ` (còn ${capacity.max - capacity.current})`}
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        if (isAdding && isFull) return;
                        toggleClass(cls.id);
                      }}
                      disabled={isAdding && isFull}
                      className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 shrink-0 mt-0.5"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Ghi Chú Nghiệp Vụ</label>
            <textarea
              rows={2}
              placeholder="Ghi chú thêm về năng khiếu, trình độ..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-sm hover:bg-slate-700"
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Lưu Hồ Sơ</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
