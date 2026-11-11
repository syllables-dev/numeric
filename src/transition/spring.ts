export interface Spring {
  damping: number;
  duration: number;
  mass: number;
  stiffness: number;
}

export interface SpringTiming {
  duration: number;
  easing: string;
}

const sampleRate = 60;
const timings = new Map<string, SpringTiming>();

export const springPosition = (
  { damping, mass, stiffness }: Spring,
  seconds: number
) => {
  const natural = Math.sqrt(stiffness / mass);
  const ratio = damping / (2 * Math.sqrt(stiffness * mass));

  if (ratio < 1) {
    const damped = natural * Math.sqrt(1 - ratio * ratio);
    return (
      1 -
      Math.exp(-ratio * natural * seconds) *
        (Math.cos(damped * seconds) +
          ((ratio * natural) / damped) * Math.sin(damped * seconds))
    );
  }

  if (ratio === 1) {
    return 1 - Math.exp(-natural * seconds) * (1 + natural * seconds);
  }

  const spread = natural * Math.sqrt(ratio * ratio - 1);
  const fast = -ratio * natural - spread;
  const slow = -ratio * natural + spread;
  return (
    1 +
    (slow * Math.exp(fast * seconds) - fast * Math.exp(slow * seconds)) /
      (fast - slow)
  );
};

export const springTiming = (spring: Spring): SpringTiming => {
  const key = `${spring.stiffness}:${spring.damping}:${spring.mass}:${spring.duration}`;
  const cached = timings.get(key);

  if (cached) {
    return cached;
  }

  const count = Math.max(2, Math.ceil(spring.duration * sampleRate) + 1);
  const stops = Array.from({ length: count }, (_, index) =>
    index === count - 1
      ? "1"
      : String(
          Math.round(
            springPosition(spring, (index / (count - 1)) * spring.duration) *
              10_000
          ) / 10_000
        )
  );
  const timing = {
    duration: Math.round(spring.duration * 1000),
    easing: `linear(${stops.join(", ")})`,
  };
  timings.set(key, timing);
  return timing;
};
