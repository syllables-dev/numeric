import { measureInk } from "@/dom/ink";
import type { Ink } from "@/dom/ink";
import { springTiming } from "@/transition/spring";
import type { Spring } from "@/transition/spring";
import {
  fadeSpring,
  layoutSpring,
  numericText,
  offsetSpring,
} from "@/transition/swiftui";

export interface Change {
  entering?: HTMLSpanElement;
  from: number;
  leaving?: HTMLSpanElement;
  slot: HTMLSpanElement;
  to: number;
}

interface Step extends Ink {
  delay: number;
}

const sequenceSeconds = Math.max(fadeSpring.duration, offsetSpring.duration);

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const sequence = (glyphs: HTMLSpanElement[], rtl: boolean): Step[] => {
  const spacing =
    glyphs.length < 2
      ? 0
      : Math.min(
          numericText.sequenceBegin,
          (sequenceSeconds * (1 / numericText.sequenceLength - 1)) /
            (glyphs.length - 1)
        );
  const ordered = glyphs
    .map((glyph) => ({ glyph, left: glyph.getBoundingClientRect().left }))
    .toSorted((a, b) => (rtl ? b.left - a.left : a.left - b.left))
    .map(({ glyph }) => glyph);
  return measureInk(ordered).map((ink, index) => ({
    ...ink,
    delay: sequenceSeconds * index * spacing * 1000,
  }));
};

export const animateChanges = (
  changes: readonly Change[],
  { countsDown, rtl }: { countsDown: boolean; rtl: boolean }
) => {
  const motion = !reducedMotion();
  const travel = countsDown ? -numericText.offset : numericText.offset;
  const entering = sequence(
    changes.flatMap(({ entering: glyph }) => (glyph ? [glyph] : [])),
    rtl
  );
  const leaving = sequence(
    changes.flatMap(({ leaving: glyph }) => (glyph ? [glyph] : [])),
    rtl
  );

  const animate = (
    element: HTMLElement,
    keyframes: Keyframe[],
    spring: Spring,
    delay = 0
  ) =>
    element.animate(keyframes, {
      delay,
      fill: "both",
      ...(motion ? springTiming(spring) : { duration: 150, easing: "linear" }),
    });

  const glyphAnimations = (
    { centerX, centerY, delay, glyph, height }: Step,
    appearing: boolean
  ) => {
    const hidden = motion
      ? {
          filter: `blur(${numericText.blur * height}px)`,
          opacity: 0,
          scale: numericText.scale,
        }
      : { opacity: 0 };
    const shown = motion
      ? { filter: "blur(0px)", opacity: 1, scale: 1 }
      : { opacity: 1 };
    const away = {
      translate: `0 ${(appearing ? travel : -travel) * height}px`,
    };
    const home = { translate: "0 0" };
    glyph.style.transformOrigin = `${centerX}px ${centerY}px`;
    return [
      animate(
        glyph,
        appearing ? [hidden, shown] : [shown, hidden],
        fadeSpring,
        delay
      ),
      ...(motion
        ? [
            animate(
              glyph,
              appearing ? [away, home] : [home, away],
              offsetSpring,
              delay
            ),
          ]
        : []),
    ];
  };

  return [
    ...changes.map(({ from, slot, to }) =>
      animate(
        slot,
        [{ width: `${from}px` }, { width: `${to}px` }],
        layoutSpring
      )
    ),
    ...entering.flatMap((step) => glyphAnimations(step, true)),
    ...leaving.flatMap((step) => glyphAnimations(step, false)),
  ];
};
