import { measureInk } from "@/dom/ink";
import type { Ink } from "@/dom/ink";
import { springTiming } from "@/transition/spring";
import type { Spring } from "@/transition/spring";
import { fadeSpring, numericText, offsetSpring } from "@/transition/swiftui";

export interface Change {
  delay: number;
  entering?: HTMLSpanElement;
  from: number;
  leaving?: HTMLSpanElement;
  slot: HTMLSpanElement;
  to: number;
}

interface Step extends Ink {
  delay: number;
}

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const steps = (
  changes: readonly Change[],
  glyphOf: (change: Change) => HTMLSpanElement | undefined
): Step[] => {
  const timed = changes.flatMap((change) => {
    const glyph = glyphOf(change);
    return glyph ? [{ delay: change.delay, glyph }] : [];
  });
  return measureInk(timed.map(({ glyph }) => glyph)).map((ink, index) => ({
    ...ink,
    delay: timed[index]?.delay ?? 0,
  }));
};

export const animateChanges = (
  changes: readonly Change[],
  countsDown: boolean
) => {
  const motion = !reducedMotion();
  const travel = countsDown ? -numericText.offset : numericText.offset;
  const entering = steps(changes, ({ entering: glyph }) => glyph);
  const leaving = steps(changes, ({ leaving: glyph }) => glyph);

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
      animate(slot, [{ width: `${from}px` }, { width: `${to}px` }], fadeSpring)
    ),
    ...entering.flatMap((step) => glyphAnimations(step, true)),
    ...leaving.flatMap((step) => glyphAnimations(step, false)),
  ];
};
