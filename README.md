# numeric

Faithful SwiftUI numeric text on the web, for React, Vue, Svelte, and the DOM.

## Install

```sh
bun add @syllables-dev/numeric
```

## Usage

```tsx
import { NumericText } from "@syllables-dev/numeric/react";

export const Seconds = ({ seconds }: { seconds: number }) => (
  <NumericText countsDown value={`${seconds} sec`} />
);
```

Full documentation lives at [docs.syllables.dev/packages/numeric](https://docs.syllables.dev/packages/numeric).

## Development

```sh
bun install
bun run check
bun run typecheck
```

## License

MIT
