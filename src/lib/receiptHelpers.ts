import { TuitionTransaction, Payment } from '../types';

export type ReceiptRow = {
  id: string;
  source: 'legacy' | 'v2';
  invoiceNumber: string;
  studentName: string;
  period: string;
  amount: number;
  paymentDate: string;
  paymentMethod: TuitionTransaction['paymentMethod'] | Payment['paymentMethod'];
  collectorName: string;
  isVoided: boolean;
  integrityHash: string;
  notes?: string;
  printedAt?: string;
};

export function rowFromLegacy(tx: TuitionTransaction): ReceiptRow {
  return {
    id: tx.id,
    source: 'legacy',
    invoiceNumber: tx.invoiceNumber,
    studentName: tx.studentName,
    period: tx.period,
    amount: tx.amount,
    paymentDate: tx.paymentDate,
    paymentMethod: tx.paymentMethod,
    collectorName: tx.collectorName,
    isVoided: tx.isVoided,
    integrityHash: tx.integrityHash,
    notes: tx.notes,
    printedAt: tx.printedAt,
  };
}

export function rowFromV2(p: Payment): ReceiptRow {
  return {
    id: p.id,
    source: 'v2',
    invoiceNumber: p.receiptNumber,
    studentName: p.studentName,
    period: p.notes ?? '',
    amount: p.amount,
    paymentDate: p.paymentDate,
    paymentMethod: p.paymentMethod,
    collectorName: p.collectorName,
    isVoided: p.isVoided,
    integrityHash: p.integrityHash,
    notes: p.notes,
    printedAt: p.printedAt,
  };
}
