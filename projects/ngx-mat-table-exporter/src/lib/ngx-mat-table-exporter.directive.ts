import { Directive, ElementRef, inject } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { createXlsxBlob } from './_writers/xlsx-writer';
import { createCsvBlob } from './_writers/csv-writer';
import { createJsonBlob } from './_writers/json-writer';
import { ExportFormat } from './_types/export-format';
import { ExportOptions } from './_types/export-options';

export type { ExportFormat };
export type { ExportOptions };

/**
 * Directive that adds export capability to a `mat-table`.
 *
 * Two export methods are available:
 * - `exportCurrentPage(options?)` — exports the currently rendered rows (DOM scrape)
 * - `exportDataSource(options?)` — exports all rows from the table's data source
 *
 * Usage:
 * ```html
 * <mat-table ngxMatTableExporter #exporter="ngxMatTableExporter">…</mat-table>
 * <button (click)="exporter.exportCurrentPage()">Export page</button>
 * <button (click)="exporter.exportDataSource()">Export all</button>
 * ```
 */
@Directive({
  selector: '[ngxMatTableExporter]',
  exportAs: 'ngxMatTableExporter',
  standalone: true,
})
export class NgxMatTableExporterDirective<T = unknown> {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly table = inject<MatTable<T> | null>(MatTable, { optional: true });

  /**
   * Exports the rows currently rendered in the DOM.
   * Only includes what is visible on the current page.
   */
  exportCurrentPage(options?: ExportOptions): void {
    this.download(this.extractFromDom(), options);
  }

  /**
   * Exports every row from the table's data source regardless of pagination.
   *
   * Column headers and order are read from the rendered header row.
   * Cell values are mapped using the `mat-column-{name}` CSS class Angular
   * Material adds to each cell — the column name is used as the property key
   * on each data row.
   *
   * Supports plain arrays and `MatTableDataSource` (anything with a `.data` array).
   */
  exportDataSource(options?: ExportOptions): void {
    if (!this.table) {
      throw new Error(
        'NgxMatTableExporter: exportDataSource requires the directive to be placed on a mat-table.',
      );
    }

    const root = this.el.nativeElement;

    // Read header text and column key from each rendered header cell.
    // Angular Material adds a `mat-column-{name}` class to every header cell.
    const headerCells = Array.from(
      root.querySelectorAll<HTMLElement>('.mat-mdc-header-cell, .mat-header-cell'),
    );
    const columns = headerCells.map(el => ({
      header: (el.innerText ?? el.textContent ?? '').trim(),
      key:    Array.from(el.classList).find(c => c.startsWith('mat-column-'))?.slice('mat-column-'.length) ?? '',
    }));

    const data = this.resolveData(this.table.dataSource);
    const rows: (string | number)[][] = [
      columns.map(c => c.header),
      ...data.map(row => columns.map(c => {
        const val = (row as Record<string, unknown>)[c.key];
        return val !== null && val !== undefined ? val as string | number : '';
      })),
    ];

    this.download(rows, options);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private resolveData(ds: unknown): T[] {
    if (Array.isArray(ds)) {
      return ds as T[];
    }

    if (ds !== null && typeof ds === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- duck-typing against MatTableDataSource internals to avoid a direct import
      const mds = ds as any;

      if (Array.isArray(mds['data'])) {
        // Start from the full raw data array (same as MatTableDataSource.data)
        let data: T[] = (mds['data'] as T[]).slice();

        // Apply the active filter using MatTableDataSource's own filterPredicate
        const filter = mds['filter'];
        if (filter && typeof mds['filterPredicate'] === 'function') {
          data = data.filter((row: T) => mds['filterPredicate'](row, filter));
        }

        // Apply the active sort using MatTableDataSource's own sortData function
        const sort = mds['sort'];
        if (sort?.active && sort?.direction && typeof mds['sortData'] === 'function') {
          data = mds['sortData'](data, sort);
        }

        return data;
      }
    }

    throw new Error(
      'NgxMatTableExporter: exportDataSource requires an array or MatTableDataSource. ' +
      'For Observable data sources use exportCurrentPage() instead.',
    );
  }

  private extractFromDom(): (string | number)[][] {
    const root = this.el.nativeElement;
    const rows: (string | number)[][] = [];

    const headerCells = root.querySelectorAll<HTMLElement>(
      '.mat-mdc-header-cell, .mat-header-cell',
    );
    if (headerCells.length > 0) {
      rows.push(Array.from(headerCells).map(el => (el.innerText ?? el.textContent ?? '').trim()));
    }

    const dataRows = root.querySelectorAll<HTMLElement>('.mat-mdc-row, .mat-row');
    for (const tr of Array.from(dataRows)) {
      const cells = tr.querySelectorAll<HTMLElement>('.mat-mdc-cell, .mat-cell');
      rows.push(Array.from(cells).map(el => (el.innerText ?? el.textContent ?? '').trim()));
    }

    return rows;
  }

  private download(rows: (string | number)[][], options?: ExportOptions): void {
    const fileName = options?.fileName ?? 'ExportedData';
    const format   = options?.format   ?? 'xlsx';

    let blob: Blob;
    let ext: string;

    switch (format) {
      case 'csv':
        blob = createCsvBlob(rows);
        ext  = 'csv';
        break;
      case 'json':
        blob = createJsonBlob(rows);
        ext  = 'json';
        break;
      default:
        blob = createXlsxBlob(rows, options?.sheetName ?? 'Data');
        ext  = 'xlsx';
    }

    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `${fileName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
