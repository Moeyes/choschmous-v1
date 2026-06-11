import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Ban stray console.* — diagnostics must go through core/lib/logger (the one
  // sanctioned boundary). Keeps PII out of logs/the browser console.
  {
    rules: {
      "no-console": "error",
    },
  },
  {
    // env.ts validates environment at boot and must surface a fatal config
    // error before the app (or the logger) is usable.
    files: ["env.ts"],
    rules: {
      "no-console": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
