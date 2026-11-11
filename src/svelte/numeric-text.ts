import { NumericText } from "@/dom/numeric-text";
import type { NumericValue } from "@/dom/numeric-text";

export type { NumericRun, NumericValue } from "@/dom/numeric-text";

export interface NumericTextParameters {
  countsDown?: boolean;
  value: NumericValue;
}

export const numericText = (
  node: HTMLElement,
  { countsDown, value }: NumericTextParameters
) => {
  const controller = new NumericText(node, value, { countsDown });
  return {
    destroy: () => controller.destroy(),
    update: (next: NumericTextParameters) =>
      controller.update(next.value, { countsDown: next.countsDown }),
  };
};
