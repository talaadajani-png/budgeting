// Pastel accent palette from the design reference.
export const ACCENTS = {
  pink: "#F4C6D7",
  blue: "#BCC8F0",
  yellow: "#F2DE9E",
  green: "#C7E3A4",
  lavender: "#D9C7EC",
  peach: "#F5CDB0",
  mint: "#B9E3D2",
};

// Ordered palette used to color donut segments / categories deterministically.
export const CATEGORY_PALETTE = [
  ACCENTS.pink,
  ACCENTS.blue,
  ACCENTS.yellow,
  ACCENTS.green,
  ACCENTS.lavender,
  ACCENTS.peach,
  ACCENTS.mint,
];

export function colorForIndex(i: number): string {
  return CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
}
