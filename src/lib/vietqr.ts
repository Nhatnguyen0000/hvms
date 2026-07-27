/**
 * VietQR / NAPAS IBFT v2 EMV QR string generator.
 *
 * Spec: https://www.vietqr.net/ (publicly published by NAPAS for all
 * member banks in Vietnam). MB Bank BIN is 970422.
 *
 * EMV QR structure used here:
 *   00  - Payload Format Indicator         "01"
 *   01  - Point of Initiation Method       "11" (static) or "12" (dynamic)
 *   38  - Merchant Account Information (tag 00 = VietQR GUID, tag 01 = BIN, tag 02 = account#)
 *   53  - Transaction Currency             "704" (VND)
 *   54  - Transaction Amount
 *   58  - Country Code                     "VN"
 *   59  - Merchant Name
 *   60  - Merchant City
 *   62  - Additional Data (tag 05 = reference / addInfo)
 *   63  - CRC16 (CCITT) checksum
 *
 * The function builds the payload manually (no external lib) and
 * appends the CRC16 checksum per EMVCo spec.
 */

export type VietQRTemplate = 'compact' | 'compact2' | 'qr';

const VIETQR_GUID = 'A000000727';
const COUNTRY_CODE = 'VN';
const CURRENCY_VND = '704';
const DEFAULT_MERCHANT_CITY = 'HO CHI MINH';

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function buildMerchantAccount(bin: string, accountNumber: string): string {
  return tlv('00', VIETQR_GUID) + tlv('01', bin) + tlv('02', accountNumber);
}

/**
 * CRC-16/CCITT-FALSE used by EMVCo QR. Polynomial 0x1021, init 0xFFFF,
 * final XOR 0x0000, no reflection. Verifies the whole TLV string
 * (without the trailing `6304XXXX` chunk).
 */
export function crc16Ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface VietQRParams {
  bankBin: string;
  accountNumber: string;
  accountName: string;
  amount?: number;
  addInfo?: string;
  template?: VietQRTemplate;
  merchantCity?: string;
}

/**
 * Build a VietQR EMV QR string. Pass `amount` to make it dynamic
 * (`0112` initiation) or omit for static (`0111`).
 */
export function generateVietQRPayload(params: VietQRParams): string {
  const template = params.template ?? 'compact2';
  const isDynamic = typeof params.amount === 'number' && params.amount > 0;
  const initiation = isDynamic ? '12' : '11';

  const merchantAccount = buildMerchantAccount(params.bankBin, params.accountNumber);
  const accName = params.accountName.toUpperCase().trim().slice(0, 25);

  let payload = '';
  payload += tlv('00', '01');
  payload += tlv('01', initiation);
  payload += tlv('38', merchantAccount);
  payload += tlv('53', CURRENCY_VND);
  if (isDynamic && params.amount) {
    payload += tlv('54', Math.round(params.amount).toString());
  }
  payload += tlv('58', COUNTRY_CODE);
  payload += tlv('59', accName);
  payload += tlv('60', (params.merchantCity ?? DEFAULT_MERCHANT_CITY).toUpperCase().slice(0, 15));

  if (params.addInfo && params.addInfo.trim().length > 0) {
    const info = params.addInfo.replace(/[^A-Za-z0-9 \-_]/g, '').slice(0, 50);
    payload += tlv('62', tlv('05', info));
  }

  const tag63 = '63' + '04' + crc16Ccitt(payload);
  return payload + tag63;
}

export interface ParsedVietQR {
  valid: boolean;
  amount?: number;
  accountNumber?: string;
  bin?: string;
  addInfo?: string;
  merchantName?: string;
  raw: string;
}

/**
 * Lightweight parser — enough to extract amount, account number and
 * reference text from a generated payload so the receipt UI can show
 * "scanned contents" without round-tripping through a QR scanner.
 */
export function parseVietQRPayload(payload: string): ParsedVietQR {
  let pos = 0;
  const fields: Record<string, string> = {};
  while (pos < payload.length) {
    const tag = payload.substr(pos, 2);
    const lenStr = payload.substr(pos + 2, 2);
    const len = parseInt(lenStr, 10);
    if (isNaN(len)) break;
    const val = payload.substr(pos + 4, len);
    fields[tag] = val;
    pos += 4 + len;
    if (tag === '63') break;
  }
  const merchantAccount = fields['38'] ?? '';
  // merchantAccount is itself a nested TLV: 00=GUID, 01=BIN, 02=account
  let accBin: string | undefined;
  let accNumber: string | undefined;
  if (merchantAccount.length >= 4) {
    let mPos = 0;
    while (mPos < merchantAccount.length) {
      const mTag = merchantAccount.substr(mPos, 2);
      const mLen = parseInt(merchantAccount.substr(mPos + 2, 2), 10);
      const mVal = merchantAccount.substr(mPos + 4, mLen);
      if (mTag === '01') accBin = mVal;
      if (mTag === '02') accNumber = mVal;
      mPos += 4 + mLen;
    }
  }
  const additionalData = fields['62'] ?? '';
  let addInfo: string | undefined;
  if (additionalData.length >= 4) {
    const innerTag = additionalData.substr(0, 2);
    const innerLen = parseInt(additionalData.substr(2, 2), 10);
    if (innerTag === '05') addInfo = additionalData.substr(4, innerLen);
  }
  const amountRaw = fields['54'];
  return {
    valid: Boolean(fields['00'] && fields['38']),
    amount: amountRaw ? parseInt(amountRaw, 10) : undefined,
    accountNumber: accNumber,
    bin: accBin,
    addInfo,
    merchantName: fields['59'],
    raw: payload,
  };
}

export const VIETQR_TEMPLATES: VietQRTemplate[] = ['compact', 'compact2', 'qr'];