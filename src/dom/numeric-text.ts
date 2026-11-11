import { alignGlyphs, splitGlyphs } from "@/glyphs/align";
import type { GlyphEdit } from "@/glyphs/align";
import { springTiming } from "@/transition/spring";
import type { SpringTiming } from "@/transition/spring";
import { fadeSpring, numericText, offsetSpring } from "@/transition/swiftui";

export interface NumericRun {
  className?: string;
  text: string;
}

export type NumericValue = string | readonly NumericRun[];

export interface NumericTextOptions {
  countsDown?: boolean;
}

interface Glyph {
  className?: string;
  text: string;
}

interface Slot extends Glyph {
  glyph: HTMLSpanElement;
  slot: HTMLSpanElement;
}

interface Change {
  delay: number;
  entering?: HTMLSpanElement;
  from: number;
  leaving?: HTMLSpanElement;
  slot: HTMLSpanElement;
  to: number;
}

const toGlyphs = (value: NumericValue): Glyph[] =>
  (typeof value === "string" ? [{ text: value }] : value).flatMap(
    ({ className, text }) =>
      splitGlyphs(text).map((glyph) => ({ className, text: glyph }))
  );

const plainText = (value: NumericValue) =>
  typeof value === "string" ? value : value.map(({ text }) => text).join("");

const sameGlyphs = (slots: readonly Slot[], glyphs: readonly Glyph[]) =>
  slots.length === glyphs.length &&
  glyphs.every(
    ({ className, text }, index) =>
      slots[index]?.text === text && slots[index]?.className === className
  );

const glyphElement = ({ className, text }: Glyph) => {
  const glyph = document.createElement("span");
  glyph.textContent = text;
  glyph.className = className ?? "";
  return glyph;
};

const slotElement = (...children: HTMLSpanElement[]) => {
  const slot = document.createElement("span");
  slot.style.display = "inline-block";
  slot.style.position = "relative";
  slot.append(...children);
  return slot;
};

const sizerElement = (glyph: HTMLSpanElement) => {
  const sizer = glyph.cloneNode(true) as HTMLSpanElement;
  sizer.removeAttribute("style");
  sizer.style.visibility = "hidden";
  return sizer;
};

const float = (glyph: HTMLSpanElement, width: number) => {
  glyph.style.position = "absolute";
  glyph.style.top = "0";
  glyph.style.left = `calc(50% - ${width / 2}px)`;
  glyph.style.width = `${width}px`;
  glyph.style.textAlign = "center";
};

const measure = (element: HTMLElement | undefined) =>
  element?.getBoundingClientRect() ?? { height: 0, width: 0 };

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

export class NumericText {
  private readonly glyphs = document.createElement("span");
  private readonly label = document.createElement("span");
  private animations: Animation[] = [];
  private cleanup?: () => void;
  private countsDown: boolean;
  private generation = 0;
  private slots: Slot[];

  constructor(
    root: HTMLElement,
    value: NumericValue,
    { countsDown = false }: NumericTextOptions = {}
  ) {
    this.countsDown = countsDown;
    this.label.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
    this.label.textContent = plainText(value);
    this.glyphs.ariaHidden = "true";
    this.glyphs.style.whiteSpace = "pre";
    this.slots = toGlyphs(value).map((glyph) => {
      const element = glyphElement(glyph);
      return { ...glyph, glyph: element, slot: slotElement(element) };
    });
    this.glyphs.append(...this.slots.map(({ slot }) => slot));
    root.replaceChildren(this.label, this.glyphs);
  }

  update(value: NumericValue, { countsDown }: NumericTextOptions = {}) {
    this.countsDown = countsDown ?? this.countsDown;
    const next = toGlyphs(value);

    if (sameGlyphs(this.slots, next)) {
      return;
    }

    this.settle();
    this.label.textContent = plainText(value);
    const changes = this.rebuild(
      alignGlyphs(
        this.slots.map(({ text }) => text),
        next.map(({ text }) => text)
      ),
      next
    );
    const sizers = changes.map(({ entering, leaving, slot }) => {
      const sizer = sizerElement(entering ?? leaving ?? slot);
      slot.prepend(sizer);
      return sizer;
    });

    for (const { entering, to } of changes) {
      if (entering) {
        float(entering, to);
      }
    }

    this.animateChanges(changes);
    this.cleanup = () => {
      for (const sizer of sizers) {
        sizer.remove();
      }

      for (const { entering, leaving, slot } of changes) {
        leaving?.remove();

        if (entering) {
          entering.removeAttribute("style");
        } else {
          slot.remove();
        }
      }
    };
    void this.settleWhenFinished();
  }

  destroy() {
    this.settle();
    this.generation += 1;
  }

  private rebuild(edits: GlyphEdit[], next: Glyph[]) {
    const previous = this.slots;
    const widths = previous.map(({ slot }) => measure(slot).width);
    const changeCount = edits.filter(({ kind }) => kind !== "keep").length;
    const spread = numericText.stagger * numericText.staggerSeconds * 1000;
    const changes: Change[] = [];
    const slots: Slot[] = [];
    const order: HTMLSpanElement[] = [];

    for (const edit of edits) {
      const old = edit.kind === "insert" ? undefined : previous[edit.previous];
      const glyph = edit.kind === "remove" ? undefined : next[edit.next];

      if (edit.kind === "keep" && old && glyph) {
        old.glyph.className = glyph.className ?? "";
        slots.push({ ...old, className: glyph.className });
        order.push(old.slot);
        continue;
      }

      const from = edit.kind === "insert" ? 0 : (widths[edit.previous] ?? 0);
      const entering = glyph && glyphElement(glyph);
      const slot = old?.slot ?? slotElement();

      if (old) {
        float(old.glyph, from);
      }

      if (entering && glyph) {
        slot.append(entering);
        slots.push({ ...glyph, glyph: entering, slot });
      }

      changes.push({
        delay:
          changeCount < 2 ? 0 : (changes.length / (changeCount - 1)) * spread,
        entering,
        from,
        leaving: old?.glyph,
        slot,
        to: 0,
      });
      order.push(slot);
    }

    this.glyphs.replaceChildren(...order);
    this.slots = slots;
    return changes.map((change) => ({
      ...change,
      to: measure(change.entering).width,
    }));
  }

  private animateChanges(changes: Change[]) {
    const motion = !reducedMotion();
    const fade = springTiming(fadeSpring);
    const rise = springTiming(offsetSpring);
    const blur = `blur(${(numericText.blur * measure(this.glyphs).height) / 2}px)`;
    const travel = (this.countsDown ? -1 : 1) * numericText.offset * 100;
    const hidden = motion
      ? { filter: blur, opacity: 0, scale: numericText.scale }
      : { opacity: 0 };
    const shown = motion
      ? { filter: "blur(0px)", opacity: 1, scale: 1 }
      : { opacity: 1 };

    const animate = (
      element: HTMLElement,
      keyframes: Keyframe[],
      timing: SpringTiming,
      delay = 0
    ) => {
      this.animations.push(
        element.animate(keyframes, {
          delay,
          duration: motion ? timing.duration : 150,
          easing: motion ? timing.easing : "linear",
          fill: "both",
        })
      );
    };

    for (const { delay, entering, from, leaving, slot, to } of changes) {
      animate(slot, [{ width: `${from}px` }, { width: `${to}px` }], fade);

      if (entering) {
        animate(entering, [hidden, shown], fade, delay);
      }

      if (leaving) {
        animate(leaving, [shown, hidden], fade, delay);
      }

      if (motion && entering) {
        animate(
          entering,
          [{ translate: `0 ${travel}%` }, { translate: "0 0" }],
          rise,
          delay
        );
      }

      if (motion && leaving) {
        animate(
          leaving,
          [{ translate: "0 0" }, { translate: `0 ${-travel}%` }],
          rise,
          delay
        );
      }
    }
  }

  private async settleWhenFinished() {
    this.generation += 1;
    const { animations, generation } = this;

    try {
      await Promise.all(animations.map(({ finished }) => finished));
    } catch {
      return;
    }

    if (generation === this.generation) {
      this.settle();
    }
  }

  private settle() {
    const { animations, cleanup } = this;
    this.animations = [];
    this.cleanup = undefined;

    for (const animation of animations) {
      animation.cancel();
    }

    cleanup?.();
  }
}
