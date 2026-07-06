// Minimal ESLint config for cus_dis_bot (L-06).
// Catches the class of bugs found in the audit (unused vars, no-undef for the
// /g-regex .test() pattern is caught by code-review, but this enforces general
// hygiene). Run with: npm run lint
export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { console: "readonly", process: "readonly", setTimeout: "readonly", setInterval: "readonly", clearTimeout: "readonly", clearInterval: "readonly" },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      eqeqeq: ["warn", "smart"],
    },
  },
  {
    ignores: ["node_modules/**", "dist/**"],
  },
];
