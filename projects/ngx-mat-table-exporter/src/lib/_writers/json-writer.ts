/**
 * Converts a 2-D array of strings/numbers into a JSON Blob.
 * The first row is used as property keys; remaining rows become objects.
 * @param rows Array of rows; first row must be the header.
 */
export function createJsonBlob(rows: (string | number)[][]): Blob {
  if (rows.length === 0) {
    return new Blob(['[]'], { type: 'application/json' });
  }
  const [headers, ...dataRows] = rows;
  const objects = dataRows.map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])),
  );
  return new Blob([JSON.stringify(objects, null, 2)], { type: 'application/json' });
}
