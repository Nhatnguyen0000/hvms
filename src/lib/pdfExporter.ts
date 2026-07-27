import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Student, TuitionTransaction } from '../types';
import { getStudentTuitionSummary, getClassGroups } from './storage';
import { formatVND } from './currencyHelper';

/**
 * Force load all required Be Vietnam Pro weights so html2canvas rasterizes
 * Vietnamese text with the correct glyphs (avoids tofu boxes / wrong fallback).
 */
async function ensureVietnameseFontsLoaded(): Promise<void> {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([
      document.fonts.load('400 16px "Be Vietnam Pro"'),
      document.fonts.load('500 16px "Be Vietnam Pro"'),
      document.fonts.load('600 16px "Be Vietnam Pro"'),
      document.fonts.load('700 16px "Be Vietnam Pro"'),
      document.fonts.load('800 16px "Be Vietnam Pro"'),
      document.fonts.load('400 16px "Segoe UI"'),
      document.fonts.load('700 16px "Segoe UI"'),
    ]);
    if (document.fonts.ready) {
      await document.fonts.ready;
    }
  } catch {
    // Swallow – fallback fonts in CSS will still cover Latin glyphs.
  }
}

/**
 * Ensures all web fonts and images in an element are completely loaded before html2canvas capture.
 */
async function prepareElementForCapture(element: HTMLElement): Promise<void> {
  await ensureVietnameseFontsLoaded();

  // Wait for all images inside element (and descendants) to be loaded
  const images = Array.from(element.querySelectorAll('img'));
  const imagePromises = images.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  });
  await Promise.all(imagePromises);

  // Allow the browser an extra beat to settle the layout with the correct fonts
  await new Promise((resolve) => setTimeout(resolve, 250));
}

/**
 * Build the cloned <head> style that html2canvas will use while rasterizing.
 * This guarantees every node picks up Be Vietnam Pro for Vietnamese diacritics
 * and replaces Tailwind v4 `oklch(...)` colors with rgb() equivalents so
 * html2canvas can parse them.
 */
function buildCloneStyle(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=block');
    html, body, * {
      font-family: 'Be Vietnam Pro', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
      text-rendering: geometricPrecision !important;
    }
    /* Strip oklch() colors that html2canvas v1 cannot parse. Replace with
       safe RGB fallbacks. We only touch the cloned document so the live
       UI keeps its full Tailwind v4 palette. */
    .print-area,
    .print-area * {
      background-color: rgb(255, 255, 255) !important;
      color: rgb(15, 23, 42) !important;
      border-color: rgb(226, 232, 240) !important;
      -webkit-text-fill-color: rgb(15, 23, 42) !important;
      box-shadow: none !important;
      filter: none !important;
    }
  `;
}

/**
 * Capture an HTML element and download as a high-quality PDF document.
 */
export async function downloadElementAsPDF(
  element: HTMLElement,
  fileName: string = 'Tai_Lieu_HiieuVu.pdf'
): Promise<void> {
  await prepareElementForCapture(element);

  const canvas = await html2canvas(element, {
    scale: 3, // Crisp text
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    onclone: async (clonedDoc) => {
      const style = clonedDoc.createElement('style');
      style.innerHTML = buildCloneStyle();
      clonedDoc.head.appendChild(style);
      // Re-trigger font loading inside the cloned document so canvas picks the right glyphs
      try {
        await (clonedDoc as any).fonts?.ready;
      } catch {
        /* noop */
      }
    },
  });

  const imgData = canvas.toDataURL('image/png');
  const imgWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF('p', 'mm', 'a4');
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
}

/**
 * Generate and download PDF for a single Tuition Receipt.
 */
export async function exportReceiptPDF(
  receiptElement: HTMLElement,
  invoiceNumber: string
): Promise<void> {
  await prepareElementForCapture(receiptElement);

  const canvas = await html2canvas(receiptElement, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: receiptElement.scrollWidth,
    windowHeight: receiptElement.scrollHeight,
    onclone: async (clonedDoc) => {
      const style = clonedDoc.createElement('style');
      style.innerHTML = buildCloneStyle();
      clonedDoc.head.appendChild(style);
      try {
        await (clonedDoc as any).fonts?.ready;
      } catch {
        /* noop */
      }
    },
  });

  const imgData = canvas.toDataURL('image/png');
  const widthMm = 148; // A5 width
  const heightMm = (canvas.height * widthMm) / canvas.width;

  const pdf = new jsPDF({
    orientation: heightMm > widthMm ? 'p' : 'l',
    unit: 'mm',
    format: [widthMm, Math.max(heightMm, 210)],
  });

  pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
  pdf.save(`Bien_Lai_${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`);
}

// ─── Student Card PDF Export ────────────────────────────────────────────────

interface StudentCardPDFOptions {
  student: { code: string; fullName: string; gender?: string; joinDate?: string };
  qrDataUrl: string | null;
  specialization: string;
  joinDateDisplay: string;
  centerName: string;
  centerPhone: string;
  centerAddress?: string;
  ownerName: string;
  logoUrl: string;
}

async function fetchLogoAsBase64_v2(url: string): Promise<string> {
  try {
    const absUrl = new URL(url, window.location.href).href;
    const res = await fetch(absUrl);
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : url);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

/**
 * Export Student Card PDF (portrait, auto-height).
 * Builds an isolated off-screen HTML container with ONLY inline styles.
 * Height is auto — measured after render to avoid any content clipping.
 */
export function buildStudentCardHtml(opts: StudentCardPDFOptions): string {
  const {
    student, qrDataUrl, specialization, joinDateDisplay,
    centerName, centerPhone, centerAddress, ownerName, logoUrl,
  } = opts;

  const GOLD   = '#f59e0b';
  const GOLD_L = '#fcd34d';
  const GOLD_D = '#92400e';
  const W      = 560;
  const STRIPE = `linear-gradient(90deg,${GOLD_D},${GOLD},${GOLD_L},${GOLD},${GOLD_D})`;

  const qrImg = qrDataUrl
    ? `<img src="${qrDataUrl}" style="width:130px;height:130px;display:block;border-radius:6px;">`
    : `<div style="width:130px;height:130px;background:#e2e8f0;border-radius:6px;"></div>`;

  const addressRow = centerAddress
    ? `<div style="font-size:10.5px;color:#cbd5e1;line-height:1.4;"><span style="color:#94a3b8;">Địa chỉ: </span><span style="color:#e2e8f0;font-weight:600;">${centerAddress}</span></div>`
    : '';

  return `
<div style="width:${W}px;background-color:#000;color:#fff;border-radius:20px;border:2px solid rgba(245,158,11,0.8);box-sizing:border-box;font-family:'Be Vietnam Pro','Segoe UI',Roboto,sans-serif;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
  <div style="height:5px;flex-shrink:0;background:${STRIPE};"></div>
  <div style="padding:22px 26px 18px;display:flex;flex-direction:column;gap:16px;">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(245,158,11,0.3);padding-bottom:14px;">
      <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
        <img src="${logoUrl}" style="width:44px;height:44px;object-fit:contain;display:block;flex-shrink:0;">
        <div style="font-size:13px;font-weight:900;color:${GOLD};text-transform:uppercase;letter-spacing:0.5px;line-height:1.4;padding:2px 0;">${centerName}</div>
      </div>
      <span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:2px;padding:4px 12px;border-radius:999px;background-color:rgba(245,158,11,0.15);color:${GOLD_L};border:1px solid rgba(245,158,11,0.45);line-height:1;display:inline-block;">STUDENT CARD</span>
    </div>

    <!-- Body -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;">
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:10px;">
        <div style="display:inline-block;align-self:flex-start;font-family:monospace;font-size:11px;font-weight:700;color:${GOLD_L};background-color:rgba(245,158,11,0.15);padding:3px 10px;border-radius:5px;border:1px solid rgba(245,158,11,0.35);letter-spacing:0.5px;line-height:1.3;">MÃ HV: ${student.code}</div>
        <div>
          <div style="font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:700;letter-spacing:0.8px;margin-bottom:2px;">HỌ VÀ TÊN HỌC VIÊN</div>
          <div style="font-size:20px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:-0.3px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${student.fullName}</div>
        </div>
        <div>
          <div style="font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:700;letter-spacing:0.8px;margin-bottom:2px;">CHUYÊN MÔN / LỚP HỌC</div>
          <div style="font-size:13px;font-weight:700;color:${GOLD_L};line-height:1.25;">${specialization}</div>
        </div>
        <div style="display:flex;gap:24px;align-items:flex-start;padding-top:2px;">
          <div>
            <div style="font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:700;letter-spacing:0.5px;margin-bottom:2px;">GIỚI TÍNH</div>
            <div style="font-size:12px;font-weight:700;color:#e2e8f0;">${student.gender || '—'}</div>
          </div>
          <div>
            <div style="font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:700;letter-spacing:0.5px;margin-bottom:2px;">NGÀY NHẬP HỌC</div>
            <div style="font-size:12px;font-weight:700;color:#e2e8f0;">${joinDateDisplay}</div>
          </div>
        </div>
      </div>
      <div style="background-color:#fff;padding:8px;border-radius:14px;border:2px solid rgba(245,158,11,0.6);flex-shrink:0;display:flex;align-items:center;justify-content:center;">
        ${qrImg}
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid rgba(148,163,184,0.2);padding-top:10px;display:flex;flex-direction:column;gap:3px;">
      <div style="font-size:10.5px;color:#cbd5e1;line-height:1.4;">
        <span style="color:#94a3b8;">Hotline: </span><span style="color:#fff;font-weight:700;">${centerPhone}</span>
        <span style="color:#64748b;margin:0 6px;">·</span>
        <span style="color:#94a3b8;">Chủ trung tâm: </span><span style="color:${GOLD_L};font-weight:800;text-transform:uppercase;">${ownerName}</span>
      </div>
      ${addressRow}
    </div>
  </div>
  <div style="height:5px;flex-shrink:0;background:${STRIPE};"></div>
</div>`.trim();
}

/**
 * Print Student Card directly using an isolated, zero-overhead iframe.
 * Converts logo to Base64 inline string so it never disappears or fails relative URL loading.
 */
export async function printStudentCardDirectly(opts: StudentCardPDFOptions): Promise<void> {
  const logoBase64 = await fetchLogoAsBase64_v2(opts.logoUrl);
  const optsWithBase64Logo = { ...opts, logoUrl: logoBase64 };
  const cardHtml = buildStudentCardHtml(optsWithBase64Logo);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const safeCode = opts.student.code.replace(/[^a-zA-Z0-9-]/g, '_');
  const safeName = opts.student.fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_');
  const printTitle = `${safeName}_${safeCode}`;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${printTitle}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800;900&display=swap');
          @page {
            margin: 0;
            size: auto;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            font-family: 'Be Vietnam Pro', sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
            box-sizing: border-box;
            background: #ffffff;
          }
        </style>
      </head>
      <body>
        <div class="print-wrapper">
          ${cardHtml}
        </div>
      </body>
    </html>
  `);
  doc.close();

  // Wait for all images inside iframe to be ready before triggering print
  const images = Array.from(doc.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        })
    )
  );

  // Swap the main window title → becomes the "Save as PDF" filename in most browsers
  const originalTitle = document.title;
  document.title = printTitle;

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    // Restore original title after a short delay (after print dialog opens)
    setTimeout(() => {
      document.title = originalTitle;
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 200);
}

/**
 * Export Student Card PDF (portrait/landscape auto-height).
 * Builds an isolated off-screen HTML container with ONLY inline styles.
 */
export async function exportStudentCardPDF(opts: StudentCardPDFOptions): Promise<void> {
  const {
    student, qrDataUrl, specialization, joinDateDisplay,
    centerName, centerPhone, centerAddress, ownerName, logoUrl,
  } = opts;

  const logoBase64 = await fetchLogoAsBase64_v2(logoUrl);

  const optsWithBase64Logo = { ...opts, logoUrl: logoBase64 };
  const html = buildStudentCardHtml(optsWithBase64Logo);
  const W = 560;

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left     = '-99999px';
  wrapper.style.top      = '0';
  wrapper.style.width    = `${W}px`;
  wrapper.style.zIndex   = '-1';
  wrapper.innerHTML      = html;
  document.body.appendChild(wrapper);

  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  try {
    const cardEl  = wrapper.firstElementChild as HTMLElement;
    const actualH = cardEl.getBoundingClientRect().height || cardEl.scrollHeight || 340;

    const canvas = await html2canvas(cardEl, {
      scale: 3,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#000000',
      width: W,
      height: Math.ceil(actualH),
      windowWidth: W,
      windowHeight: Math.ceil(actualH),
    });

    const imgData = canvas.toDataURL('image/png');
    const px2mm   = 0.264583;
    const pdfW    = Math.round(W       * px2mm * 10) / 10;
    const pdfH    = Math.round(actualH * px2mm * 10) / 10;

    const pdf = new jsPDF({ orientation: pdfW >= pdfH ? 'l' : 'p', unit: 'mm', format: [pdfW, pdfH] });
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
    const safeCode = student.code.replace(/[^a-zA-Z0-9-]/g, '_');
    const safeName = student.fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
    pdf.save(`The_Hoc_Vien_${safeCode}_${safeName}.pdf`);
  } finally {
    document.body.removeChild(wrapper);
  }
}



/**
 * Export Student List to PDF with full center branding and formatted table.
 */
export async function exportStudentListPDF(
  students: Student[],
  filterTitle?: string
): Promise<void> {
  const classGroups = getClassGroups();
  const dateStr = new Date().toLocaleDateString('vi-VN');

  // Create container attached in viewport bounding area for ideal canvas rasterization
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '1050px';
  container.style.padding = '40px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = "'Be Vietnam Pro', 'Segoe UI', Roboto, Arial, sans-serif";
  container.style.zIndex = '-9999';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';

  const rows = students.map((s, index) => {
    const summary = getStudentTuitionSummary(s.id);
    const enrolledNames = classGroups
      .filter((c) => s.enrolledClassIds.includes(c.id))
      .map((c) => c.name)
      .join(', ');

    const statusText =
      s.status === 'Active'
        ? '<span style="color:#059669;font-weight:bold;">Đang học</span>'
        : s.status === 'Reserved'
        ? '<span style="color:#d97706;font-weight:bold;">Bảo lưu</span>'
        : '<span style="color:#dc2626;font-weight:bold;">Nghỉ học</span>';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
        <td style="padding: 10px 6px; text-align: center;">${index + 1}</td>
        <td style="padding: 10px 8px; font-weight: bold; color: #1e293b;">
          ${s.fullName}
          <div style="font-size: 10px; color: #64748b; font-weight: normal;">Mã: ${s.code}</div>
        </td>
        <td style="padding: 10px 8px;">${s.phone || '---'}</td>
        <td style="padding: 10px 8px;">${enrolledNames || 'Chưa xếp lớp'}</td>
        <td style="padding: 10px 8px; text-align: center;">${statusText}</td>
        <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #2563eb;">
          ${formatVND(summary.totalPaid)}
        </td>
        <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: ${
          summary.remainingAmount > 0 ? '#dc2626' : '#059669'
        };">
          ${summary.remainingAmount > 0 ? formatVND(summary.remainingAmount) : 'Hoàn thành'}
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div style="border-bottom: 2px solid #b48648; padding-bottom: 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <img src="/HieuVu_Logo.png" style="width: 64px; height: 64px; object-fit: contain;" />
        <div>
          <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">
            TRUNG TÂM ÂM NHẠC HIẾU VŨ
          </h1>
          <p style="font-size: 12px; color: #b48648; font-weight: 700; margin: 2px 0 0 0;">
            Khơi Nguồn Đam Mê · Ươm Mầm Tài Năng Âm Nhạc (Piano · Organ · Guitar) | Hotline: 0908.123.456
          </p>
        </div>
      </div>
      <div style="text-align: right; font-size: 11px; color: #64748b;">
        <div><strong>Ngày xuất PDF:</strong> ${dateStr}</div>
        <div><strong>Tổng số học viên:</strong> ${students.length} học viên</div>
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="font-size: 18px; font-weight: 800; color: #1e293b; margin: 0; text-transform: uppercase;">
        DANH SÁCH HỌC VIÊN
      </h2>
      ${
        filterTitle
          ? `<p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Lọc theo: ${filterTitle}</p>`
          : ''
      }
    </div>

    <table style="width: 100%; border-collapse: collapse; text-align: left;">
      <thead>
        <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">
          <th style="padding: 10px 6px; text-align: center; width: 40px;">STT</th>
          <th style="padding: 10px 8px;">Học Viên</th>
          <th style="padding: 10px 8px;">Số Điện Thoại</th>
          <th style="padding: 10px 8px;">Lớp Học Đang Theo</th>
          <th style="padding: 10px 8px; text-align: center;">Trạng Thái</th>
          <th style="padding: 10px 8px; text-align: right;">Đã Nộp</th>
          <th style="padding: 10px 8px; text-align: right;">Còn Nợ</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join('')}
      </tbody>
    </table>

    <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
      <div>Trung Tâm Âm Nhạc Hiếu Vũ - Hệ Thống Quản Lý Số Hóa</div>
      <div>Trang 1 / 1</div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    await downloadElementAsPDF(
      container,
      `Danh_Sach_Hoc_Vien_HiieuVu_${new Date().toISOString().slice(0, 10)}.pdf`
    );
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Export Financial / Tuition Receipts List to PDF.
 */
export async function exportTuitionListPDF(
  transactions: TuitionTransaction[],
  filterTitle?: string
): Promise<void> {
  const dateStr = new Date().toLocaleDateString('vi-VN');
  const totalAmount = transactions
    .filter((t) => !t.isVoided)
    .reduce((sum, t) => sum + t.amount, 0);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '1050px';
  container.style.padding = '40px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = "'Be Vietnam Pro', 'Segoe UI', Roboto, Arial, sans-serif";
  container.style.zIndex = '-9999';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';

  const rows = transactions.map((t, index) => {
    const methodLabel =
      t.paymentMethod === 'Cash'
        ? 'Tiền mặt'
        : t.paymentMethod === 'Transfer'
        ? 'Chuyển khoản'
        : t.paymentMethod;
    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px; ${
        t.isVoided ? 'background-color: #fef2f2; opacity: 0.7;' : ''
      }">
        <td style="padding: 10px 6px; text-align: center;">${index + 1}</td>
        <td style="padding: 10px 8px; font-weight: bold; color: #0284c7;">
          ${t.invoiceNumber}
        </td>
        <td style="padding: 10px 8px; font-weight: bold;">${t.studentName}</td>
        <td style="padding: 10px 8px;">${t.paymentDate}</td>
        <td style="padding: 10px 8px;">${methodLabel}</td>
        <td style="padding: 10px 8px;">${t.period}</td>
        <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: ${
          t.isVoided ? '#dc2626' : '#059669'
        };">
          ${formatVND(t.amount)}
        </td>
        <td style="padding: 10px 8px; text-align: center;">
          ${
            t.isVoided
              ? '<span style="color:#dc2626;font-weight:bold;">Đã Hủy</span>'
              : '<span style="color:#059669;font-weight:bold;">Hợp Lệ</span>'
          }
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div style="border-bottom: 2px solid #b48648; padding-bottom: 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <img src="/HieuVu_Logo.png" style="width: 64px; height: 64px; object-fit: contain;" />
        <div>
          <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">
            TRUNG TÂM ÂM NHẠC HIẾU VŨ
          </h1>
          <p style="font-size: 12px; color: #b48648; font-weight: 700; margin: 2px 0 0 0;">
            Khơi Nguồn Đam Mê · Ươm Mầm Tài Năng Âm Nhạc (Piano · Organ · Guitar) | Hotline: 0908.123.456
          </p>
        </div>
      </div>
      <div style="text-align: right; font-size: 11px; color: #64748b;">
        <div><strong>Ngày xuất PDF:</strong> ${dateStr}</div>
        <div><strong>Tổng thực thu:</strong> <span style="color:#059669; font-weight: bold;">${formatVND(
          totalAmount
        )}</span></div>
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="font-size: 18px; font-weight: 800; color: #1e293b; margin: 0; text-transform: uppercase;">
        SỔ QUỸ THU HỌC PHÍ & BIÊN LAI
      </h2>
      ${
        filterTitle
          ? `<p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Lọc theo: ${filterTitle}</p>`
          : ''
      }
    </div>

    <table style="width: 100%; border-collapse: collapse; text-align: left;">
      <thead>
        <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">
          <th style="padding: 10px 6px; text-align: center; width: 40px;">STT</th>
          <th style="padding: 10px 8px;">Số Biên Lai</th>
          <th style="padding: 10px 8px;">Học Viên</th>
          <th style="padding: 10px 8px;">Ngày Thu</th>
          <th style="padding: 10px 8px;">Hình Thức</th>
          <th style="padding: 10px 8px;">Nội Dung / Kỳ Học</th>
          <th style="padding: 10px 8px; text-align: right;">Số Tiền</th>
          <th style="padding: 10px 8px; text-align: center;">Trạng Thái</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join('')}
      </tbody>
    </table>

    <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
      <div>Trung Tâm Âm Nhạc Hiếu Vũ - Sổ Quỹ Thu Học Phí Số Hóa</div>
      <div>Trang 1 / 1</div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    await downloadElementAsPDF(
      container,
      `So_Quy_Hoc_Phi_HiieuVu_${new Date().toISOString().slice(0, 10)}.pdf`
    );
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Export tuition transactions using html2canvas (full Vietnamese glyph support).
 * The previous jsPDF-based version broke on diacritics – the canvas rasterizer
 * guarantees the same crisp Vietnamese text used everywhere else in the app.
 */
export async function exportTuitionAutoTablePDF(
  transactions: TuitionTransaction[],
  title: string = 'SỔ QUỸ THU HỌC PHÍ'
): Promise<void> {
  const dateStr = new Date().toLocaleDateString('vi-VN');
  const totalAmount = transactions
    .filter((t) => !t.isVoided)
    .reduce((sum, t) => sum + t.amount, 0);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '1050px';
  container.style.padding = '40px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = "'Be Vietnam Pro', 'Segoe UI', Roboto, Arial, sans-serif";
  container.style.zIndex = '-9999';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';

  const rows = transactions.map((t, index) => {
    const statusCell = t.isVoided
      ? '<span style="color:#dc2626;font-weight:bold;">Đã Hủy</span>'
      : '<span style="color:#059669;font-weight:bold;">Hợp Lệ</span>';
    const amountColor = t.isVoided ? '#dc2626' : '#059669';
    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px; ${
        t.isVoided ? 'background-color: #fef2f2; opacity: 0.7;' : ''
      }">
        <td style="padding: 10px 6px; text-align: center;">${index + 1}</td>
        <td style="padding: 10px 8px; font-weight: bold; color: #0284c7;">${t.invoiceNumber}</td>
        <td style="padding: 10px 8px; font-weight: bold;">${t.studentName}</td>
        <td style="padding: 10px 8px;">${t.paymentDate}</td>
        <td style="padding: 10px 8px;">${
          t.paymentMethod === 'Cash' ? 'Tiền mặt' : 'Chuyển khoản'
        }</td>
        <td style="padding: 10px 8px;">${t.period}</td>
        <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: ${amountColor};">
          ${formatVND(t.amount)}
        </td>
        <td style="padding: 10px 8px; text-align: center;">${statusCell}</td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div style="border-bottom: 2px solid #b48648; padding-bottom: 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <img src="/HieuVu_Logo.png" style="width: 64px; height: 64px; object-fit: contain;" />
        <div>
          <h1 style="font-size: 20px; font-weight: 800; color: #b48648; margin: 0; text-transform: uppercase;">
            TRUNG TÂM ÂM NHẠC HIẾU VŨ
          </h1>
          <p style="font-size: 12px; color: #64748b; font-weight: 700; margin: 2px 0 0 0;">
            Khơi Nguồn Đam Mê · Ươm Mầm Tài Năng Âm Nhạc (Piano · Organ · Guitar) | Hotline: 0908.123.456
          </p>
        </div>
      </div>
      <div style="text-align: right; font-size: 11px; color: #64748b;">
        <div><strong>Ngày xuất:</strong> ${dateStr}</div>
        <div><strong>Số lượng:</strong> ${transactions.length} biên lai</div>
        <div><strong>Tổng thực thu:</strong> <span style="color:#059669; font-weight: bold;">${formatVND(
          totalAmount
        )}</span></div>
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="font-size: 18px; font-weight: 800; color: #1e293b; margin: 0; text-transform: uppercase;">
        ${title}
      </h2>
    </div>

    <table style="width: 100%; border-collapse: collapse; text-align: left;">
      <thead>
        <tr style="background-color: #b48648; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase;">
          <th style="padding: 10px 6px; text-align: center; width: 40px;">STT</th>
          <th style="padding: 10px 8px;">Số Biên Lai</th>
          <th style="padding: 10px 8px;">Học Viên</th>
          <th style="padding: 10px 8px;">Ngày Thu</th>
          <th style="padding: 10px 8px;">Hình Thức</th>
          <th style="padding: 10px 8px;">Kỳ Học</th>
          <th style="padding: 10px 8px; text-align: right;">Số Tiền</th>
          <th style="padding: 10px 8px; text-align: center;">Trạng Thái</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join('')}
      </tbody>
    </table>

    <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
      <div>Trung Tâm Âm Nhạc Hiếu Vũ - Sổ Quỹ Thu Học Phí Số Hóa</div>
      <div>Trang 1 / 1</div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    await downloadElementAsPDF(
      container,
      `So_Quy_Hoc_Phi_AutoTable_${new Date().toISOString().slice(0, 10)}.pdf`
    );
  } finally {
    document.body.removeChild(container);
  }
}
