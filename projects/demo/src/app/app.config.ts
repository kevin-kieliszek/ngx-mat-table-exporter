import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNgxMatTableExporter } from 'ngx-mat-table-exporter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideNgxMatTableExporter({ stripeRows: true, boldHeaders: true, bottomHeaderBorder: true }),
  ],
};
