import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.config({
    extends: ["next/core-web-vitals"],
    rules: {
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "warn"
    }
  }),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "data/**",
      "python-backend/**",
      ".system_generated/**"
    ]
  }
];

export default eslintConfig;
