export interface NgxMatTableExporterConfig {
  /** Apply alternating row shading to xlsx exports. */
  stripeRows?: boolean;
  /**
   * Hex colour used for the alternating row fill when `stripeRows` is `true`.
   * Accepts `'#RRGGBB'` or `'RRGGBB'`. Defaults to `'#D9E8FB'` (light blue).
   */
  stripeColor?: string;
  /** Render the header row in bold in xlsx exports. Defaults to `false`. */
  boldHeaders?: boolean;
  /** Apply a bottom border to header cells in xlsx exports. Defaults to `false`. */
  bottomHeaderBorder?: boolean;
}
