import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const clientEntry = "dist/react/numeric-text.js";
const aliasImport =
  /(?<prefix>(?:from|import)\s*\(?\s*["'])@\/(?<alias>[^"']+)(?<suffix>["'])/gu;

await rm("dist", { force: true, recursive: true });

const bundle = await Bun.build({
  entrypoints: [
    "src/dom/numeric-text.ts",
    "src/react/numeric-text.tsx",
    "src/svelte/numeric-text.ts",
    "src/vue/numeric-text.ts",
  ],
  external: ["react", "react/jsx-runtime", "vue"],
  format: "esm",
  minify: true,
  outdir: "dist",
  root: "src",
  splitting: true,
  target: "browser",
});

if (!bundle.success) {
  for (const log of bundle.logs) {
    console.error(log);
  }
  process.exit(1);
}

const client = await readFile(clientEntry, "utf-8");
await writeFile(clientEntry, `"use client";\n${client}`);

const types = Bun.spawnSync(["tsc", "-p", "tsconfig.build.json"], {
  stderr: "inherit",
  stdout: "inherit",
});

if (types.exitCode !== 0) {
  process.exit(types.exitCode);
}

const declarations = await readdir("dist", { recursive: true });

await Promise.all(
  declarations
    .filter((name) => name.endsWith(".d.ts"))
    .map(async (name) => {
      const file = path.join("dist", name);
      const text = await readFile(file, "utf-8");
      await writeFile(
        file,
        text.replaceAll(aliasImport, (...match) => {
          const { alias, prefix, suffix } = match.at(-1) as Record<
            "alias" | "prefix" | "suffix",
            string
          >;
          const steps = path.relative(
            path.dirname(file),
            path.join("dist", alias)
          );
          return `${prefix}${steps.startsWith(".") ? steps : `./${steps}`}${suffix}`;
        })
      );
    })
);
