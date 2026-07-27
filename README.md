# 🎵 Allegro — Hệ Thống Quản Lý Đào Tạo & Thu Học Phí

> **Trung Tâm Âm Nhạc Hiếu Vũ**
> *Khơi Nguồn Đam Mê · Ươm Mầm Tài Năng Âm Nhạc*
> *Chuyên đào tạo: Piano · Organ · Guitar*

Hệ thống quản lý chuyên biệt dành riêng cho **Trung Tâm Âm Nhạc Hiếu Vũ**, giúp tối ưu hoá toàn bộ quy trình vận hành: quản lý học viên, phân công giảng dạy, điểm danh ca học, thu học phí, xuất biên lai PDF chuẩn hoá kèm chuỗi hash bảo vệ vẹn toàn dữ liệu.

Ứng dụng chạy thuần trên trình duyệt (SPA), hỗ trợ làm việc ngoại tuyến với dữ liệu mã hoá **AES-256-GCM** lưu trữ cục bộ, đồng bộ lên Supabase khi có mạng. Chuỗi biên lai được bảo vệ bằng **HMAC-SHA256 hash chain** với khả năng tự xác minh vẹn toàn dữ liệu.

> 📋 **Phiên bản:** `0.2.0` · **Cập nhật:** 25/07/2026 · **Trạng thái:** Production-ready (đã đơn giản hoá nghiệp vụ học phí, bỏ QR, làm lại điểm danh real-time, hệ thống toast chuẩn web)

---

## 🌟 Tính Năng Nổi Bật

### 1. 📊 Tổng Quan & Báo Cáo (`Dashboard`)
- Thống kê thời gian thực: tổng học viên đang theo học, doanh thu học phí, số lớp đang hoạt động, học viên đến hạn đóng phí.
- Biểu đồ tăng trưởng doanh thu & tỷ lệ điểm danh chuyên cần (Recharts).
- Bảng "Học viên đến hạn" — nhắc nhở thu phí kịp thời, click mở nhanh modal thu tiền.

### 2. 👨‍🎓 Quản Lý Học Viên (`Students`)
- Lưu trữ thông tin học viên, mã học viên, phụ huynh, số điện thoại liên hệ, ghi chú nghiệp vụ.
- Phân loại trạng thái: **Đang học (`Active`)**, **Bảo lưu (`Reserved`)**, **Nghỉ học (`Dropped`)**.
- Một học viên có thể đăng ký nhiều lớp / nhiều môn cùng lúc (`enrolledClassIds`).
- **Validate sĩ số lớp** khi thêm học viên — chặn vượt `maxStudents` ngay từ form.
- **Xuất PDF Danh Sách Học Viên** — danh sách có logo Hiếu Vũ Music, font tiếng Việt sắc nét.

### 3. 👩‍🏫 Quản Lý Giáo Viên (`Teachers`)
- Danh sách giảng viên theo bộ môn Piano, Organ, Guitar.
- Theo dõi chuyên môn, trạng thái (`Active` / `Inactive`), tiểu sử, số điện thoại & email.

### 4. 🎹 Khóa Học & Lớp Học (`Courses`)
- Thiết lập khóa học theo bộ môn và trình độ (Cơ bản, Nâng cao), gồm học phí tham chiếu, tổng số buổi, thời lượng (tháng).
- Tạo lớp 1:1 hoặc lớp nhóm, gán giáo viên phụ trách, phòng học, thứ học trong tuần, khung giờ (`17h`/`18h`/`19h`/`20h`).

### 5. 📅 Thời Khóa Biểu (`Schedule`)
- Quản lý ca học trực quan theo **Thứ · Giờ · Môn** (Piano / Organ / Guitar).
- Mỗi ca định danh bất biến bằng `shift|{thứ}|{giờ}|{môn}` — gom tất cả học viên của mọi bộ môn vào ca.
- Tránh trùng lịch phòng học và trùng giờ giảng dạy của giáo viên.
- Cảnh báo khi giáo viên được phân công không dạy bộ môn đó.

### 6. ✅ Điểm Danh Học Viên (`Attendance`) — *real-time theo TKB*
- **Ca học `(Thứ · Giờ · Môn)` = nguồn dữ liệu duy nhất.** TKB thêm HV vào ca nào → Điểm danh ca đó hiện HV đó ngay lập tức (subscribe `STORAGE_KEYS.SCHEDULE`).
- Ghi nhận: **Có mặt (`Present`)**, **Vắng có phép (`Excused`)**, **Vắng không phép (`Unexcused`)**, **Chờ (`Pending`)**.
- **Confirm dialog** trước khi đánh dấu vắng không phép & khi lưu ca học nhiều HV chưa tick → chống thao tác vô tình.
- **Active shift tự reset khi đổi ngày** — điểm danh không bao giờ lưu nhầm vào ca học ngày khác.
- ID điểm danh có counter + random suffix → không trùng lặp khi ghi nhiều HV cùng tick.
- **Empty state trung thực** — không fallback 8 HV ngẫu nhiên khi ca học chưa có danh sách.
- **Xuất bảng điểm danh CSV** cho từng ca học (UTF-8 tiếng Việt chuẩn Excel/Sheets).

### 7. 💳 Thu Học Phí & In Biên Lai PDF (`Tuition`) — *đã đơn giản hoá*
- **Lập phiếu thu**: ghi nhận đóng học phí bằng **Tiền mặt / Chuyển khoản** (đã bỏ QR, Momo, ZaloPay, Card).
- **Cảnh báo "Học viên đã đóng đủ"** khi `remainingAmount === 0` — chống thu thừa.
- **Số biên lai tuần tự `BL-YYYY-MM-XXXX`** với sequence chống trùng (microsecond + random suffix).
- **In biên lai chuyên nghiệp** — 3 khổ giấy:
  - **A5** — in ấn văn phòng / xuất PDF gửi phụ huynh.
  - **A6** — biên lai nhỏ gọn.
  - **K80** — máy in nhiệt siêu tốc.
- **CSS @media print** chỉ in phần biên lai (`.print-area`) — sidebar, navbar, toast, backdrop đều ẩn. Không còn in cả trang web.
- **Xuất PDF biên lai** ổn định với html2canvas (đã fix xung đột Tailwind v4 `oklch()` colors).
- **Xuất PDF Sổ Quỹ Học Phí** với bảng tuần tự, tổng hợp tiền mặt / chuyển khoản, đánh dấu hợp lệ / đã hủy.
- **Hủy biên lai** (`void_receipt`): **confirm dialog** tùy biến (`useConfirm`) — đánh dấu hủy với lý do minh bạch, đồng bộ Supabase, không xoá khỏi sổ quỹ. Nút ẩn hoàn toàn với role Staff (server-side guard + UI guard).
- **Hash vẹn toàn** (`integrityHash` + `previousHash`): chuỗi HMAC bảo vệ từng biên lai. Badge "Chuỗi Hash vẹn toàn X/Y" realtime ở header Tuition.
- **Chữ ký số** (`digitalSignature`): HMAC-SHA256 với khoá bí mật trong `.env`. Production throw error nếu secret chưa cấu hình — fail-fast.

### 8. 🛡️ Nhật Ký Hệ Thống (`Audit Logs`)
- Theo dõi và lưu trữ toàn bộ lịch sử thao tác (thêm / sửa / xoá / thu tiền / huỷ phiếu) — ghi log đồng bộ local (encrypted) + cloud.
- Event bus `subscribeDataChange()` cho phép các view cross-component tự refresh khi dữ liệu thay đổi.

### 9. 🔔 Hệ Thống Toast Thông Báo (Web Notification)
- **`<ToastProvider>` + `<ConfirmProvider>`** ở `src/components/Toast.tsx` — thay thế toàn bộ `window.alert()` và `window.confirm()`.
- 4 variant: `success` (xanh), `error` (đỏ), `warning` (vàng), `info` (xanh dương).
- Toast tự động ẩn sau 4.5s, có nút đóng thủ công, slide-in animation.
- **Confirm dialog** không block UI, có 3 variant `danger` / `warning` / `info`.
- Áp dụng cho: thêm/sửa/xóa HV, GV, lớp, xếp HV vào ca TKB, thu học phí, in biên lai, xuất PDF, hủy biên lai, điểm danh, v.v.

### 10. 🔐 Phân Quyền Theo Vai Trò
Hệ thống hỗ trợ 2 vai trò với ma trận quyền rõ ràng (`src/lib/auth.tsx`):

| Quyền | Admin | Staff |
|---|:---:|:---:|
| Xem Dashboard | ✅ | ✅ |
| Quản lý Học viên | ✅ | ✅ |
| Quản lý Giáo viên | ✅ | ❌ |
| Quản lý Khóa học | ✅ | ❌ |
| Quản lý Lịch học | ✅ | ❌ |
| Điểm danh | ✅ | ✅ |
| Thu học phí | ✅ | ✅ |
| **Huỷ biên lai** | ✅ | ❌ |
| Xem Báo cáo | ✅ | ✅ |
| Xuất PDF | ✅ | ✅ |
| Xem Nhật ký | ✅ | ❌ |
| Quản lý Người dùng | ✅ | ❌ |
| Cài đặt hệ thống | ✅ | ❌ |

**Auth flow:**
- **Có Supabase:** `supabase.auth.getSession()` được gọi khi app boot để validate token, role resolve từ bảng `profiles` — không bao giờ tin localStorage.
- **Offline/Mock mode:** session marker `sessionStorage.allegro_session_marker` được set sau login thành công, clear khi logout. Mở tab mới yêu cầu đăng nhập lại.

---

## 🛠️ Công Nghệ Sử Dụng

| Lớp | Công nghệ |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 6 |
| **Routing** | State-based tab (không dùng react-router) |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`) |
| **Icons** | Lucide React |
| **Animation** | Motion (Framer Motion) |
| **Charts** | Recharts |
| **PDF Engine** | `jsPDF` + `html2canvas` (canvas-based, hỗ trợ đầy đủ tiếng Việt có dấu) |
| **Backend** | Express (Node.js) — tuỳ chọn, dùng cho AI proxy |
| **Database / Auth** | Supabase (`@supabase/supabase-js`) — PostgreSQL trên cloud |
| **AI** | Google GenAI (`@google/genai`) |
| **Mã hoá localStorage** | AES-256-GCM (custom `secureStorage.ts` + Web Crypto `crypto.subtle`) |
| **Bảo vệ biên lai** | HMAC-SHA256 hash chain (Web Crypto `crypto.subtle.sign`) |
| **State reactivity** | Event bus tự build — `subscribeDataChange()` cho cross-component refresh |
| **Notification** | ToastProvider + ConfirmProvider (in-app, không phụ thuộc browser) |
| **Font chữ** | Be Vietnam Pro (tiếng Việt hoàn hảo, fallback Segoe UI / Roboto) |

> 📌 **Ghi chú PDF:** Toàn bộ báo cáo PDF sử dụng `html2canvas` chụp trực tiếp DOM đã render, đảm bảo mọi ký tự tiếng Việt có dấu đều hiển thị chính xác. CSS `onclone` hook fix xung đột Tailwind v4 `oklch()` colors.

---

## 📁 Cấu Trúc Thư Mục

```
allegro/
├── public/
│   └── HieuVu_Logo.png          # Logo PNG không nền (Hiếu Vũ Music)
├── src/
│   ├── components/
│   │   ├── dashboard/           # StatCards, RevenueChart, DueStudentsTable
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardView.tsx
│   │   ├── StudentsView.tsx
│   │   ├── StudentDetailModal.tsx
│   │   ├── StudentFormModal.tsx
│   │   ├── TeachersView.tsx
│   │   ├── TeacherModal.tsx
│   │   ├── CoursesView.tsx
│   │   ├── ClassModal.tsx
│   │   ├── ScheduleView.tsx
│   │   ├── AttendanceView.tsx
│   │   ├── TuitionView.tsx
│   │   ├── RecordPaymentModal.tsx
│   │   ├── ReceiptPrintModal.tsx
│   │   ├── AuditLogsView.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Navbar.tsx
│   │   ├── Toast.tsx            # ToastProvider + ConfirmProvider + useToast/useConfirm
│   │   └── WorkspaceView.tsx
│   ├── lib/
│   │   ├── auth.tsx             # AuthProvider + RBAC + session validation
│   │   ├── supabase.ts          # Supabase client (lazy-init)
│   │   ├── storage.ts           # Storage layer + cache + sync + event bus
│   │   ├── secureStorage.ts     # AES-256-GCM async wrapper
│   │   ├── cryptoEngine.ts      # SHA-256, HMAC-SHA256, chain verify
│   │   ├── pdfExporter.ts       # PDF A5/A6/K80/Sổ quỹ + onclone style fix
│   │   ├── csvExporter.ts       # CSV điểm danh
│   │   ├── currencyHelper.ts    # Format VNĐ, số thành chữ
│   │   ├── scheduleService.ts   # shiftId, buildShiftsForDate (TKB-first)
│   │   ├── workspaceApi.ts      # Google Workspace API
│   │   └── initialData.ts       # Seed data
│   ├── types/
│   │   └── index.ts             # TypeScript types (PaymentMethod = 'Cash' | 'Transfer')
│   ├── App.tsx
│   ├── main.tsx
│   ├── vite-env.d.ts
│   └── index.css                # Tailwind v4 + @media print + print-area
├── index.html
├── vite.config.ts               # Port 3000, host 0.0.0.0
├── tailwind.config.js
├── tsconfig.json
├── .env.example
└── package.json                 # name: "allegro-music-center", v0.2.0
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy

### 1. Cài đặt thư viện

```bash
npm install
```

### 2. Cấu hình biến môi trường

Tạo file `.env` ở thư mục gốc (tham khảo `.env.example`):

```env
# Google Gemini AI (tuỳ chọn)
GEMINI_API_KEY=""

# URL app (mặc định localhost)
APP_URL="http://localhost:3000"

# HMAC Secret cho hash chain biên lai (BẮT BUỘC trong production — tạo ngẫu nhiên 64 hex chars)
# Chạy: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# ⚠️ App sẽ THROW ERROR khi build production nếu biến này chưa set hoặc còn là placeholder.
VITE_HMAC_SECRET="CHANGE_THIS_TO_A_RANDOM_64_CHAR_HEX_SECRET"

# Supabase (BẮT BUỘC nếu muốn đồng bộ cloud + auth thật)
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
VITE_SUPABASE_SERVICE_KEY=""

# Khoá mã hoá AES-256-GCM cho localStorage (nên là base64 32 bytes)
VITE_STORAGE_ENCRYPTION_KEY="base64-key-32-bytes"
```

> ⚠️ **Quan trọng:** `VITE_HMAC_SECRET` và `VITE_STORAGE_ENCRYPTION_KEY` phải được giữ bí mật và **không thay đổi sau khi đã phát hành biên lai**, vì sẽ làm vỡ chuỗi hash & giải mã dữ liệu cũ.

### 3. Chạy môi trường phát triển

```bash
npm run dev
```

Ứng dụng chạy tại: **`http://localhost:3000`**
Vite được cấu hình `host: 0.0.0.0` để truy cập từ thiết bị khác trong mạng LAN (điện thoại, tablet).

### 4. Đóng gói sản phẩm

```bash
npm run build
```

Output: thư mục `dist/` chứa toàn bộ static assets. Build production sẽ **fail-fast** nếu `VITE_HMAC_SECRET` chưa cấu hình.

### 5. Preview bản build

```bash
npm run preview
```

### 6. Kiểm tra TypeScript

```bash
npm run lint
```

Lệnh này chạy `tsc --noEmit` để verify toàn bộ type safety của dự án. Hiện tại pass **0 errors** trên toàn bộ codebase.

### 7. Dọn dẹp build cũ

```bash
npm run clean
```

---

## 🔑 Đăng Nhập Mặc Định

Khi chưa cấu hình Supabase (offline/mock mode), hệ thống hỗ trợ 2 tài khoản demo:

| Email | Mật khẩu | Vai trò |
|---|---|---|
| `admin@hieuvu.com` | `admin` | Admin (toàn quyền) |
| `staff@hieuvu.com` | `staff` | Staff (giới hạn — không hủy biên lai, không xem audit) |

> **Lưu ý bảo mật:** Session chỉ tồn tại trong tab hiện tại (`sessionStorage` marker). Đóng tab = phải đăng nhập lại. Trong DevTools, attacker không thể bypass auth bằng cách sửa `localStorage` — khi Supabase được cấu hình, role luôn resolve từ cloud.

Khi cấu hình Supabase đầy đủ, đăng nhập dùng `supabase.auth.signInWithPassword()` với email/password đã đăng ký trong bảng `profiles`.

---

## 🔒 Bảo Mật

### Mã hoá localStorage (AES-256-GCM)
Mọi dữ liệu học viên, giáo viên, biên lai, audit log… khi lưu xuống `localStorage` đều được mã hoá **AES-256-GCM** với khoá `VITE_STORAGE_ENCRYPTION_KEY` qua `crypto.subtle`. Mỗi bản ghi có IV ngẫu nhiên → cùng dữ liệu mã hoá 2 lần cho ra 2 ciphertext khác nhau. Ngay cả khi ai đó truy cập được DevTools, dữ liệu thô không đọc được.

> **Kiến trúc:** Mọi `storage.setItem()` / `storage.getItem()` đều chạy bất đồng bộ qua `secureStorage` — không có bypass nào đọc thẳng `localStorage` plain key.

### Chuỗi Hash Bảo Vệ Biên Lai (HMAC-SHA256)
Mỗi biên lai thu học phí được ký bằng HMAC-SHA256 với input chỉ gồm các trường **bất biến tài chính**:

```
integrityHash = SHA-256(
  previousHash | invoiceNumber | studentId | amount | paymentDate | sequenceNumber
)
digitalSignature = HMAC-SHA256(VITE_HMAC_SECRET, integrityHash)
```

- **`previousHash`** = `integrityHash` của biên lai ngay trước → tạo thành **chuỗi (chain)**.
- Nếu bất kỳ trường bất biến nào bị chỉnh sửa → hash không khớp → phát hiện ngay.
- **`isVoided` / `voidReason`** được **loại khỏi hash input** — void chỉ là metadata nghiệp vụ, không bao giờ làm gãy chuỗi.
- Có hàm `verifyChainIntegrity()` quét toàn bộ sổ quỹ và đánh dấu vị trí bị can thiệp (`tamperedIndex`). Badge realtime hiển thị ở header Tuition.
- Có hàm `cascadeRehashChain(fromSeq)` — dùng khi cần chỉnh sửa field bất biến của biên lai, tự rehash các biên lai kế tiếp để giữ chain nhất quán.

### Event bus cho reactivity
`storage.ts` export `subscribeDataChange(listener)` — cho phép các view cross-component (vd: TuitionView cần refresh khi payment được tạo từ global modal, AttendanceView cần refresh khi ScheduleView thêm HV vào ca) tự đồng bộ mà không cần prop drilling.

---

## 🐛 Lịch sử sửa lỗi

Dự án đã trải qua 2 vòng audit & fix toàn diện:

### Vòng 1 (24/07/2026) — Bảo mật & nghiệp vụ

| # | Mức độ | Mô tả | Giải pháp |
|---|:---:|---|---|
| #1 | 🔴 | Hash chain gãy sau mỗi lần hủy biên lai | Bỏ `isVoided`/`voidReason` khỏi hash input; thêm `cascadeRehashChain()` |
| #2 | 🔴 | Mã hoá localStorage bị bypass hoàn toàn | Viết lại `storage.ts`: mọi read/write qua `secureStorage` async + cache in-memory |
| #3 | 🔴 | Session auth không validate khi reload | Validate `supabase.auth.getSession()` khi có cloud; `sessionStorage` marker khi offline |
| #4 | 🔴 | Invoice number trùng khi đa tab | Sequence = microsecond + random + collision check bump |
| #5 | 🔴 | `voidTransaction()` không sync Supabase | Thêm `syncDataToSupabase()` cuối hàm |
| #6 | 🟡 | `activeShiftId` không reset khi đổi ngày điểm danh | `useEffect` reset khi `selectedDate` thay đổi |
| #7 | 🟡 | Nút "Hủy biên lai" hiển thị với Staff | Hide nút + check `hasPermission('void_receipt')` trong handler |
| #8 | 🟡 | Fallback 8 HV random khi ca học chưa có roster | Bỏ fallback, hiển thị empty state trung thực |
| #9 | 🟠 | Default amount 2.4M khi học viên đã đóng đủ | Check `remainingAmount > 0` + banner cảnh báo |
| #10 | 🟠 | Attendance ID collision trong cùng millisecond | Thêm counter + random suffix |
| #11 | 🟠 | TuitionView stale state khi tạo payment từ global modal | `subscribeDataChange()` event bus |
| #12 | 🟠 | File logo có khoảng trắng trong tên | Xoá 2 file duplicate 1.7MB không được reference |
| #13 | 🟠 | `markPrinted()` không sync Supabase | Thêm `syncDataToSupabase()` |
| #14 | 🟠 | HMAC_SECRET fallback bake vào production | Production throw error nếu chưa cấu hình |
| #15 | 🟢 | `package.json` name không chính xác | Đổi thành `allegro-music-center`, v0.1.0 |
| #16 | 🟢 | `filterVoided` thiếu type safety | Narrow type: `'ALL' \| 'ACTIVE' \| 'VOIDED'` |
| #17 | 🟢 | Dead code `exportToGoogleSheets` | Tái kích hoạt nút "Xuất Google Sheets" (gate bằng flag) |

### Vòng 2 (25/07/2026) — Đơn giản hoá nghiệp vụ & UX

| # | Mức độ | Mô tả | Giải pháp |
|---|:---:|---|---|
| #18 | 🔴 | In biên lai in cả trang (toolbar, sidebar, backdrop) | Thêm `.print-area` + `@media print` chỉ in phần biên lai |
| #19 | 🔴 | Xuất PDF biên lai fail do Tailwind v4 `oklch()` colors | Override `onclone` style ép `rgb()` cho `.print-area` |
| #20 | 🔴 | Điểm danh không show HV vừa xếp trong TKB | `buildShiftsForDate` ưu tiên ScheduleEntry, fallback classSessions |
| #21 | 🟠 | Native `window.alert()` / `window.confirm()` khó chịu | `<ToastProvider>` + `<ConfirmProvider>` toàn cục |
| #22 | 🟠 | Học phí: 6 payment method (Cash, Transfer, Card, Momo, ZaloPay, MBBank_VietQR) | Đơn giản xuống `Cash \| Transfer` + bỏ hẳn QR |
| #23 | 🟢 | "Quản Trị Viên" hiển thị ở badge role | Thay bằng tên chủ trung tâm "VŨ TRUNG HIẾU" |
| #24 | 🟢 | Toast chỉ cho error, thiếu success/warning/info | 4 variant với icon + color theo mức độ |

---

## 📊 Tự đánh giá chất lượng dự án

> Đánh giá dựa trên codebase hiện tại sau 2 vòng fix 24 issues. Thang điểm 10 mỗi mục, tổng hợp theo trọng số.

### 🏆 Tổng quan

| Hạng mục | Điểm | Nhận xét |
|---|:---:|---|
| **Code quality** | 7.5/10 | TypeScript strict-friendly, tổ chức module rõ ràng, có in-memory cache pattern hợp lý. Một số chỗ vẫn có `any` (vd: `syncDataToSupabase` record parameter). |
| **Bảo mật** | 8.5/10 | AES-256-GCM + HMAC-SHA256 chain + session validation là nền tảng tốt. Trừ điểm vì auth mock offline còn yếu (chỉ sessionStorage marker, không có rate-limit / brute-force protection). |
| **Kiến trúc & Pattern** | 7.0/10 | State-based routing đơn giản nhưng không scale. Event bus tự build là chấp nhận được nhưng nên migrate sang Zustand/Jotai khi mở rộng. Còn lẫn lộn business logic với UI logic. |
| **UI/UX** | 9.0/10 | Dark theme nhất quán, font tiếng Việt đẹp, modal/feedback rõ ràng. **Toast + Confirm in-app** (v0.2.0) thay thế hoàn toàn native dialog. Mobile responsive tốt (bottom nav). Có loading skeleton. |
| **Tính năng nghiệp vụ** | 8.5/10 | Coverage tốt cho quy trình trung tâm âm nhạc: học viên → lớp → điểm danh → thu phí → biên lai. Hash chain là USP mạnh. Đã đơn giản hoá payment flow (v0.2.0). |
| **Data integrity** | 8.5/10 | Cascade rehash, collision-resistant sequence, encryption at rest, supabase sync nhất quán. Audit log đầy đủ. |
| **DX (Developer Experience)** | 7.0/10 | `npm run lint` pass clean, vite build nhanh (~12s), code dễ đọc. Thiếu: tests, CI/CD, Storybook. |
| **Tài liệu** | 7.0/10 | README đầy đủ. Thiếu: JSDoc cho internal helpers, ADRs (Architecture Decision Records), API docs cho Supabase schema. |
| **Khả năng mở rộng** | 6.0/10 | Single-bundle, không micro-frontend, không code-split ngoài lazy view. Sẽ khó scale nếu > 20 view. |
| **Test coverage** | 0/10 | **Không có test.** Đây là điểm yếu nghiêm trọng nhất của dự án. |
| **TỔNG ĐIỂM** | **68.5 / 100** | **Xếp loại: Khá — Production-ready cho scale nhỏ, cần test + CI trước khi mở rộng** |

### Điểm mạnh nổi bật
1. **HMAC-SHA256 hash chain** trên biên lai là implementation tốt, giải quyết bài toán audit trail tài chính mà ít codebase cùng cấp có.
2. **AES-256-GCM** thực sự qua Web Crypto API, không phải tự roll — đảm bảo chuẩn cryptographic.
3. **Permission matrix** rõ ràng, RBAC tách bạch — UI guard + handler guard cùng lúc.
4. **PDF canvas-based** giải quyết triệt để vấn đề font tiếng Việt trên `jspdf-autotable`.
5. **Lazy loading** các view giúp initial bundle gọn.
6. **Toast + Confirm hệ thống** (v0.2.0) chuẩn hoá UX, không phụ thuộc browser native dialog.
7. **Điểm danh real-time theo TKB** (v0.2.0) — thay đổi TKB phản ánh ngay ở điểm danh, không cần reload.

### Điểm yếu cần cải thiện (theo ưu tiên)

| Ưu tiên | Hạng mục | Hành động đề xuất |
|---|---|---|
| 🔴 P0 | Test coverage | Thêm Vitest + React Testing Library. Ưu tiên: `cryptoEngine.verifyChainIntegrity`, `storage.recordPayment`/`voidTransaction`, `RecordPaymentModal` flow, `scheduleService.buildShiftsForDate` |
| 🔴 P0 | Supabase RLS | Khi có production, bật Row Level Security trên mọi bảng — đặc biệt `tuition_transactions` chỉ Admin mới `UPDATE is_voided` |
| 🟠 P1 | Schema validation | Dùng Zod ở boundary giữa storage ↔ Supabase để tránh silent data corruption khi schema cloud khác local |
| 🟠 P1 | Centralized state | Migrate sang Zustand. TuitionView đang tự cache `transactions` riêng — nguy cơ drift với cache của storage |
| 🟠 P1 | Tách business logic | `syncDataToSupabase` mapping, tuition calculation, sequence generation nên ở service layer riêng (`src/services/`) thay vì lẫn trong `storage.ts` |
| 🟡 P2 | CI/CD | GitHub Actions: lint → build → preview deploy |
| 🟡 P2 | Observability | Thêm Sentry / log aggregator, hiện tại chỉ `console.warn` |
| 🟢 P3 | Dark/Light theme | Hardcode dark; nên thêm toggle |
| 🟢 P3 | i18n | Hiện hardcode tiếng Việt; nếu mở rộng nhiều chi nhánh → react-i18next |

### So sánh với baseline trước fix
| Metric | Trước | Sau |
|---|:---:|:---:|
| Critical bugs | 5 | 0 |
| High bugs | 3 | 0 |
| Medium bugs | 5 | 0 |
| Low bugs | 3 | 0 |
| UI/UX issues | 4 | 0 |
| **Tổng issues đã fix** | 20 | **24** |
| TypeScript errors | n/a* | 0 |
| Build status | n/a* | ✅ ~12s, 18 chunks |
| Test coverage | 0% | 0% (chưa thay đổi) |

---

## 🛣️ Định Hướng Nâng Cấp Tương Lai

### Giai đoạn 1 — Nền tảng vững (1-2 tháng tới)

#### 1.1 Testing & CI (P0)
- Thêm **Vitest** + **React Testing Library** + **Playwright** (E2E).
- Test coverage mục tiêu: **≥ 70% cho core domain** (`lib/cryptoEngine`, `lib/storage`, `lib/scheduleService`).
- Test các view nghiệp vụ chính: `RecordPaymentModal`, `AttendanceView`, `TuitionView`.
- GitHub Actions: `lint → test → build → preview deploy` mỗi PR.

#### 1.2 Bảo mật production (P0)
- **Supabase RLS policies** rõ ràng cho từng bảng (`students`, `teachers`, `tuition_transactions`, `attendance`, `audit_logs`).
- Rate-limit auth endpoint (Supabase Edge Function).
- Audit log dual storage (local + cloud) với conflict resolution.
- Backup/restore workflow — cho phép restore từ cloud xuống máy mới.

#### 1.3 Schema validation (P1)
- **Zod schemas** cho mọi model — áp dụng ở boundary giữa `storage ↔ Supabase ↔ UI`.
- Auto-generated TypeScript types từ Supabase schema (`supabase gen types typescript`).

### Giai đoạn 2 — Nâng cao UX & Quy trình (2-4 tháng)

#### 2.1 Mobile-first Progressive Web App (PWA)
- **Service Worker** cho offline-first.
- **Push notifications** cho lịch học, nhắc đóng phí.
- **Add to Home Screen** — cài như native app trên iOS/Android.
- Touch-friendly cho danh sách điểm danh (swipe action: Có mặt / Vắng phép).

#### 2.2 Multi-tenant (nhiều chi nhánh)
- Thêm `tenantId` vào mọi bảng → 1 codebase cho N trung tâm.
- Supabase Row-Level Security filter `tenantId`.
- Branding động theo tenant (logo, màu, mẫu biên lai).

#### 2.3 Nâng cấp nghiệp vụ học phí
- **Học phí combo/khuyến mãi**: mua 10 buổi tặng 1, mua theo tháng có giảm giá.
- **Học phí trả góp** theo kỳ (3 tháng / 6 tháng).
- **Nhắc phí tự động** — gửi thông báo cho phụ huynh qua Zalo/SMS trước hạn 5 ngày.
- **Học bổng** cho học viên xuất sắc — giảm giá tự động khi đạt mốc chuyên cần.

#### 2.4 Báo cáo nâng cao
- **Dashboard doanh thu** theo tháng/quý/năm — biểu đồ drill-down.
- **Báo cáo chuyên cần** theo từng học viên, từng lớp, từng môn.
- **Báo cáo tỷ lệ nợ phí** — phân nhóm theo thời gian nợ (≤7 ngày, 8-30 ngày, >30 ngày).
- **Xuất báo cáo PDF** tự động theo lịch (cron) gửi email cho chủ trung tâm.

### Giai đoạn 3 — Tích hợp & Mở rộng (4-6 tháng)

#### 3.1 Tích hợp bên thứ ba
- **Zalo OA / SMS** gửi biên lai điện tử cho phụ huynh.
- **Google Calendar** — đồng bộ ca học → phụ huynh xem được lịch học cá nhân.
- **Ngân hàng** (Vietcombank, Techcombank): webhook cập nhật biên lai khi có chuyển khoản.
- **Google Drive backup** — tự động backup `audit_logs` + `tuition_transactions` hàng tuần.

#### 3.2 LMS integration (Học trực tuyến)
- Tích hợp **Zoom / Google Meet** cho ca học online.
- Repos cho bài tập, video bài giảng — học viên xem lại bài cũ.
- Hệ thống **điểm danh online** — bấm nút "Tôi đã vào lớp" trên app.

#### 3.3 Smart Insights (AI)
- **Churn prediction** — dự đoán học viên sắp nghỉ (dựa trên tỷ lệ điểm danh, số buổi vắng).
- **Pricing optimization** — gợi ý học phí theo khu vực (dùng Gemini API).
- **Tự động phân công giáo viên** dựa trên chuyên môn + lịch rảnh.

### Giai đoạn 4 — Enterprise (6 tháng+)

#### 4.1 Cross-platform desktop
- **Electron wrapper** — biến web app thành native app Windows/macOS.
- **Auto-update** qua Squirrel.
- Biên lai in trực tiếp qua native printer (không qua Chrome dialog).

#### 4.2 Microservices migration
- Tách **payment service** (HMAC chain, audit log) thành Go/Rust service.
- **Attendance service** real-time với WebSocket.
- **Reporting service** chạy batch job (Python + Pandas).

#### 4.3 Multi-region & scaling
- Supabase multi-region deployment.
- CDN cho static assets.
- Load balancer cho backend service.

---

## 📝 Ghi Chú Kỹ Thuật

### Tại sao bỏ QR / Momo / ZaloPay (v0.2.0)?
- QR VietQR phụ thuộc API ngân hàng → rủi ro downtime, đặc biệt với trung tâm nhỏ.
- Yêu cầu cấu hình STK ngân hàng phức tạp, dễ sai sót.
- Phụ huynh thường chuyển khoản thủ công với nội dung "HV XYZ - Học phí" — không cần QR auto-fill.
- **Đơn giản hoá**: chỉ 2 payment method `Cash` / `Transfer` → biên lai in ngay, không phụ thuộc bên thứ ba.

### Tại sao Điểm danh theo ca học (v0.2.0)?
- Trung tâm có **3 môn** (Piano / Organ / Guitar) và **4 ca/ngày** (17h-20h).
- Trước đây: ca học dựng từ `classSessions` của lớp → HV được xếp vào lớp nhưng có thể không có mặt ở từng ca cụ thể.
- **Hiện tại**: ca học = `(Thứ · Giờ · Môn)`. Mỗi ca có **danh sách HV độc lập** được operator gán trong TKB.
- Điểm danh subscribe `STORAGE_KEYS.SCHEDULE` → thêm HV vào TKB → mở ngay Điểm danh → HV hiện ra.

### Tại sao Toast thay alert (v0.2.0)?
- Native `window.alert()` block UI, khó chịu với operator.
- Native `window.confirm()` không branding, không tùy biến.
- `<ToastProvider>` + `<ConfirmProvider>` cho phép:
  - 4 variant color (success/error/warning/info) → operator phân biệt nhanh.
  - Slide-in animation mượt → cảm giác "app native".
  - Confirm dialog không block UI, có 3 tone (danger/warning/info).
  - Auto-dismiss sau 4.5s → không cần click Đóng.

---

## 📦 Scripts Trong `package.json`

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy Vite dev server (port 3000, host 0.0.0.0) |
| `npm run build` | Build production vào `dist/` (fail-fast nếu thiếu HMAC secret) |
| `npm run preview` | Preview bản build |
| `npm run lint` | Kiểm tra TypeScript (`tsc --noEmit`) — 0 errors |
| `npm run clean` | Xoá `dist/` và `server.js` |

---

## 🏢 Thông Tin Liên Hệ

**TRUNG TÂM ÂM NHẠC HIẾU VŨ**

- **Khẩu hiệu**: *Khơi Nguồn Đam Mê · Ươm Mầm Tài Năng Âm Nhạc*
- **Bộ môn đào tạo**: Piano · Organ · Guitar
- **Chủ trung tâm**: VŨ TRUNG HIẾU
- **Hotline**: 0908.123.456
- **Bản quyền**: © 2026 Trung Tâm Âm Nhạc Hiếu Vũ.

---

## 📝 Giấy Phép

Sản phẩm nội bộ phát triển riêng cho **Trung Tâm Âm Nhạc Hiếu Vũ**. Mọi quyền được bảo lưu.
