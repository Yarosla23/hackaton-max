import { build } from "esbuild";

const shared = {
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node22",
  sourcemap: true,
  minify: true,
  packages: "bundle",
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ["src/api-function.ts"],
    outfile: "build/api-function.js",
  }),
  build({
    ...shared,
    entryPoints: ["src/worker-function.ts"],
    outfile: "build/worker-function.js",
  }),
]);
