// ex. scripts/build_npm.ts
import { build, emptyDir } from "@deno/dnt";

await emptyDir("./npm");

await build({
  entryPoints: ["./src/mod.ts"],
  outDir: "./npm",

  shims: {
    deno: "dev",
  },
  scriptModule: false,
  compilerOptions: {
    lib: ["ESNext", "DOM"],
  },
  testPattern: "./src/**/*.test.ts",
  package: {
    name: "@fishenv/wrq",
    version: Deno.args[0],
    description:
      "A lightweight web request library for modern runtimes and browsers, built on top of the native `fetch` API.",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/freshfish70/fishenv.web-request",
    },
  },
  postBuild() {
    console.log("Done.");
  },
});
