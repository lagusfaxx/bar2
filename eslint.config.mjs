import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cliente de Prisma: codigo generado, no se revisa.
    "src/generated/**",
    // Skills instaladas por herramientas externas.
    ".claude/**",
    ".windsurf/**",
    ".agents/**",
  ]),
]);

export default eslintConfig;
