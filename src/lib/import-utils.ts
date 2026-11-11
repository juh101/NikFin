'use client';

import { format, isValid, parse } from 'date-fns';

/**
 * Shared Type for all Parsers
 */
export interface NormalizedImportedTransaction {
  date: string;
  time?: string;
  description: string;
  amount: number;
  incomeExpense: 'Income' | 'Expense';
  category: string;
  paymentMode: string;
  source: 'PhonePe' | 'Paytm' | 'CSV' | 'Excel' | 'Other';
  sourceReference: string;
  transactionId?: string;
  orderId?: string;
  sourceAccount?: string;
  additionalDetails?: string;
  remarks?: string;
  tags?: string;
  comment?: string;
  status: 'valid' | 'duplicate' | 'invalid';
  reason?: string;
  confidence: 'high' | 'medium' | 'low';
  needsDescriptionReview: boolean;
  include: boolean;
  importFingerprint: string;
}

// Global Limits
export const MAX_IMPORT_FILE_SIZE_MB = 10;
export const MAX_IMPORT_FILE_SIZE_BYTES = MAX_IMPORT_FILE_SIZE_MB * 1024 * 1024;
export const MAX_EXCEL_ROWS = 10000;
export const MAX_PDF_PAGES = 100;

/**
 * Robust Header Normalizer
 */
export function normalizeHeader(h: any): string {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.]/g, '')
    .replace(/[()]/g, '');
}

/**
 * Suggests a category based on description, tags, or merchant name
 */
export function suggestCategory(description: string, tags?: string): string {
  const text = `${description} ${tags || ''}`.toLowerCase();
  
  if (text.includes('netflix') || text.includes('spotify') || text.includes('hotstar') || text.includes('bookmyshow') || text.includes('pvr') || text.includes('entertainment') || text.includes('movie') || text.includes('openai')) return 'Entertainment';
  if (text.includes('swiggy') || text.includes('zomato') || text.includes('dominos') || text.includes('pizza') || text.includes('restaurant') || text.includes('cafe') || text.includes('food') || text.includes('canteen') || text.includes('snack') || text.includes('chat center')) return 'Food and snacks';
  if (text.includes('uber') || text.includes('ola') || text.includes('metro') || text.includes('irctc') || text.includes('rail') || text.includes('transport') || text.includes('travel') || text.includes('petrol') || text.includes('fuel')) return 'Transport';
  if (text.includes('bill') || text.includes('recharge') || text.includes('electricity') || text.includes('water') || text.includes('gas') || text.includes('jio') || text.includes('airtel')) return 'Utilities';
  if (text.includes('grocery') || text.includes('bigbasket') || text.includes('blinkit') || text.includes('zepto') || text.includes('mart') || text.includes('supermarket') || text.includes('kirana')) return 'Groceries';
  if (text.includes('salary') || text.includes('hike') || text.includes('stipend')) return 'Salary';
  if (text.includes('zerodha') || text.includes('groww') || text.includes('mutual') || text.includes('invest') || text.includes('stock') || text.includes('sip') || text.includes('iccl')) return 'Investments';
  if (text.includes('rent') || text.includes('maintenance')) return 'Rent';
  
  return 'Other';
}

/**
 * Paytm Date Parser (DD/MM/YYYY)
 */
export function parsePaytmDate(val: string): string | null {
  if (!val) return null;
  const parts = val.trim().split('/');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      const dateStr = `${y}-${m}-${d}`;
      const check = new Date(dateStr);
      if (isValid(check)) return dateStr;
    }
  }
  return null;
}

/**
 * Dedicated Paytm Workbook Parser
 */
export async function parsePaytmWorkbook(workbook: any): Promise<NormalizedImportedTransaction[]> {
  const XLSX = await import('xlsx');
  
  // 1. Specifically target "Passbook Payment History" or similar
  const sheetName = workbook.SheetNames.find((name: string) => {
    const n = normalizeHeader(name);
    return n === 'passbook payment history' || 
           n === 'payment history' || 
           n === 'transaction history' ||
           n === 'statement';
  }) || workbook.SheetNames[0];

  const worksheet = workbook.Sheets[sheetName];
  
  // 2. Read as Raw Arrays to avoid property name collisions and auto-formatting issues
  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false
  });

  if (rows.length === 0) return [];

  // 3. Find the header row by searching for key columns
  let headerRowIndex = -1;
  let colMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i];
    const normalizedRow = row.map(normalizeHeader);
    
    // Require core columns to be identified
    if (normalizedRow.includes('date') && normalizedRow.includes('transaction details') && normalizedRow.includes('amount')) {
      headerRowIndex = i;
      normalizedRow.forEach((h, idx) => {
        if (h === 'date') colMap.date = idx;
        if (h === 'time') colMap.time = idx;
        if (h === 'transaction details') colMap.desc = idx; // MAIN DESCRIPTION
        if (h.includes('other transaction details') || h.includes('upi id') || h.includes('a/c no')) colMap.extra = idx; // TECHNICAL ID
        if (h.includes('your account')) colMap.acc = idx;
        if (h === 'amount') colMap.amount = idx;
        if (h.includes('upi ref no')) colMap.ref = idx;
        if (h.includes('order id')) colMap.order = idx;
        if (h.includes('remarks')) colMap.remarks = idx;
        if (h.includes('tags')) colMap.tags = idx;
        if (h.includes('comment')) colMap.comment = idx;
      });
      break;
    }
  }

  // Mandatory checks
  if (headerRowIndex === -1 || colMap.date === undefined || colMap.amount === undefined || colMap.desc === undefined) {
    console.warn("Paytm Header Mapping Failed:", colMap);
    return [];
  }

  const parsedTransactions: NormalizedImportedTransaction[] = [];

  // 4. Process data rows
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[colMap.date] || !row[colMap.amount]) continue;

    const rawDesc = String(row[colMap.desc] || "").trim();
    const rawExtra = String(row[colMap.extra] || "").trim();
    const rawRemarks = String(row[colMap.remarks] || "").trim();
    const rawComment = String(row[colMap.comment] || "").trim();
    
    // Priority Fallback: 1. Detail, 2. Remarks, 3. Comment, 4. Extra ID, 5. Default
    const finalDescription = rawDesc || rawRemarks || rawComment || rawExtra || "Imported Paytm Entry";

    const amountStr = String(row[colMap.amount]).replace(/[₹,]/g, '').trim();
    const signedAmount = parseFloat(amountStr);
    
    if (isNaN(signedAmount) || signedAmount === 0) continue;

    const parsedDate = parsePaytmDate(String(row[colMap.date]));
    if (!parsedDate) continue;

    const tags = String(row[colMap.tags] || "").trim();
    const ref = String(row[colMap.ref] || "").trim();

    parsedTransactions.push({
      date: parsedDate,
      time: String(row[colMap.time] || "").trim(),
      description: finalDescription,
      amount: Math.abs(signedAmount),
      incomeExpense: signedAmount < 0 ? 'Expense' : 'Income',
      category: suggestCategory(finalDescription, tags),
      paymentMode: 'UPI',
      source: 'Paytm',
      sourceReference: ref,
      orderId: String(row[colMap.order] || "").trim(),
      sourceAccount: String(row[colMap.acc] || "").trim(),
      additionalDetails: rawExtra,
      remarks: rawRemarks,
      tags: tags,
      comment: rawComment,
      status: 'valid',
      confidence: 'high',
      needsDescriptionReview: false,
      include: true,
      importFingerprint: `PAYTM-${parsedDate}-${ref}-${signedAmount}`
    });
  }

  return parsedTransactions;
}

/**
 * Robust PhonePe PDF Block Parser (Coordinate-based Line Reconstruction)
 */
export function parsePhonePePdfText(fullText: string): NormalizedImportedTransaction[] {
  // Pre-normalization
  const cleanText = fullText
    .replace(/[\uFFFE\uFFFF\u0000-\u001F]/g, ' ')
    .replace(/(\d{1,2})[\s￾]+(\d{2})\s*([ap]m)/gi, '$1:$2 $3')
    .replace(/\u20B9/g, '₹')
    .replace(/\s+/g, ' ');

  const DATE_PATTERN = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/gi;
  const matches = Array.from(cleanText.matchAll(DATE_PATTERN));
  const transactions: NormalizedImportedTransaction[] = [];

  for (let i = 0; i < matches.length; i++) {
    const startPos = matches[i].index!;
    const endPos = matches[i + 1] ? matches[i + 1].index! : cleanText.length;
    const block = cleanText.substring(startPos, endPos).trim();

    // Type and Amount Regex: (DEBIT|CREDIT) ₹Amount
    const typeMatch = block.match(/\s(DEBIT|CREDIT)\s*₹?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (!typeMatch) continue;

    const typeStr = typeMatch[1].toUpperCase();
    const amount = parseFloat(typeMatch[2].replace(/,/g, ''));

    const rawDate = matches[i][0];
    const parsedDate = parse(rawDate, 'MMM dd, yyyy', new Date());
    const dateStr = isValid(parsedDate) ? format(parsedDate, 'yyyy-MM-dd') : '';

    const timeMatch = block.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i);
    const timeStr = timeMatch ? timeMatch[0].toLowerCase() : "";

    // Extract Description: Meaningful text between time and DEBIT/CREDIT
    let description = "Imported PhonePe Entry";
    const blockForDesc = block.replace(rawDate, '').replace(timeStr, '').trim();
    const typeIndex = blockForDesc.indexOf(typeMatch[1]);
    if (typeIndex > 0) {
      const extracted = blockForDesc.substring(0, typeIndex).trim();
      if (extracted && extracted.length > 2 && !/^(DEBIT|CREDIT|₹|am|pm|\s)*$/i.test(extracted)) {
        description = extracted;
      }
    }

    // Technical IDs
    const txIdMatch = block.match(/Transaction ID\s+([A-Z0-9]+)/i);
    const utrMatch = block.match(/UTR No\.?\s*(\d+)/i);
    const txId = txIdMatch ? txIdMatch[1].trim() : "";
    const utr = utrMatch ? utrMatch[1].trim() : "";

    // Source
    const srcMatch = block.match(/(?:Paid by|Credited to|Paid at)\s+(.*?)(?=\s+Transaction ID|UTR No|Page|This is|$)/i);
    const sourceAccount = srcMatch ? srcMatch[1].trim() : "";

    if (dateStr && !isNaN(amount) && amount > 0) {
      const isTransfer = description.toLowerCase().includes('transfer to') || 
                         description.toLowerCase().includes('add money');

      transactions.push({
        date: dateStr,
        time: timeStr,
        description: description,
        amount: amount,
        incomeExpense: typeStr === 'CREDIT' ? 'Income' : 'Expense',
        category: suggestCategory(description),
        paymentMode: 'UPI',
        source: 'PhonePe',
        sourceReference: utr || txId || `PP-${dateStr}-${amount}`,
        transactionId: txId,
        sourceAccount: sourceAccount === 'UPI Lite' ? 'UPI Lite' : sourceAccount,
        status: 'valid',
        confidence: isTransfer ? 'medium' : 'high',
        needsDescriptionReview: isTransfer,
        include: !isTransfer,
        importFingerprint: `PP-${dateStr}-${timeStr}-${amount}-${description}`,
        reason: isTransfer ? 'Possible self-transfer' : ''
      });
    }
  }

  return transactions;
}

export const DATE_COLUMNS = ['date', 'transaction date', 'txn date', 'value date'];
export const DESC_COLUMNS = ['transaction details', 'description', 'narration', 'merchant', 'paid to'];
export const AMOUNT_COLUMNS = ['amount', 'transaction amount', 'txn amount', 'value'];
export const REF_COLUMNS = ['upi ref no', 'upi ref', 'transaction id', 'utr', 'reference', 'order id'];
export const ACCOUNT_COLUMNS = ['your account', 'account', 'a/c', 'bank', 'source account'];
