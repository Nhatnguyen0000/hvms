import React, { useState } from 'react';
import { Teacher } from '../types';
import { getTeachers, saveTeacher } from '../lib/storage';
import { useToast } from './Toast';
import { X, Save, GraduationCap } from 'lucide-react';

interface TeacherModalProps {
  teacherToEdit?: Teacher | null;
  onClose: () => void;
  onSaved: () => void;
}

export const TeacherModal: React.FC<TeacherModalProps> = ({
  teacherToEdit,
  onClose,
  onSaved,
}) => {
  const existingTeachers = getTeachers();
  const defaultCode = teacherToEdit
    ? teacherToEdit.code
    : `GV${(existingTeachers.length + 1).toString().padStart(3, '0')}`;

  const [code, setCode] = useState(teacherToEdit?.code || defaultCode);
  const [fullName, setFullName] = useState(teacherToEdit?.fullName || '');
  const [phone, setPhone] = useState(teacherToEdit?.phone || '');
  const [email, setEmail] = useState(teacherToEdit?.email || '');
  const [status, setStatus] = useState<'Active' | 'Inactive'>(teacherToEdit?.status || 'Active');
  const [bio, setBio] = useState(teacherToEdit?.bio || '');
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>(
    teacherToEdit?.instruments || ['Piano']
  );

  const availableInstruments = ['Piano', 'Organ', 'Guitar', 'Thanh Nhạc', 'Violin', 'Ukulele'];
  const toast = useToast();

  const toggleInstrument = (inst: string) => {
    if (selectedInstruments.includes(inst)) {
      setSelectedInstruments(selectedInstruments.filter((i) => i !== inst));
    } else {
      setSelectedInstruments([...selectedInstruments, inst]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;

    const teacherData: Teacher = {
      id: teacherToEdit ? teacherToEdit.id : `tch_${Date.now()}`,
      code,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      instruments: selectedInstruments,
      status,
      bio: bio.trim(),
      avatarUrl:
        teacherToEdit?.avatarUrl ||
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    };

    await saveTeacher(teacherData);
    onSaved();
    onClose();
    toast.success(
      teacherToEdit
        ? `Đã cập nhật hồ sơ giáo viên ${fullName.trim()}.`
        : `Đã thêm giáo viên mới: ${fullName.trim()}.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="bg-slate-800/80 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-white">
              {teacherToEdit ? 'Chỉnh Sửa Hồ Sơ Giáo Viên' : 'Thêm Giáo Viên Mới'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mã GV</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Họ Và Tên Giáo Viên *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Thầy Nguyễn Hiếu Vũ..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Số Điện Thoại *</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Trạng Thái</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                <option value="Active">Đang Giảng Dạy</option>
                <option value="Inactive">Tạm Ngừng</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Liên Hệ</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Bộ Môn Giảng Dạy</label>
            <div className="flex flex-wrap gap-2">
              {availableInstruments.map((inst) => {
                const isChecked = selectedInstruments.includes(inst);
                return (
                  <button
                    type="button"
                    key={inst}
                    onClick={() => toggleInstrument(inst)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      isChecked
                        ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {inst}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Tiểu Sử / Trình Độ Chuyên Môn</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white"
            />
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Lưu Thông Tin</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
