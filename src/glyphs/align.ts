export type GlyphEdit =
  | { kind: "insert"; next: number }
  | { kind: "keep"; next: number; previous: number }
  | { kind: "remove"; previous: number }
  | { kind: "replace"; next: number; previous: number };

const segmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : undefined;

export const splitGlyphs = (text: string) =>
  segmenter
    ? Array.from(segmenter.segment(text), ({ segment }) => segment)
    : [...text];

const editCosts = (previous: readonly string[], next: readonly string[]) => {
  const costs = [
    Array.from({ length: next.length + 1 }, (_, column) => column),
  ];

  for (const [row, glyph] of previous.entries()) {
    const above = costs[row] ?? [];
    const current = [row + 1];

    for (const [column, candidate] of next.entries()) {
      current.push(
        Math.min(
          (above[column] ?? 0) + (glyph === candidate ? 0 : 1),
          (above[column + 1] ?? 0) + 1,
          (current[column] ?? 0) + 1
        )
      );
    }

    costs.push(current);
  }

  return (row: number, column: number) => costs[row]?.[column] ?? 0;
};

export const alignGlyphs = (
  previous: readonly string[],
  next: readonly string[]
) => {
  const cost = editCosts(previous, next);
  const edits: GlyphEdit[] = [];
  let row = previous.length;
  let column = next.length;

  while (row > 0 || column > 0) {
    const same = previous[row - 1] === next[column - 1];

    if (
      row > 0 &&
      column > 0 &&
      cost(row, column) === cost(row - 1, column - 1) + (same ? 0 : 1)
    ) {
      row -= 1;
      column -= 1;
      edits.push({
        kind: same ? "keep" : "replace",
        next: column,
        previous: row,
      });
    } else if (column > 0 && cost(row, column) === cost(row, column - 1) + 1) {
      column -= 1;
      edits.push({ kind: "insert", next: column });
    } else {
      row -= 1;
      edits.push({ kind: "remove", previous: row });
    }
  }

  return edits.toReversed();
};
