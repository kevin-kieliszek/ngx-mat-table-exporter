// Minimal XLSX writer — no third-party dependencies.
// Produces a valid .xlsx (ZIP/STORE + OOXML) from a 2-D array of strings/numbers.

// ---------------------------------------------------------------------------
// CRC-32
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function utf8(s: string): Uint8Array {
  return encoder.encode(s);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Zero-based column index → spreadsheet column letter(s).  0→A, 25→Z, 26→AA … */
export function columnAddress(index: number): string {
  let addr = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    addr = String.fromCharCode(65 + rem) + addr;
    n = Math.floor((n - 1) / 26);
  }
  return addr;
}

// ---------------------------------------------------------------------------
// ZIP builder (STORE — no compression)
// ---------------------------------------------------------------------------

const SIG_LOCAL   = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD    = 0x06054b50;

interface ZipEntry {
  nameBytes: Uint8Array;
  data:      Uint8Array;
  crc:       number;
  offset:    number; // byte offset of the local file header
}

function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const entries: ZipEntry[] = [];
  const localParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const nameBytes = utf8(file.name);
    const crc       = crc32(file.data);
    const size      = file.data.length;

    // Local file header (30 bytes fixed + file name)
    const hdr = new Uint8Array(30 + nameBytes.length);
    const v   = new DataView(hdr.buffer);
    v.setUint32( 0, SIG_LOCAL,       true);
    v.setUint16( 4, 20,              true); // version needed: 2.0
    v.setUint16( 6, 0,               true); // flags
    v.setUint16( 8, 0,               true); // compression: STORE
    v.setUint16(10, 0,               true); // mod time
    v.setUint16(12, 0,               true); // mod date
    v.setUint32(14, crc,             true);
    v.setUint32(18, size,            true); // compressed size
    v.setUint32(22, size,            true); // uncompressed size
    v.setUint16(26, nameBytes.length, true);
    v.setUint16(28, 0,               true); // extra field length
    hdr.set(nameBytes, 30);

    entries.push({ nameBytes, data: file.data, crc, offset: localOffset });
    localOffset += 30 + nameBytes.length + size;
    localParts.push(hdr, file.data);
  }

  // Central directory
  const centralParts: Uint8Array[] = [];
  let centralSize = 0;

  for (const e of entries) {
    const cdh = new Uint8Array(46 + e.nameBytes.length);
    const v   = new DataView(cdh.buffer);
    v.setUint32( 0, SIG_CENTRAL,         true);
    v.setUint16( 4, 20,                  true); // version made by
    v.setUint16( 6, 20,                  true); // version needed
    v.setUint16( 8, 0,                   true); // flags
    v.setUint16(10, 0,                   true); // compression
    v.setUint16(12, 0,                   true); // mod time
    v.setUint16(14, 0,                   true); // mod date
    v.setUint32(16, e.crc,               true);
    v.setUint32(20, e.data.length,       true); // compressed size
    v.setUint32(24, e.data.length,       true); // uncompressed size
    v.setUint16(28, e.nameBytes.length,  true);
    v.setUint16(30, 0,                   true); // extra length
    v.setUint16(32, 0,                   true); // comment length
    v.setUint16(34, 0,                   true); // disk start
    v.setUint16(36, 0,                   true); // internal attr
    v.setUint32(38, 0,                   true); // external attr
    v.setUint32(42, e.offset,            true); // local header offset
    cdh.set(e.nameBytes, 46);
    centralParts.push(cdh);
    centralSize += 46 + e.nameBytes.length;
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev   = new DataView(eocd.buffer);
  ev.setUint32( 0, SIG_EOCD,          true);
  ev.setUint16( 4, 0,                 true); // disk number
  ev.setUint16( 6, 0,                 true); // disk with CD start
  ev.setUint16( 8, entries.length,    true); // entries on this disk
  ev.setUint16(10, entries.length,    true); // total entries
  ev.setUint32(12, centralSize,       true); // size of central dir
  ev.setUint32(16, localOffset,       true); // offset of central dir
  ev.setUint16(20, 0,                 true); // comment length

  const allParts = [...localParts, ...centralParts, eocd];
  const total    = allParts.reduce((s, p) => s + p.length, 0);
  const out      = new Uint8Array(total);
  let pos = 0;
  for (const part of allParts) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// XLSX XML builders
// ---------------------------------------------------------------------------

function buildContentTypes(includeStyles: boolean): string {
  const stylesPart = includeStyles
    ? '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    : '';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
      stylesPart +
    '</Types>'
  );
}

function buildRootRels(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" ' +
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" ' +
        'Target="xl/workbook.xml"/>' +
    '</Relationships>'
  );
}

function buildWorkbook(sheetName: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' +
        `<sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>` +
      '</sheets>' +
    '</workbook>'
  );
}

function buildWorkbookRels(includeStyles: boolean): string {
  const stylesRel = includeStyles
    ? '<Relationship Id="rId3" ' +
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" ' +
        'Target="styles.xml"/>'
    : '';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" ' +
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
        'Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" ' +
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" ' +
        'Target="sharedStrings.xml"/>' +
      stylesRel +
    '</Relationships>'
  );
}

function colWidth(rows: (string | number)[][], colIndex: number): number {
  const MIN_WIDTH = 8;
  const MAX_WIDTH = 60;
  const PADDING   = 2;
  let max = MIN_WIDTH;
  for (const row of rows) {
    const cell = row[colIndex];
    if (cell !== undefined) {
      const len = String(cell).length + PADDING;
      if (len > max) max = len;
    }
  }
  return Math.min(max, MAX_WIDTH);
}

function buildSheet(rows: (string | number)[][], ssMap: Map<string, number>, stripeColor: string | null, boldHeaders: boolean, bottomHeaderBorder: boolean): string {
  // Determine number of columns
  const numCols = rows.reduce((m, r) => Math.max(m, r.length), 0);

  // <cols> section for auto-fit widths
  let colsXml = '<cols>';
  for (let ci = 0; ci < numCols; ci++) {
    const w    = colWidth(rows, ci);
    const idx  = ci + 1;
    colsXml += `<col min="${idx}" max="${idx}" width="${w}" customWidth="1"/>`;
  }
  colsXml += '</cols>';

  let xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    colsXml +
    '<sheetData>';

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    // s="1" → stripe fill, s="2" → header style (bold and/or bottom border)
    const s = ri === 0 && (boldHeaders || bottomHeaderBorder)
      ? ' s="2"'
      : stripeColor !== null && ri > 0 && ri % 2 === 1 ? ' s="1"' : '';
    xml += `<row r="${ri + 1}">`;
    for (let ci = 0; ci < row.length; ci++) {
      const cell  = row[ci];
      const addr  = columnAddress(ci) + (ri + 1);
      if (typeof cell === 'string') {
        xml += `<c r="${addr}" t="s"${s}><v>${ssMap.get(cell)}</v></c>`;
      } else {
        xml += `<c r="${addr}"${s}><v>${cell}</v></c>`;
      }
    }
    xml += '</row>';
  }

  xml += '</sheetData></worksheet>';
  return xml;
}

function buildStyles(stripeColor: string | null, boldHeaders: boolean, bottomHeaderBorder: boolean): string {
  const stripeFill = stripeColor
    ? `<fill><patternFill patternType="solid"><fgColor rgb="FF${stripeColor}"/><bgColor indexed="64"/></patternFill></fill>`
    : '<fill><patternFill patternType="none"/></fill>';

  const headerFontAttrs = boldHeaders ? '<b/>' : '';
  const borderCount     = bottomHeaderBorder ? 2 : 1;
  const borderDefs      = bottomHeaderBorder
    ? '<border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left/><right/><top/><bottom style="thin"/><diagonal/></border>'
    : '<border><left/><right/><top/><bottom/><diagonal/></border>';

  const headerBorderId    = bottomHeaderBorder ? 1 : 0;
  const headerApplyBorder = bottomHeaderBorder ? ' applyBorder="1"' : '';
  const headerApplyFont   = boldHeaders ? ' applyFont="1"' : '';

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2">' +
        '<font><sz val="11"/><name val="Calibri"/></font>' +
        `<font>${headerFontAttrs}<sz val="11"/><name val="Calibri"/></font>` +
      '</fonts>' +
      '<fills count="3">' +
        '<fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill>' +
        stripeFill +
      '</fills>' +
      `<borders count="${borderCount}">${borderDefs}</borders>` +
      '<cellStyleXfs count="1">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>' +
      '</cellStyleXfs>' +
      '<cellXfs count="3">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/>' +
        `<xf numFmtId="0" fontId="1" fillId="0" borderId="${headerBorderId}" xfId="0"${headerApplyFont}${headerApplyBorder}/>` +
      '</cellXfs>' +
      '<cellStyles count="1">' +
        '<cellStyle name="Normal" xfId="0" builtinId="0"/>' +
      '</cellStyles>' +
    '</styleSheet>'
  );
}

function buildSharedStrings(strings: string[]): string {
  const count = strings.length;
  let xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `count="${count}" uniqueCount="${count}">`;
  for (const s of strings) {
    xml += `<si><t>${escapeXml(s)}</t></si>`;
  }
  xml += '</sst>';
  return xml;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Converts a 2-D array of strings/numbers into a valid `.xlsx` Blob.
 * @param rows       Array of rows; first row is typically the header.
 * @param sheetName  Name for the worksheet tab (default "Sheet1").
 * @param stripeRows Pass `true` for a default light-blue alternating row fill,
 *                   or a hex colour string (e.g. `'#C6EFCE'`).
 */
export function createXlsxBlob(
  rows: (string | number)[][],
  sheetName = 'Sheet1',
  stripeColor?: string,
  boldHeaders = false,
  bottomHeaderBorder = false,
): Blob {
  // Strip leading # from caller-supplied colour; null means no stripe
  const resolvedStripe = stripeColor ? stripeColor.replace(/^#/, '') : null;

  // Build shared-strings index (strings only; numbers are stored inline)
  const ssArr: string[] = [];
  const ssMap = new Map<string, number>();

  for (const row of rows) {
    for (const cell of row) {
      if (typeof cell === 'string' && !ssMap.has(cell)) {
        ssMap.set(cell, ssArr.length);
        ssArr.push(cell);
      }
    }
  }

  const needsStyles = resolvedStripe !== null || boldHeaders || bottomHeaderBorder;

  const files: { name: string; data: Uint8Array }[] = [
    { name: '[Content_Types].xml',        data: utf8(buildContentTypes(needsStyles)) },
    { name: '_rels/.rels',                data: utf8(buildRootRels()) },
    { name: 'xl/workbook.xml',            data: utf8(buildWorkbook(sheetName)) },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8(buildWorkbookRels(needsStyles)) },
    { name: 'xl/worksheets/sheet1.xml',   data: utf8(buildSheet(rows, ssMap, resolvedStripe, boldHeaders, bottomHeaderBorder)) },
    { name: 'xl/sharedStrings.xml',       data: utf8(buildSharedStrings(ssArr)) },
  ];

  if (needsStyles) {
    files.push({ name: 'xl/styles.xml', data: utf8(buildStyles(resolvedStripe, boldHeaders, bottomHeaderBorder)) });
  }

  const zipBytes = buildZip(files);
  return new Blob(
    [zipBytes as unknown as BlobPart],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
}
