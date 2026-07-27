/**
 * Helper to interact with Google Sheets API and Google Calendar API
 */

export interface GoogleSheetsExportResult {
  success: boolean;
  spreadsheetUrl?: string;
  spreadsheetId?: string;
  error?: string;
}

export interface GoogleCalendarSyncResult {
  success: boolean;
  createdEventsCount?: number;
  calendarUrl?: string;
  error?: string;
}

// Global token holder if provided in session
let currentOAuthToken: string | null = null;

export function setOAuthToken(token: string | null) {
  currentOAuthToken = token;
}

export function getOAuthToken(): string | null {
  if (currentOAuthToken) return currentOAuthToken;
  // Try retrieving from session or window if injected
  return (window as any).__OAUTH_ACCESS_TOKEN__ || localStorage.getItem("google_oauth_token") || null;
}

/**
 * Creates a new Google Sheet and populates it with headers and data rows
 */
export async function exportToGoogleSheets(
  title: string,
  headers: string[],
  rows: (string | number)[][]
): Promise<GoogleSheetsExportResult> {
  const token = getOAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Chưa kết nối Google OAuth. Vui lòng xác thực tài khoản Google Workspace.",
    };
  }

  try {
    // 1. Create Spreadsheet
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          title: `${title} - Trung Tâm Âm Nhạc Hiếu Vũ (${new Date().toLocaleDateString("vi-VN")})`,
        },
      }),
    });

    if (!createRes.ok) {
      const errJson = await createRes.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || `Lỗi tạo Google Sheet (${createRes.status})`);
    }

    const sheetData = await createRes.json();
    const spreadsheetId = sheetData.spreadsheetId;
    const spreadsheetUrl = sheetData.spreadsheetUrl;

    // 2. Populate values
    const values = [headers, ...rows];
    const range = "A1";

    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values,
        }),
      }
    );

    if (!updateRes.ok) {
      const errJson = await updateRes.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || "Lỗi ghi dữ liệu vào Google Sheet");
    }

    return {
      success: true,
      spreadsheetId,
      spreadsheetUrl,
    };
  } catch (err: any) {
    console.error("Google Sheets Export Error:", err);
    return {
      success: false,
      error: err.message || "Không thể kết nối dịch vụ Google Sheets",
    };
  }
}

/**
 * Creates Calendar Events on Primary Calendar for class schedules or attendance sessions
 */
export async function syncToGoogleCalendar(
  events: {
    summary: string;
    description: string;
    location: string;
    startIso: string;
    endIso: string;
  }[]
): Promise<GoogleCalendarSyncResult> {
  const token = getOAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Chưa kết nối Google OAuth. Vui lòng xác thực tài khoản Google Workspace.",
    };
  }

  try {
    let createdCount = 0;

    for (const ev of events) {
      const body = {
        summary: ev.summary,
        description: ev.description,
        location: ev.location || "Trung Tâm Âm Nhạc Hiếu Vũ",
        start: {
          dateTime: ev.startIso,
          timeZone: "Asia/Ho_Chi_Minh",
        },
        end: {
          dateTime: ev.endIso,
          timeZone: "Asia/Ho_Chi_Minh",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
            { method: "popup", minutes: 10 },
          ],
        },
      };

      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        createdCount++;
      }
    }

    return {
      success: true,
      createdEventsCount: createdCount,
      calendarUrl: "https://calendar.google.com/",
    };
  } catch (err: any) {
    console.error("Google Calendar Sync Error:", err);
    return {
      success: false,
      error: err.message || "Không thể đồng bộ lịch lên Google Calendar",
    };
  }
}
