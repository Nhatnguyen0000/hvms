import { MBBankConfig, CenterSettings } from '../types';

const STORAGE_KEY = 'allegro_mb_bank_config';
const SETTINGS_KEY = 'allegro_center_settings';

export const DEFAULT_MB_BANK_CONFIG: MBBankConfig = {
  bin: '970422',
  bankCode: 'MB',
  bankName: 'MB Bank (Quân Đội)',
  accountNumber: '',
  accountName: 'VU TRUNG HIEU',
  template: 'compact2',
};

export const DEFAULT_CENTER_SETTINGS: CenterSettings = {
  centerName: 'Trung Tâm Âm Nhạc Hiếu Vũ',
  centerAddress: '',
  centerPhone: '',
  centerTaxCode: '',
  receiptFooter: 'Cảm ơn quý phụ huynh đã tin tưởng Trung Tâm Âm Nhạc Hiếu Vũ.',
  billingPolicy: {
    excusedAbsence: 'count',
    unexcusedAbsence: 'donot_deduct',
  },
};

/**
 * Read the MB Bank configuration. The STK/account name are kept in
 * plain localStorage because they need to be available to QR generators
 * during render and are not considered sensitive enough to require
 * encryption (the bank account holder's name is already public info via
 * VietQR lookups once the customer pays).
 */
export function getMBBankConfig(): MBBankConfig {
  if (typeof window === 'undefined') return DEFAULT_MB_BANK_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MB_BANK_CONFIG;
    const parsed = JSON.parse(raw) as Partial<MBBankConfig>;
    return { ...DEFAULT_MB_BANK_CONFIG, ...parsed };
  } catch {
    return DEFAULT_MB_BANK_CONFIG;
  }
}

export function saveMBBankConfig(cfg: MBBankConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

/**
 * Strip Vietnamese diacritics and uppercase — required by VietQR spec.
 */
export function normalizeVietQRName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D').replace(/đ/g, 'D')
    .replace(/[^A-Z0-9 ]/gi, '')
    .toUpperCase()
    .trim();
}

export function getCenterSettings(): CenterSettings {
  if (typeof window === 'undefined') return DEFAULT_CENTER_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_CENTER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<CenterSettings>;
    return { ...DEFAULT_CENTER_SETTINGS, ...parsed, billingPolicy: { ...DEFAULT_CENTER_SETTINGS.billingPolicy, ...parsed.billingPolicy } };
  } catch {
    return DEFAULT_CENTER_SETTINGS;
  }
}

export function saveCenterSettings(settings: CenterSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}