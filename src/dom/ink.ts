export interface Ink {
  centerX: number;
  centerY: number;
  glyph: HTMLSpanElement;
  height: number;
}

let canvas: CanvasRenderingContext2D | undefined;

const canvasContext = () => {
  canvas ??= document.createElement("canvas").getContext("2d") ?? undefined;

  if (!canvas) {
    throw new Error("numeric text needs a 2d canvas to measure glyphs");
  }

  return canvas;
};

const baselineProbe = (glyph: HTMLSpanElement) => {
  const probe = document.createElement("span");
  probe.style.cssText = "display:inline-block;width:0;height:0";
  glyph.append(probe);
  return probe;
};

export const measureInk = (glyphs: readonly HTMLSpanElement[]): Ink[] => {
  const context = canvasContext();
  const probed = glyphs.map((glyph) => ({
    glyph,
    probe: baselineProbe(glyph),
  }));
  const baselines = probed.map(({ glyph, probe }) => ({
    baseline:
      probe.getBoundingClientRect().top - glyph.getBoundingClientRect().top,
    glyph,
  }));

  for (const { probe } of probed) {
    probe.remove();
  }

  return baselines.map(({ baseline, glyph }) => {
    const { fontFamily, fontSize, fontStyle, fontWeight } =
      getComputedStyle(glyph);
    context.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
    const ink = context.measureText(glyph.textContent);
    return {
      centerX: (ink.actualBoundingBoxRight - ink.actualBoundingBoxLeft) / 2,
      centerY:
        baseline +
        (ink.actualBoundingBoxDescent - ink.actualBoundingBoxAscent) / 2,
      glyph,
      height: ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent,
    };
  });
};
