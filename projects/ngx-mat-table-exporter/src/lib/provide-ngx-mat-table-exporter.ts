import { InjectionToken, Provider } from '@angular/core';
import { NgxMatTableExporterConfig } from './_types/ngx-mat-table-exporter-config';

export const NGX_MAT_TABLE_EXPORTER_CONFIG =
  new InjectionToken<NgxMatTableExporterConfig>('NgxMatTableExporterConfig');

/**
 * Provides global default configuration for all `ngxMatTableExporter` directives
 * in the current injector scope.
 *
 * @param config.stripeRows - Apply alternating row shading to xlsx exports. Defaults to `false`.
 * @param config.stripeColor - Hex colour for the alternating row fill when `stripeRows` is `true`. Defaults to `'#D9E8FB'`.
 * @param config.boldHeaders - Render the header row in bold in xlsx exports. Defaults to `false`.
 * @param config.bottomHeaderBorder - Apply a bottom border to header cells in xlsx exports. Defaults to `false`.
 *
 * ```ts
 * // app.config.ts
 * providers: [provideNgxMatTableExporter({ stripeRows: true })]
 *
 * // or a custom colour:
 * providers: [provideNgxMatTableExporter({ stripeRows: true, stripeColor: '#C6EFCE' })]
 * ```
 */
export function provideNgxMatTableExporter(config: NgxMatTableExporterConfig): Provider {
  return {
    provide: NGX_MAT_TABLE_EXPORTER_CONFIG,
    useValue: { stripeRows: false, stripeColor: '#D9E8FB', boldHeaders: false, bottomHeaderBorder: false, ...config },
  };
}
