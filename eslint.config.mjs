import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // --- CODE HYGIENE ---
      "no-unused-vars": "off", // Handled by TS
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { "allow": ["warn", "error"] }],

      // --- IMPORT ORGANIZATION ---
      // Keeps your components/lib/hooks sections clean and readable
      "import/order": [
        "error",
        {
          "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          "alphabetize": { "order": "asc", "caseInsensitive": true }
        }
      ],

      // --- REACT SAFETY ---
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // --- PROJECT SPECIFIC GUARDRAILS ---
      // Prevent AI from using raw Date math if you prefer a library like date-fns
      "no-restricted-globals": ["error", {
        "name": "Date",
        "message": "Use the utility functions in @/lib/date-utils instead to avoid timezone bugs."
      }],
    },
  },
];