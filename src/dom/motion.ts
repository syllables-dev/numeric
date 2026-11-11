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

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

export const animateChanges = (
  changes: readonly Change[],
  { countsDown, lineHeight }: { countsDown: boolean; lineHeight: number }
) => {
  const motion = !reducedMotion();
  const travel = (countsDown ? -1 : 1) * numericText.offset * 100;
  const hidden = motion
    ? {
        filter: `blur(${(numericText.blur * lineHeight) / 2}px)`,
        opacity: 0,
        scale: numericText.scale,
      }
    : { opacity: 0 };
  const shown = motion
    ? { filter: "blur(0px)", opacity: 1, scale: 1 }
    : { opacity: 1 };

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
    glyph: HTMLSpanElement,
    appearing: boolean,
    delay: number
  ) => {
    const away = { translate: `0 ${appearing ? travel : -travel}%` };
    const home = { translate: "0 0" };
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

  return changes.flatMap(({ delay, entering, from, leaving, slot, to }) => [
    animate(slot, [{ width: `${from}px` }, { width: `${to}px` }], fadeSpring),
    ...(entering ? glyphAnimations(entering, true, delay) : []),
    ...(leaving ? glyphAnimations(leaving, false, delay) : []),
  ]);
};
