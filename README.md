# ngx-mat-table-exporter

**[Live Demo](https://kevin-kieliszek.github.io/ngx-mat-table-exporter/)**

Export Angular Material tables to **Excel (.xlsx)**, **CSV**, or **JSON** with a single method call — no third-party libraries required.

- Supports **Angular 19 and above**
- Zero dependencies beyond `@angular/material`
- Three output formats: **xlsx**, **csv**, and **json**
- Respects active **filter**, **sort**, and **pagination**
- **Auto-sizes column widths** in xlsx exports
- Two export modes: current page or full data set
- Written entirely in TypeScript — no `xlsx`, `exceljs`, `file-saver`, or `jszip`

---

## Requirements

| Package | Version |
|---|---|
| `@angular/core` | `>=19.0.0` |
| `@angular/material` | `>=19.0.0` |

---

## Installation

```bash
npm install ngx-mat-table-exporter
```

---

## Quick Start

### 1. Import the directive

**Standalone component:**

```typescript
import { NgxMatTableExporterDirective } from 'ngx-mat-table-exporter';

@Component({
  standalone: true,
  imports: [MatTableModule, NgxMatTableExporterDirective],
  ...
})
export class MyComponent {}
```

**NgModule-based component:**

```typescript
import { NgxMatTableExporterDirective } from 'ngx-mat-table-exporter';
import { NgModule } from '@angular/core';

@NgModule({
  imports: [
    MatTableModule,
    NgxMatTableExporterDirective, // standalone directives can be imported directly into NgModules
  ],
  declarations: [MyComponent],
})
export class MyModule {}
```

### 2. Add the directive to your template

```html
<mat-table [dataSource]="dataSource" ngxMatTableExporter #exporter="ngxMatTableExporter">
  <!-- your columns -->
</mat-table>

<button (click)="exporter.exportCurrentPage()">Export Current Page</button>
<button (click)="exporter.exportDataSource()">Export All Rows</button>
```

That's it. No additional setup or configuration required for basic usage.

### 3. (Optional) Set global xlsx defaults

Only needed if you want to change the default xlsx styling. Without it, all styling is off and the directive works with no configuration required. Use `provideNgxMatTableExporter` to set defaults for every `ngxMatTableExporter` directive in the application.

**Standalone (app.config.ts):**

```typescript
import { provideNgxMatTableExporter } from 'ngx-mat-table-exporter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgxMatTableExporter({
      stripeRows: true,
      stripeColor: '#C6EFCE',
      boldHeaders: true,
      bottomHeaderBorder: true,
    }),
  ],
};
```

**NgModule (app.module.ts):**

```typescript
import { provideNgxMatTableExporter } from 'ngx-mat-table-exporter';

@NgModule({
  providers: [
    provideNgxMatTableExporter({
      stripeRows: true,
      stripeColor: '#C6EFCE',
      boldHeaders: true,
      bottomHeaderBorder: true,
    }),
  ],
})
export class AppModule {}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `stripeRows` | `boolean` | `false` | Apply alternating row shading to xlsx exports |
| `stripeColor` | `string` | `'#D9E8FB'` | Hex colour for the alternating row fill. Only used when `stripeRows` is `true` |
| `boldHeaders` | `boolean` | `false` | Render the header row in bold |
| `bottomHeaderBorder` | `boolean` | `false` | Apply a bottom border to header cells |

---

## Export Methods

The directive exposes two methods, each suited to a different use case.

### `exportCurrentPage(options?)`

Exports only the rows **currently rendered in the DOM** — exactly what the user sees on screen.

```typescript
exporter.exportCurrentPage();
exporter.exportCurrentPage({ fileName: 'january-report', sheetName: 'Data' });
```

**How it works:** Reads header text and cell values directly from the rendered HTML using Angular Material's CSS classes (`mat-mdc-header-cell`, `mat-mdc-row`, etc.). Because it reads from the DOM, it naturally captures whatever is currently displayed — the active page, the active filter, and the active sort order.

**Best for:** Exporting a single page of results, or when you want the export to match exactly what the user is looking at.

---

### `exportDataSource(options?)`

Exports **all rows** from the table's data source, regardless of which page is currently shown.

```typescript
exporter.exportDataSource();
exporter.exportDataSource({ fileName: 'all-users', sheetName: 'Users' });
```

**How it works:** Reads data directly from the `MatTableDataSource` bound to the table and applies the same filter predicate and sort function that Angular Material uses internally — but skips pagination. The result is every matching row, in the same order the user sees them, across all pages.

**Best for:** Full exports where the user has filtered down to a subset, or sorted the data, and wants the complete matching result set — not just the current page.

---

### Key differences at a glance

| | `exportCurrentPage` | `exportDataSource` |
|---|---|---|
| Rows exported | Current page only | All pages |
| Respects filter | Yes (DOM reflects it) | Yes (applies `filterPredicate`) |
| Respects sort | Yes (DOM reflects it) | Yes (applies `sortData`) |
| Data source required | No — works on any table | Yes — requires `MatTableDataSource` or array |
| Works without `mat-table` | Yes | No |

> **Server-side pagination:** When pagination is handled server-side, the data source only ever holds the current page — the rest of the data lives on the server. In this case both methods behave identically and export only the current page. Fetching additional pages is the responsibility of your application.

---

## Export Formats

Pass a `format` option to control the output file type. The default is `'xlsx'` so existing code requires no changes.

```html
<!-- Excel — auto-sized columns, works in Excel / LibreOffice / Google Sheets -->
<button (click)="exporter.exportDataSource({ format: 'xlsx', fileName: 'report' })">Excel</button>

<!-- CSV — UTF-8 with BOM so Excel opens it with correct encoding -->
<button (click)="exporter.exportDataSource({ format: 'csv', fileName: 'report' })">CSV</button>

<!-- JSON — array of objects, column headers used as property keys -->
<button (click)="exporter.exportDataSource({ format: 'json', fileName: 'report' })">JSON</button>
```

### JSON output shape

```json
[
  { "Name": "Alice Johnson", "Email": "alice@example.com", "Age": 28, "City": "New York" },
  { "Name": "Bob Smith",     "Email": "bob@example.com",   "Age": 34, "City": "Chicago"  }
]
```

---

## Filter & Sort Integration

`ngx-mat-table-exporter` is designed to work seamlessly with Angular Material's `MatTableDataSource`, `MatSort`, and `MatPaginator`.

```typescript
@Component({ ... })
export class MyComponent implements AfterViewInit {
  dataSource = new MatTableDataSource<User>(USERS);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  applyFilter(event: Event) {
    this.dataSource.filter = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.paginator?.firstPage();
  }
}
```

```html
<mat-form-field>
  <mat-label>Filter</mat-label>
  <input matInput (input)="applyFilter($event)">
</mat-form-field>

<mat-table [dataSource]="dataSource" matSort ngxMatTableExporter #exporter="ngxMatTableExporter">
  <ng-container matColumnDef="name">
    <mat-header-cell *matHeaderCellDef mat-sort-header>Name</mat-header-cell>
    <mat-cell *matCellDef="let row">{{ row.name }}</mat-cell>
  </ng-container>

  <!-- more columns... -->

  <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
  <mat-row *matRowDef="let row; columns: displayedColumns"></mat-row>
</mat-table>

<mat-paginator [pageSizeOptions]="[10, 25, 50]"></mat-paginator>

<button (click)="exporter.exportCurrentPage()">Export This Page</button>
<button (click)="exporter.exportDataSource({ fileName: 'filtered-results' })">Export All Matching</button>
```

When the user filters to 15 results across 2 pages and sorts by name, clicking **Export All Matching** will produce an Excel file with all 15 rows in sorted order — not just the 10 on the current page.

---

## Auto-Sizing Column Widths

Exported `.xlsx` files automatically size each column to fit its content. No more manually dragging column borders in Excel or LibreOffice.

The width of each column is calculated by scanning every cell value (including the header) and finding the longest string. A small padding is added, and widths are capped between a minimum of **8 characters** and a maximum of **60 characters** to prevent excessively wide columns for long URLs or descriptions.

This is written directly into the `<cols>` section of the worksheet XML, so it works in Excel, LibreOffice Calc, Google Sheets, and any other OOXML-compatible spreadsheet application.

---

## ExportOptions

Both methods accept an optional `ExportOptions` object:

```typescript
interface ExportOptions {
  format?:    'xlsx' | 'csv' | 'json'; // Output format. Default: 'xlsx'
  fileName?:  string;                  // File name without extension. Default: 'ExportedData'
  sheetName?: string;                  // Worksheet tab name (xlsx only). Default: 'Data'
}
```

```typescript
exporter.exportDataSource({ format: 'csv',  fileName: 'q1-report' });
exporter.exportDataSource({ format: 'xlsx', fileName: 'q1-report', sheetName: 'January' });
```

---

## Tables Without Sort or Filter

The directive handles all configurations gracefully:

- **No sort connected** — data is exported in its natural order
- **No filter active** — all rows are included
- **No `MatTableDataSource`** (plain array) — `exportDataSource` uses the array directly
- **Plain HTML table** (no `mat-table`) — `exportCurrentPage` still works via DOM scraping; `exportDataSource` is not available

---

## How It Works Internally

`ngx-mat-table-exporter` implements all three writers from scratch — no third-party libraries are bundled.

**Excel (.xlsx):** A valid Office Open XML document built as a ZIP archive (STORE compression, pure TypeScript CRC-32). Contains six XML files: `[Content_Types].xml`, `.rels`, `workbook.xml`, `workbook.xml.rels`, `sheet1.xml`, and `sharedStrings.xml`. String cells use a shared strings table; numbers are stored inline. Column widths are written to the `<cols>` element for auto-fit behavior.

**CSV:** RFC 4180 compliant. Cells containing commas, double-quotes, or newlines are quoted; internal double-quotes are escaped by doubling. The file includes a UTF-8 BOM so Excel opens it with correct encoding without a manual import wizard.

**JSON:** Each data row is mapped to a plain object using the column headers as property keys — `[{ "Name": "Alice", "Age": 30 }, ...]`. The output is pretty-printed with two-space indentation.

All formats are downloaded directly in the browser via a temporary object URL — no server required.

---

## Column Detection

When using `exportDataSource`, column headers and property keys are detected automatically from the rendered table. Angular Material adds a `mat-column-{name}` CSS class to every header cell, which the directive uses to map each column to its corresponding data property. This means:

- Column headers come from what is rendered in the header row — exactly what the user sees
- Data values are read from `row[columnName]` using the column definition name
- Display-only columns (e.g., action buttons with no data property) will export as empty — simply exclude them from `displayedColumns` before exporting if needed

---

## License

MIT

---

## Development

This repo contains both the library (`projects/ngx-mat-table-exporter`) and an interactive demo (`projects/demo`).

### Build the library

```bash
npx ng build ngx-mat-table-exporter
```

### Run the demo

```bash
npx ng serve demo
```

Open `http://localhost:4200` to see the demo.

### Run tests

```bash
npm test
```
