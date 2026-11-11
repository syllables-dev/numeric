export interface Glyph {
  className?: string;
  text: string;
}

export interface Slot extends Glyph {
  glyph: HTMLSpanElement;
  slot: HTMLSpanElement;
}

const slotStyle =
  "display:inline-grid;grid-template-columns:minmax(0,1fr);align-items:baseline;justify-items:center";

export const glyphElement = ({ className, text }: Glyph) => {
  const glyph = document.createElement("span");
  glyph.className = className ?? "";
  glyph.style.gridArea = "1 / 1";
  glyph.textContent = text;
  return glyph;
};

export const slotElement = (...glyphs: HTMLSpanElement[]) => {
  const slot = document.createElement("span");
  slot.style.cssText = slotStyle;
  slot.append(...glyphs);
  return slot;
};

export const widthOf = (element: HTMLElement | undefined) =>
  element?.getBoundingClientRect().width ?? 0;
