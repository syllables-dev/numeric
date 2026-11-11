import { animateChanges } from "@/dom/motion";
import type { Change } from "@/dom/motion";
import { glyphElement, slotElement, widthOf } from "@/dom/slots";
import type { Glyph, Slot } from "@/dom/slots";
import { alignGlyphs, splitGlyphs } from "@/glyphs/align";
import type { GlyphEdit } from "@/glyphs/align";
import { numericText } from "@/transition/swiftui";

export interface NumericRun {
  className?: string;
  text: string;
}

export type NumericValue = string | readonly NumericRun[];

export interface NumericTextOptions {
  countsDown?: boolean;
}

const visuallyHidden =
  "position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";

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
    this.label.style.cssText = visuallyHidden;
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
    this.animations = animateChanges(changes, this.countsDown);
    this.cleanup = () => {
      for (const { entering, leaving, slot } of changes) {
        leaving?.remove();

        if (!entering) {
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
    const widths = previous.map(({ slot }) => widthOf(slot));
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

      const entering = glyph && glyphElement(glyph);
      const slot = old?.slot ?? slotElement();

      if (entering && glyph) {
        slot.append(entering);
        slots.push({ ...glyph, glyph: entering, slot });
      }

      changes.push({
        delay:
          changeCount < 2 ? 0 : (changes.length / (changeCount - 1)) * spread,
        entering,
        from: edit.kind === "insert" ? 0 : (widths[edit.previous] ?? 0),
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
      to: widthOf(change.entering),
    }));
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
