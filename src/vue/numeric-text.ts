import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import type { PropType } from "vue";

import { NumericText as NumericTextController } from "@/dom/numeric-text";
import type { NumericValue } from "@/dom/numeric-text";

export type { NumericRun, NumericValue } from "@/dom/numeric-text";

const staticText = (value: NumericValue) =>
  typeof value === "string"
    ? value
    : value.map(({ className, text }) => h("span", { class: className }, text));

export const NumericText = defineComponent({
  name: "NumericText",
  props: {
    countsDown: { default: false, type: Boolean },
    value: { required: true, type: [String, Array] as PropType<NumericValue> },
  },
  setup(props) {
    const root = ref<HTMLSpanElement>();
    const initial = staticText(props.value);
    let controller: NumericTextController | undefined;

    onMounted(() => {
      if (root.value) {
        controller = new NumericTextController(root.value, props.value, {
          countsDown: props.countsDown,
        });
      }
    });

    watch(
      () => [props.value, props.countsDown] as const,
      ([value, countsDown]) => controller?.update(value, { countsDown }),
      { deep: true }
    );

    onBeforeUnmount(() => controller?.destroy());

    return () => h("span", { ref: root }, initial);
  },
});
