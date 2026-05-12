// RFC 4180 CSV writer — no third-party dependencies.

function escapeCell(cell: string | number): string {
  const s = String(cell);
  return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Converts a 2-D array of strings/numbers into a UTF-8 CSV Blob.
 * Includes a BOM so Excel opens the file with correct encoding.
 * @param rows Array of rows; first row is typically the header.
 */
export function createCsvBlob(rows: (string | number)[][]): Blob {
  const csv = rows.map(row => row.map(escapeCell).join(',')).join('\r\n');
  return new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
}
