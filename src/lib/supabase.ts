import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_CONFIG_KEY = 'allegro_supabase_config';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  autoSync: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  return {
    url,
    anonKey,
    autoSync: true,
  };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
}

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }

  if (!clientInstance) {
    try {
      clientInstance = createClient(config.url, config.anonKey);
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      return null;
    }
  }

  return clientInstance;
}

export function resetSupabaseClient(): void {
  clientInstance = null;
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Chưa cấu hình URL và Anon Key của Supabase Project.',
    };
  }

  try {
    // Attempt a light ping/query
    const { error } = await client.from('students').select('id').limit(1);
    if (error) {
      // If table doesn't exist yet, but credentials are valid
      if (error.code === '42P01') {
        return {
          success: true,
          message: 'Kết nối Supabase thành công! (Bảng database chưa khởi tạo, vui lòng bấm TẠO SCHEMA)',
        };
      }
      return {
        success: false,
        message: `Lỗi kết nối Supabase: ${error.message} (Mã: ${error.code})`,
      };
    }

    return {
      success: true,
      message: 'Kết nối Supabase hoàn hảo! Đã truy vấn cơ sở dữ liệu thành công.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Không thể kết nối đến Supabase: ${err?.message || String(err)}`,
    };
  }
}

export const SUPABASE_SQL_SCHEMA = `-- SQL SCHEMA KHỞI TẠO HỆ THỐNG QUẢN LÝ DẠY HỌC & TÀI CHÍNH HIẾU VŨ ALLEGRO
-- Chạy đoạn script này trong SQL Editor của Supabase Dashboard (https://app.supabase.com)

-- 1. Bảng Học Viên (students)
CREATE TABLE IF NOT EXISTS public.students (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  date_of_birth TEXT,
  gender TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  status TEXT DEFAULT 'Active',
  join_date TEXT,
  notes TEXT,
  enrolled_class_ids JSONB DEFAULT '[]'::jsonb,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Bảng Giáo Viên (teachers)
CREATE TABLE IF NOT EXISTS public.teachers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  instruments JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'Active',
  avatar_url TEXT,
  bio TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Bảng Môn Học (courses)
CREATE TABLE IF NOT EXISTS public.courses (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  duration_months INT DEFAULT 3,
  total_sessions INT DEFAULT 24,
  reference_fee NUMERIC DEFAULT 0,
  description TEXT,
  color TEXT
);

-- 4. Bảng Lớp Học (class_groups)
CREATE TABLE IF NOT EXISTS public.class_groups (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  course_id TEXT,
  teacher_id TEXT,
  room TEXT,
  schedule_days JSONB DEFAULT '[]'::jsonb,
  time_slot TEXT,
  max_students INT DEFAULT 10
);

-- 5. Bảng Thời Khóa Biểu Chi Tiết Ca Học (schedule_entries)
CREATE TABLE IF NOT EXISTS public.schedule_entries (
  id TEXT PRIMARY KEY,
  day_of_week TEXT NOT NULL, -- 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'
  time_slot TEXT NOT NULL,  -- '17h', '18h', '19h', '20h'
  instrument TEXT NOT NULL, -- 'Piano', 'Organ', 'Guitar'
  student_ids JSONB DEFAULT '[]'::jsonb,
  teacher_id TEXT,
  room TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. Bảng Giao Dịch Học Phí & Hash Chain (tuition_transactions)
CREATE TABLE IF NOT EXISTS public.tuition_transactions (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_date TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  period TEXT NOT NULL,
  collector_name TEXT,
  notes TEXT,
  is_voided BOOLEAN DEFAULT false,
  voided_at TEXT,
  void_reason TEXT,
  sequence_number INT NOT NULL,
  previous_hash TEXT NOT NULL,
  integrity_hash TEXT NOT NULL,
  digital_signature TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. Bảng Điểm Danh (attendance_records)
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id TEXT PRIMARY KEY,
  class_group_id TEXT,
  learn_date TEXT NOT NULL,
  session_name TEXT,
  student_id TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 8. Bảng Nhật Ký Thao Tác (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT
);

-- Bật Row Level Security (RLS) cho phép xem và ghi dữ liệu công khai hoặc qua Anon Key
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuition_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies cho phép truy vấn công khai qua Anon Key
CREATE POLICY "Allow public select students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow public insert students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update students" ON public.students FOR UPDATE USING (true);

CREATE POLICY "Allow public select teachers" ON public.teachers FOR SELECT USING (true);
CREATE POLICY "Allow public insert teachers" ON public.teachers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update teachers" ON public.teachers FOR UPDATE USING (true);

CREATE POLICY "Allow public select courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Allow public insert courses" ON public.courses FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select class_groups" ON public.class_groups FOR SELECT USING (true);
CREATE POLICY "Allow public insert class_groups" ON public.class_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update class_groups" ON public.class_groups FOR UPDATE USING (true);

CREATE POLICY "Allow public select schedule_entries" ON public.schedule_entries FOR SELECT USING (true);
CREATE POLICY "Allow public insert schedule_entries" ON public.schedule_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update schedule_entries" ON public.schedule_entries FOR UPDATE USING (true);

CREATE POLICY "Allow public select tuition_transactions" ON public.tuition_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert tuition_transactions" ON public.tuition_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update tuition_transactions" ON public.tuition_transactions FOR UPDATE USING (true);

CREATE POLICY "Allow public select attendance_records" ON public.attendance_records FOR SELECT USING (true);
CREATE POLICY "Allow public insert attendance_records" ON public.attendance_records FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select audit_logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (true);
`;
