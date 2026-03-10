function luminance(hex: string): number {
  const h = hex.replace(/^#/, "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return (
    0.2126 * (r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)) +
    0.7152 * (g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)) +
    0.0722 * (b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4))
  );
}

/** Returns black or white hex for high contrast on the given background hex. */
export function contrastColor(hex: string): "#000000" | "#ffffff" {
  return luminance(hex) > 0.179 ? "#000000" : "#ffffff";
}

/** True if hex is lighter than threshold (e.g. use dark logo when background is lighter than #BBBBBB). */
export function isLighterThan(hex: string, thresholdHex: string): boolean {
  return luminance(toCssHex(hex)) > luminance(toCssHex(thresholdHex));
}

export function toCssHex(hex: string): string {
  return hex.startsWith("#") ? hex : `#${hex}`;
}
