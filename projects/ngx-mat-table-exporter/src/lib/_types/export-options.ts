import { ExportFormat } from './export-format';

export interface ExportOptions {
  /** Output format. Defaults to 'xlsx'. */
  format?: ExportFormat;
  /** File name without extension. Defaults to 'ExportedData'. */
  fileName?: string;
  /** Worksheet tab name (xlsx only). Defaults to 'Data'. */
  sheetName?: string;
}
