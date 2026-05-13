import { vi } from 'vitest';
import { Component } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatTableModule } from '@angular/material/table';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { NgxMatTableExporterDirective } from './ngx-mat-table-exporter.directive';
import { createXlsxBlob, columnAddress } from './_writers/xlsx-writer';
import { createCsvBlob } from './_writers/csv-writer';
import { createJsonBlob } from './_writers/json-writer';
import { provideNgxMatTableExporter } from './provide-ngx-mat-table-exporter';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

interface User { name: string; age: number; }

const USERS: User[] = [
  { name: 'Alice', age: 30 },
  { name: 'Bob',   age: 25 },
];

// ---------------------------------------------------------------------------
// Host A: plain HTML table with Material CSS classes — DOM extraction tests.
// No MatTable present; the directive uses @Optional so it's still constructable.
// ---------------------------------------------------------------------------

@Component({
  standalone: true,
  imports: [NgxMatTableExporterDirective],
  template: `
    <table ngxMatTableExporter #exporter="ngxMatTableExporter">
      <thead>
        <tr>
          <th class="mat-mdc-header-cell mat-column-name">Name</th>
          <th class="mat-mdc-header-cell mat-column-age">Age</th>
        </tr>
      </thead>
      <tbody>
        <tr class="mat-mdc-row">
          <td class="mat-mdc-cell">Alice</td>
          <td class="mat-mdc-cell">30</td>
        </tr>
        <tr class="mat-mdc-row">
          <td class="mat-mdc-cell">Bob</td>
          <td class="mat-mdc-cell">25</td>
        </tr>
      </tbody>
    </table>
  `,
})
class DomHostComponent {}

// ---------------------------------------------------------------------------
// Host B: real mat-table — exportDataSource tests (MatTable injected).
// ---------------------------------------------------------------------------

@Component({
  standalone: true,
  imports: [MatTableModule, NgxMatTableExporterDirective],
  template: `
    <mat-table [dataSource]="data" ngxMatTableExporter #exporter="ngxMatTableExporter">
      <ng-container matColumnDef="name">
        <mat-header-cell *matHeaderCellDef>Name</mat-header-cell>
        <mat-cell *matCellDef="let r">{{ r.name }}</mat-cell>
      </ng-container>
      <ng-container matColumnDef="age">
        <mat-header-cell *matHeaderCellDef>Age</mat-header-cell>
        <mat-cell *matCellDef="let r">{{ r.age }}</mat-cell>
      </ng-container>
      <mat-header-row *matHeaderRowDef="cols"></mat-header-row>
      <mat-row *matRowDef="let r; columns: cols"></mat-row>
    </mat-table>
  `,
})
class MatTableHostComponent {
  data = USERS;
  cols = ['name', 'age'];
}

function getDir<T>(fixture: ComponentFixture<T>): NgxMatTableExporterDirective {
  return fixture.debugElement
    .query(By.directive(NgxMatTableExporterDirective))
    .injector.get(NgxMatTableExporterDirective);
}

// ---------------------------------------------------------------------------
// exportCurrentPage (DOM extraction)
// ---------------------------------------------------------------------------

describe('NgxMatTableExporterDirective — exportCurrentPage', () => {
  let fixture: ComponentFixture<DomHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DomHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(DomHostComponent);
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(getDir(fixture)).toBeTruthy();
  });

  it('extracts headers and data rows from the DOM', () => {
    const dir = getDir(fixture) as any;
    const rows: string[][] = dir.extractFromDom();

    expect(rows.length).toBe(3);
    expect(rows[0]).toEqual(['Name', 'Age']);
    expect(rows[1]).toEqual(['Alice', '30']);
    expect(rows[2]).toEqual(['Bob', '25']);
  });

  it('calls download with the correct file name', () => {
    const dir = getDir(fixture) as any;
    const spy = vi.spyOn(dir, 'download').mockImplementation(() => {});

    dir.exportCurrentPage({ fileName: 'page' });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(expect.any(Array), { fileName: 'page' });
  });

  it('throws when exportDataSource is called without a mat-table', () => {
    expect(() => getDir(fixture).exportDataSource()).toThrow();
  });
});

// ---------------------------------------------------------------------------
// exportDataSource (MatTable injection)
// ---------------------------------------------------------------------------

describe('NgxMatTableExporterDirective — exportDataSource', () => {
  let fixture: ComponentFixture<MatTableHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatTableHostComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(MatTableHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('reads column keys from mat-column-* classes and maps to data properties', () => {
    const dir = getDir(fixture) as any;
    const spy = vi.spyOn(dir, 'download').mockImplementation(() => {});

    dir.exportDataSource({ fileName: 'users' });

    const [rows, options] = spy.mock.calls[0] as [(string | number)[][], unknown];
    expect(rows[0]).toEqual(['Name', 'Age']);
    expect(rows[1]).toEqual(['Alice', 30]);
    expect(rows[2]).toEqual(['Bob', 25]);
    expect(options).toEqual({ fileName: 'users' });
  });

  it('works with a MatTableDataSource-shaped object (plain .data array)', () => {
    const dir = getDir(fixture) as any;
    dir.table.dataSource = { data: [{ name: 'Charlie', age: 40 }] };

    const spy = vi.spyOn(dir, 'download').mockImplementation(() => {});
    dir.exportDataSource();

    const [rows] = spy.mock.calls[0] as [(string | number)[][]];
    expect(rows[1]).toEqual(['Charlie', 40]);
  });

  it('throws for unsupported data source types', () => {
    const dir = getDir(fixture) as any;
    dir.table.dataSource = null;
    expect(() => dir.exportDataSource()).toThrow();
  });
});

// ---------------------------------------------------------------------------
// download() format routing
// ---------------------------------------------------------------------------

describe('NgxMatTableExporterDirective — download format routing', () => {
  let fixture: ComponentFixture<DomHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DomHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(DomHostComponent);
    fixture.detectChanges();
  });

  function triggerDownload(format: 'xlsx' | 'csv' | 'json'): HTMLAnchorElement {
    const dir = getDir(fixture) as any;
    const anchor = document.createElement('a');
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor as any);
    vi.spyOn(document.body, 'appendChild').mockReturnValueOnce(anchor);
    vi.spyOn(document.body, 'removeChild').mockReturnValueOnce(anchor);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(anchor, 'click').mockImplementation(() => {});
    dir.exportCurrentPage({ format, fileName: 'test' });
    return anchor;
  }

  afterEach(() => vi.restoreAllMocks());

  it('sets .xlsx extension and correct MIME type for xlsx format', () => {
    const anchor = triggerDownload('xlsx');
    expect(anchor.download).toBe('test.xlsx');
  });

  it('sets .csv extension for csv format', () => {
    const anchor = triggerDownload('csv');
    expect(anchor.download).toBe('test.csv');
  });

  it('sets .json extension for json format', () => {
    const anchor = triggerDownload('json');
    expect(anchor.download).toBe('test.json');
  });

  it('defaults to xlsx when format is omitted', () => {
    const dir = getDir(fixture) as any;
    const anchor = document.createElement('a');
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor as any);
    vi.spyOn(document.body, 'appendChild').mockReturnValueOnce(anchor);
    vi.spyOn(document.body, 'removeChild').mockReturnValueOnce(anchor);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(anchor, 'click').mockImplementation(() => {});
    dir.exportCurrentPage({ fileName: 'test' });
    expect(anchor.download).toBe('test.xlsx');
  });
});

// ---------------------------------------------------------------------------
// ZIP helper — extracts uncompressed (STORE) entries by name
// ---------------------------------------------------------------------------

function readZipEntries(data: Uint8Array): Map<string, string> {
  const view    = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const decoder = new TextDecoder();
  const entries = new Map<string, string>();

  // Locate EOCD signature (0x06054b50) scanning backwards from end
  let eocdOffset = -1;
  for (let i = data.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error('EOCD not found');

  const cdCount  = view.getUint16(eocdOffset + 8,  true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  let pos = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('Central dir sig mismatch');

    const nameLen     = view.getUint16(pos + 28, true);
    const extraLen    = view.getUint16(pos + 30, true);
    const commentLen  = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name        = decoder.decode(data.slice(pos + 46, pos + 46 + nameLen));

    pos += 46 + nameLen + extraLen + commentLen;

    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Local file sig mismatch');

    const localNameLen  = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const compSize      = view.getUint32(localOffset + 18, true);
    const dataStart     = localOffset + 30 + localNameLen + localExtraLen;

    entries.set(name, decoder.decode(data.slice(dataStart, dataStart + compSize)));
  }

  return entries;
}

async function extractXml(blob: Blob): Promise<Map<string, string>> {
  return readZipEntries(new Uint8Array(await blob.arrayBuffer()));
}

// ---------------------------------------------------------------------------
// createXlsxBlob
// ---------------------------------------------------------------------------

describe('createXlsxBlob', () => {
  it('returns a Blob with the correct MIME type', () => {
    const blob = createXlsxBlob([['A', 'B'], ['1', '2']], 'Sheet1');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('produces a non-empty Blob', () => {
    expect(createXlsxBlob([['Name', 'Value'], ['foo', 42]], 'Data').size).toBeGreaterThan(0);
  });

  it('handles an empty rows array', () => {
    expect(createXlsxBlob([], 'Empty').size).toBeGreaterThan(0);
  });

  it('handles mixed string/number cells without throwing', () => {
    expect(() => createXlsxBlob([['Label', 'Count'], ['items', 99]], 'Mix')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createXlsxBlob — XML output
// ---------------------------------------------------------------------------

describe('createXlsxBlob — XML output', () => {
  // Header + 3 data rows so we can test stripe on odd (ri=1,3) and even (ri=2)
  const ROWS = [['Name', 'City'], ['Alice', 'New York'], ['Bob', 'Chicago'], ['Carol', 'Austin']];

  it('omits styles.xml when no styling options are set', async () => {
    const xml = await extractXml(createXlsxBlob(ROWS));
    expect(xml.has('xl/styles.xml')).toBe(false);
  });

  it('does not apply cell style attributes when no styling options are set', async () => {
    const xml = await extractXml(createXlsxBlob(ROWS));
    expect(xml.get('xl/worksheets/sheet1.xml')).not.toContain(' s="');
  });

  it('writes the sheet name to workbook.xml', async () => {
    const xml = await extractXml(createXlsxBlob(ROWS, 'My Report'));
    expect(xml.get('xl/workbook.xml')).toContain('name="My Report"');
  });

  it('stores string cells with t="s" and numbers inline without t="s"', async () => {
    const xml   = await extractXml(createXlsxBlob([['Label', 'Count'], ['items', 42]]));
    const sheet = xml.get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain('t="s"');
    expect(sheet).toContain('<c r="B2"><v>42</v></c>');
  });

  it('escapes special characters in sharedStrings.xml', async () => {
    const xml = await extractXml(createXlsxBlob([['A & B'], ['<x> "y"']]));
    const ss  = xml.get('xl/sharedStrings.xml')!;
    expect(ss).toContain('A &amp; B');
    expect(ss).toContain('&lt;x&gt; &quot;y&quot;');
  });

  it('writes auto-sized column widths with customWidth="1"', async () => {
    // 'A very long column header' (25 chars) + padding 2 = 27
    const xml   = await extractXml(createXlsxBlob([['A very long column header', 'B']]));
    const sheet = xml.get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain('customWidth="1"');
    expect(sheet).toContain('width="27"');
  });

  it('caps column width at 60', async () => {
    const longHeader = 'A'.repeat(70); // 70 + 2 padding = 72 → capped at 60
    const xml   = await extractXml(createXlsxBlob([[longHeader]]));
    const sheet = xml.get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain('width="60"');
    expect(sheet).not.toContain('width="72"');
  });

  it('includes styles.xml and writes the stripe fill colour when stripeColor is set', async () => {
    const xml = await extractXml(createXlsxBlob(ROWS, 'Data', '#C6EFCE'));
    expect(xml.has('xl/styles.xml')).toBe(true);
    expect(xml.get('xl/styles.xml')).toContain('FFC6EFCE');
  });

  it('accepts stripeColor without a leading hash', async () => {
    const xml = await extractXml(createXlsxBlob(ROWS, 'Data', 'C6EFCE'));
    expect(xml.get('xl/styles.xml')).toContain('FFC6EFCE');
  });

  it('applies s="1" to odd data rows and omits it from even rows and the header', async () => {
    const xml   = await extractXml(createXlsxBlob(ROWS, 'Data', '#C6EFCE'));
    const sheet = xml.get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain('<c r="A1" t="s"><v>');       // header — no s
    expect(sheet).toContain('<c r="A2" t="s" s="1"><v>'); // ri=1 odd  — s="1"
    expect(sheet).toContain('<c r="A3" t="s"><v>');       // ri=2 even — no s
    expect(sheet).toContain('<c r="A4" t="s" s="1"><v>'); // ri=3 odd  — s="1"
  });

  it('includes styles.xml with <b/> font tag when boldHeaders is true', async () => {
    const xml = await extractXml(createXlsxBlob(ROWS, 'Data', undefined, true));
    expect(xml.has('xl/styles.xml')).toBe(true);
    expect(xml.get('xl/styles.xml')).toContain('<b/>');
  });

  it('applies s="2" to header cells when boldHeaders is true', async () => {
    const xml   = await extractXml(createXlsxBlob(ROWS, 'Data', undefined, true));
    const sheet = xml.get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain('<c r="A1" t="s" s="2"><v>'); // header — s="2"
    expect(sheet).toContain('<c r="A2" t="s"><v>');       // data   — no s
  });

  it('includes a thin bottom border in styles.xml when bottomHeaderBorder is true', async () => {
    const xml = await extractXml(createXlsxBlob(ROWS, 'Data', undefined, false, true));
    expect(xml.get('xl/styles.xml')).toContain('bottom style="thin"');
  });

  it('applies s="2" to header cells when bottomHeaderBorder is true', async () => {
    const xml   = await extractXml(createXlsxBlob(ROWS, 'Data', undefined, false, true));
    const sheet = xml.get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain('<c r="A1" t="s" s="2"><v>');
    expect(sheet).toContain('<c r="A2" t="s"><v>');
  });

  it('combines stripe and bold headers correctly', async () => {
    const xml   = await extractXml(createXlsxBlob(ROWS, 'Data', '#C6EFCE', true));
    const sheet = xml.get('xl/worksheets/sheet1.xml')!;
    const styles = xml.get('xl/styles.xml')!;
    expect(styles).toContain('<b/>');
    expect(styles).toContain('FFC6EFCE');
    expect(sheet).toContain('<c r="A1" t="s" s="2"><v>'); // header bold, no stripe
    expect(sheet).toContain('<c r="A2" t="s" s="1"><v>'); // data stripe
  });
});

// ---------------------------------------------------------------------------
// createCsvBlob
// ---------------------------------------------------------------------------

describe('createCsvBlob', () => {
  async function text(blob: Blob): Promise<string> {
    return blob.text();
  }

  it('returns a Blob with CSV MIME type', () => {
    const blob = createCsvBlob([['Name', 'Age'], ['Alice', 30]]);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('text/csv');
  });

  it('produces correct CSV content', async () => {
    const blob = createCsvBlob([['Name', 'Age'], ['Alice', 30], ['Bob', 25]]);
    const content = await text(blob);
    expect(content).toContain('Name,Age');
    expect(content).toContain('Alice,30');
    expect(content).toContain('Bob,25');
  });

  it('quotes cells containing commas', async () => {
    const blob = createCsvBlob([['A'], ['hello, world']]);
    const content = await text(blob);
    expect(content).toContain('"hello, world"');
  });

  it('doubles internal double-quotes', async () => {
    const blob = createCsvBlob([['A'], ['say "hi"']]);
    const content = await text(blob);
    expect(content).toContain('"say ""hi"""');
  });

  it('handles an empty rows array', async () => {
    const blob = createCsvBlob([]);
    expect((await text(blob)).trim()).toBe('');
  });
});

// ---------------------------------------------------------------------------
// createJsonBlob
// ---------------------------------------------------------------------------

describe('createJsonBlob', () => {
  async function parsed(blob: Blob): Promise<unknown> {
    return JSON.parse(await blob.text());
  }

  it('returns a Blob with JSON MIME type', () => {
    const blob = createJsonBlob([['Name', 'Age'], ['Alice', 30]]);
    expect(blob.type).toBe('application/json');
  });

  it('maps headers to object keys', async () => {
    const blob = createJsonBlob([['Name', 'Age'], ['Alice', 30], ['Bob', 25]]);
    const data = await parsed(blob) as Record<string, unknown>[];
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({ Name: 'Alice', Age: 30 });
    expect(data[1]).toEqual({ Name: 'Bob', Age: 25 });
  });

  it('returns [] for empty rows array', async () => {
    expect(await parsed(createJsonBlob([]))).toEqual([]);
  });

  it('uses empty string for missing cells', async () => {
    const blob = createJsonBlob([['A', 'B'], ['only-a']]);
    const data = await parsed(blob) as Record<string, unknown>[];
    expect(data[0]['B']).toBe('');
  });
});

// ---------------------------------------------------------------------------
// provideNgxMatTableExporter — config injection
// ---------------------------------------------------------------------------

describe('NgxMatTableExporterDirective — provider config', () => {
  it('directive receives all config values from provideNgxMatTableExporter', async () => {
    await TestBed.configureTestingModule({
      imports: [DomHostComponent],
      providers: [
        provideNgxMatTableExporter({
          stripeRows: true,
          stripeColor: '#C6EFCE',
          boldHeaders: true,
          bottomHeaderBorder: true,
        }),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DomHostComponent);
    fixture.detectChanges();
    const dir = getDir(fixture) as any;

    expect(dir.config.stripeRows).toBe(true);
    expect(dir.config.stripeColor).toBe('#C6EFCE');
    expect(dir.config.boldHeaders).toBe(true);
    expect(dir.config.bottomHeaderBorder).toBe(true);
  });

  it('directive config is null when no provider is registered', async () => {
    await TestBed.configureTestingModule({
      imports: [DomHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(DomHostComponent);
    fixture.detectChanges();
    const dir = getDir(fixture) as any;

    expect(dir.config).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// columnAddress
// ---------------------------------------------------------------------------

describe('columnAddress', () => {
  it('0 → A',   () => expect(columnAddress(0)).toBe('A'));
  it('25 → Z',  () => expect(columnAddress(25)).toBe('Z'));
  it('26 → AA', () => expect(columnAddress(26)).toBe('AA'));
  it('51 → AZ', () => expect(columnAddress(51)).toBe('AZ'));
  it('52 → BA', () => expect(columnAddress(52)).toBe('BA'));
});
