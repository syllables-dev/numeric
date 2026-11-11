"use client";

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ComponentProps } from "react";

import { NumericText as NumericTextController } from "@/dom/numeric-text";
import type { NumericValue } from "@/dom/numeric-text";

export type { NumericRun, NumericValue } from "@/dom/numeric-text";

const ignoreChanges = () => null;

const subscribeToNothing = () => ignoreChanges;

export const NumericText = ({
  countsDown = false,
  value,
  ...props
}: Omit<ComponentProps<"span">, "children"> & {
  countsDown?: boolean;
  value: NumericValue;
}) => {
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
  const root = useRef<HTMLSpanElement>(null);
  const controller = useRef<NumericTextController>(null);

  useLayoutEffect(() => {
    if (controller.current) {
      controller.current.update(value, { countsDown });
    } else if (root.current) {
      controller.current = new NumericTextController(root.current, value, {
        countsDown,
      });
    }
  });

  useLayoutEffect(
    () => () => {
      controller.current?.destroy();
      controller.current = null;
    },
    []
  );

  if (hydrated) {
    return <span ref={root} {...props} />;
  }

  return (
    <span {...props}>
      {typeof value === "string"
        ? value
        : value.map(({ className, text }, index) => (
            <span className={className} key={index}>
              {text}
            </span>
          ))}
    </span>
  );
};
