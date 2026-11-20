// Sample-mode response time per AI step, in ms. Live calls measured on this data are listed in the
// README; these sit in the 4–8 s range so the staged progress reads like a real interaction.
export const SAMPLE_DELAY_MS = { explain: 6400, match: 4800, runChecks: 4200 } as const;
/** Sample delay with ±0.6 s of jitter. */
export const jitter = (ms: number) => ms + Math.round((Math.random() - 0.5) * 1200);
