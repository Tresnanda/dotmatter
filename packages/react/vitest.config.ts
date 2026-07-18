import { defineProject } from "vitest/config"

export default defineProject({
  resolve: {
    alias: {
      "@dotmatter/core": new URL("../core/src/index.ts", import.meta.url).pathname,
      "@dotmatter/shaders": new URL("../shaders/src/index.ts", import.meta.url).pathname,
    },
  },
  test: {
    name: "react",
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
})
