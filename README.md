# Numeric

Faithful SwiftUI numeric text on the web.

## Quick start

Install:

```sh
bun add @syllables-dev/numeric
```

React:

```tsx
import { NumericText } from "@syllables-dev/numeric/react";

export const Seconds = ({ seconds }: { seconds: number }) => (
  <NumericText countsDown value={`${seconds} sec`} />
);
```

Vue:

```vue
<script setup lang="ts">
import { NumericText } from "@syllables-dev/numeric/vue";

defineProps<{ seconds: number }>();
</script>

<template>
  <NumericText counts-down :value="`${seconds} sec`" />
</template>
```

Svelte:

```svelte
<script lang="ts">
  import { numericText } from "@syllables-dev/numeric/svelte";

  let { seconds }: { seconds: number } = $props();
</script>

<span use:numericText={{ countsDown: true, value: `${seconds} sec` }}></span>
```

DOM:

```ts
import { NumericText } from "@syllables-dev/numeric";

const seconds = new NumericText(element, "10 sec", { countsDown: true });
seconds.update("9 sec");
```

Read the [documentation](https://docs.syllables.dev/packages/numeric) for styled runs, directions, and how the motion matches iOS.
