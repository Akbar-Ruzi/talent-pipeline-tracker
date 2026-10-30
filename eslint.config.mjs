import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Phase 1 public demo: the academy API is read-only. Its write functions
  // stay in lib/api/ but can't be imported anywhere else.
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs}"],
    ignores: ["lib/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/api/records",
              importNames: ["createRecord", "updateRecord", "updateRecordStatus"],
              message:
                "The public demo never writes to the academy API. Use the local functions in @/lib/local/local-candidates.",
            },
            {
              name: "@/lib/api/notes",
              importNames: ["createNote", "deleteNote"],
              message:
                "The public demo never writes to the academy API. Use the local functions in @/lib/local/local-notes.",
            },
          ],
        },
      ],
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
