import { TuitionTransaction, VerificationResult } from '../types';

/**
 * HMAC Secret for receipt hash chain.
 *
 * Security model:
 *  - In production builds the secret MUST come from VITE_HMAC_SECRET.
 *  - In development, a deterministic fallback is used so the app keeps
 *    working out-of-the-box, but it is rejected at runtime in production
 *    so we never bake a known key into the bundle.
 */
function getHmacSecret(): string {
  const secret = import.meta.env.VITE_HMAC_SECRET as string | undefined;
  const isProd = import.meta.env.PROD;
  const isPlaceholder =
    !secret || secret === '' || secret === 'CHANGE_THIS_TO_A_RANDOM_64_CHAR_HEX_SECRET';

  if (isPlaceholder) {
    if (isProd) {
      throw new Error(
        '[SECURITY] VITE_HMAC_SECRET is missing in production. The receipt chain cannot be signed with a public key. Set a 64-char hex secret in your .env file before deploying.'
      );
    }
    // Dev-only deterministic key. Anyone running the dev server locally can
    // see this string, so it is never safe for production receipts.
    return 'AllegroMusicCenterBlockchainSecret2026DevOnly';
  }
  return secret;
}

let HMAC_SECRET: string;
try {
  HMAC_SECRET = getHmacSecret();
} catch (err) {
  // Re-throw at module init so the app fails fast in production rather than
  // silently signing receipts with the dev fallback.
  console.error(err);
  throw err;
}

/**
 * Modern Web Crypto SHA-256 helper
 */
async function sha256(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Web Crypto HMAC-SHA256 helper
 */
async function hmacSha256(keyStr: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyStr);
  const msgData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, msgData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Format string input for SHA-256 hashing.
 *
 * NOTE: `isVoided` and `voidReason` are intentionally EXCLUDED from the hash
 * input. The chain must only protect the immutable financial fields of the
 * receipt (amount, date, invoice, student, sequence). Voiding is a separate
 * operational state stored alongside the transaction but never breaks the
 * chain — it cannot rewrite history, only stop honoring the receipt.
 */
export function getTransactionHashInput(tx: {
  previousHash: string;
  invoiceNumber: string;
  studentId: string;
  amount: number;
  paymentDate: string;
  sequenceNumber: number;
}): string {
  const formattedAmount = tx.amount.toFixed(2);
  return `${tx.previousHash}|${tx.invoiceNumber}|${tx.studentId}|${formattedAmount}|${tx.paymentDate}|${tx.sequenceNumber}`;
}

/**
 * Computes both integrityHash and digitalSignature for a transaction.
 * Void state is ignored — see getTransactionHashInput for rationale.
 */
export async function computeTransactionSecurity(tx: {
  previousHash: string;
  invoiceNumber: string;
  studentId: string;
  amount: number;
  paymentDate: string;
  sequenceNumber: number;
}): Promise<{ integrityHash: string; digitalSignature: string }> {
  const rawInput = getTransactionHashInput(tx);
  const integrityHash = await sha256(rawInput);
  const digitalSignature = await hmacSha256(HMAC_SECRET, integrityHash);
  return { integrityHash, digitalSignature };
}

/**
 * Re-hashes a transaction using its immutable financial fields.
 * Safe to call after void — does not change the hash because void state
 * is not part of the hash input.
 */
export async function rehashTransaction(tx: TuitionTransaction): Promise<TuitionTransaction> {
  const { integrityHash, digitalSignature } = await computeTransactionSecurity({
    previousHash: tx.previousHash,
    invoiceNumber: tx.invoiceNumber,
    studentId: tx.studentId,
    amount: tx.amount,
    paymentDate: tx.paymentDate,
    sequenceNumber: tx.sequenceNumber,
  });

  return {
    ...tx,
    integrityHash,
    digitalSignature,
  };
}

/**
 * Full Audit & Chain Integrity Verification
 */
export async function verifyChainIntegrity(transactions: TuitionTransaction[]): Promise<VerificationResult> {
  const sorted = [...transactions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const logs: string[] = [];
  
  if (sorted.length === 0) {
    return {
      isValid: true,
      totalTransactions: 0,
      verifiedTransactions: 0,
      tamperedIndex: null,
      logs: ["Chưa có giao dịch nào trong hệ thống."]
    };
  }

  let expectedPreviousHash = "0000000000000000000000000000000000000000000000000000000000000000";

  for (let i = 0; i < sorted.length; i++) {
    const tx = sorted[i];
    logs.push(`[Kiểm tra #${tx.sequenceNumber}] Biên lai ${tx.invoiceNumber} - Học viên: ${tx.studentName}`);

    // Check PreviousHash connection
    if (tx.previousHash !== expectedPreviousHash) {
      logs.push(`❌ LỖI VẸN TOÀN TẠI #${tx.sequenceNumber}: PreviousHash (${tx.previousHash.slice(0, 8)}...) không khớp hash kỳ vọng (${expectedPreviousHash.slice(0, 8)}...)`);
      return {
        isValid: false,
        totalTransactions: sorted.length,
        verifiedTransactions: i,
        tamperedIndex: i,
        errorMessage: `Giao dịch #${tx.sequenceNumber} (${tx.invoiceNumber}) bị gãy chuỗi liên kết PreviousHash!`,
        logs
      };
    }

    // Verify IntegrityHash
    const rawInput = getTransactionHashInput(tx);
    const calculatedHash = await sha256(rawInput);

    if (calculatedHash !== tx.integrityHash) {
      logs.push(`❌ LỖI VẸN TOÀN TẠI #${tx.sequenceNumber}: Hash tính toán không khớp Hash lưu trữ.`);
      logs.push(`   Hash lưu: ${tx.integrityHash}`);
      logs.push(`   Hash thực: ${calculatedHash}`);
      return {
        isValid: false,
        totalTransactions: sorted.length,
        verifiedTransactions: i,
        tamperedIndex: i,
        errorMessage: `Giao dịch #${tx.sequenceNumber} (${tx.invoiceNumber}) có dữ liệu bị can thiệp trái phép!`,
        logs
      };
    }

    // Verify DigitalSignature
    const calculatedSig = await hmacSha256(HMAC_SECRET, tx.integrityHash);
    if (calculatedSig !== tx.digitalSignature) {
      logs.push(`❌ LỖI CHỮ KÝ SỐ TẠI #${tx.sequenceNumber}: Digital Signature không hợp lệ.`);
      return {
        isValid: false,
        totalTransactions: sorted.length,
        verifiedTransactions: i,
        tamperedIndex: i,
        errorMessage: `Giao dịch #${tx.sequenceNumber} (${tx.invoiceNumber}) có chữ ký số HMAC không khớp!`,
        logs
      };
    }

    logs.push(`  ✅ Dữ liệu hợp lệ, Hash & Chữ ký HMAC khớp tuyệt đối.`);
    expectedPreviousHash = tx.integrityHash;
  }

  logs.push(`🎉 XÁC MINH HOÀN TẤT: 100% (${sorted.length}/${sorted.length}) giao dịch đảm bảo vẹn toàn dữ liệu.`);
  return {
    isValid: true,
    totalTransactions: sorted.length,
    verifiedTransactions: sorted.length,
    tamperedIndex: null,
    logs
  };
}
