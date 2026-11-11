import type { Spring } from "@/transition/spring";

export const numericText = {
  blur: 0.25,
  offset: 0.59375,
  scale: 0.3984375,
  sequenceBegin: 0.15,
  sequenceLength: 0.85,
};

export const fadeSpring: Spring = {
  damping: 37,
  duration: 0.5,
  mass: 1,
  stiffness: 344,
};

export const offsetSpring: Spring = {
  damping: 34,
  duration: 0.8,
  mass: 2,
  stiffness: 470,
};

export const layoutSpring: Spring = {
  damping: 8 * Math.PI,
  duration: 0.8,
  mass: 1,
  stiffness: 16 * Math.PI ** 2,
};
