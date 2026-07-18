import { defineProject } from "vitest/config"

export default defineProject({
  resolve: {
    alias: {
      "@dotmatter/core": new URL("../core/src/index.ts", import.meta.url).pathname,
    },
  },
  test: {
    name: "shaders",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
})
