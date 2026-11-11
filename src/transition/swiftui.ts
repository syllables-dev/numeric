import type { Spring } from "@/transition/spring";

export const numericText = {
  blur: 0.25,
  offset: 0.59375,
  scale: 0.3984375,
  stagger: 0.15,
  staggerSeconds: 0.5,
};

export const fadeSpring: Spring = { damping: 37, mass: 1, stiffness: 344 };

export const offsetSpring: Spring = { damping: 34, mass: 2, stiffness: 470 };
