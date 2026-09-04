const PALETTE = ["var(--data-1)", "var(--data-2)", "var(--data-3)", "var(--data-4)", "var(--data-5)"];
export const colorAt = (i: number) => PALETTE[i % PALETTE.length];
