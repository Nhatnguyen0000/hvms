import React, { useState } from 'react';
import { getAuditLogs } from '../lib/storage';
import { History, Search, Terminal, User } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs] = useState(getAuditLogs());
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(
    (l) =>
      l.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Nhật Ký Thao Tác Hệ Thống (Audit Logs)</h2>
          <p className="text-slate-400 text-xs mt-1">
            Ghi vết mọi hoạt động lập biên lai, hủy phiếu, điểm danh, thay đổi học viên và đăng nhập tài khoản.
          </p>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Tìm theo Tên người dùng, Thao tác, Chi tiết..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="divide-y divide-slate-800">
          {filteredLogs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-slate-800/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-indigo-300 font-mono">{log.action}</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-semibold text-white flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" /> {log.userName}
                  </span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">{log.details}</p>
              </div>

              <div className="text-[11px] text-slate-400 font-mono shrink-0">
                {log.timestamp}
              </div>
            </div>
          ))}
        </div>

        {filteredLogs.length === 0 && (
          <div className="p-12 text-center text-slate-400">Chưa có nhật ký nào phù hợp.</div>
        )}
      </div>
    </div>
  );
};
