export interface Spring {
  damping: number;
  mass: number;
  stiffness: number;
}

export interface SpringTiming {
  duration: number;
  easing: string;
}

const restThreshold = 0.001;
const sampleRate = 60;
const maxSeconds = 10;
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

export const settlingSeconds = (spring: Spring) => {
  const step = 1 / (sampleRate * 4);
  let settled = maxSeconds;

  for (let seconds = maxSeconds; seconds >= 0; seconds -= step) {
    if (Math.abs(springPosition(spring, seconds) - 1) > restThreshold) {
      return Math.min(settled, maxSeconds);
    }
    settled = seconds;
  }

  return 0;
};

export const springTiming = (spring: Spring): SpringTiming => {
  const key = `${spring.stiffness}:${spring.damping}:${spring.mass}`;
  const cached = timings.get(key);

  if (cached) {
    return cached;
  }

  const seconds = settlingSeconds(spring);
  const count = Math.max(2, Math.ceil(seconds * sampleRate) + 1);
  const stops = Array.from({ length: count }, (_, index) =>
    index === count - 1
      ? "1"
      : String(
          Math.round(
            springPosition(spring, (index / (count - 1)) * seconds) * 10_000
          ) / 10_000
        )
  );
  const timing = {
    duration: Math.round(seconds * 1000),
    easing: `linear(${stops.join(", ")})`,
  };
  timings.set(key, timing);
  return timing;
};
