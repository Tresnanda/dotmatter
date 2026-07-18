import { defineProject } from "vitest/config"

export default defineProject({
  resolve: {
    alias: {
      "@dotmatter/core": new URL("../../packages/core/src/index.ts", import.meta.url).pathname,
      "@dotmatter/shaders": new URL("../../packages/shaders/src/index.ts", import.meta.url).pathname,
      "@dotmatter/react": new URL("../../packages/react/src/index.tsx", import.meta.url).pathname,
    },
  },
  test: {
    name: "playground",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
