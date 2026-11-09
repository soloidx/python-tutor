import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config.js";

if (!process.env.PUBLISHER_PUBLIC_DIR) {
  throw new Error(
    "Publisher verification requires PUBLISHER_PUBLIC_DIR; run PUBLISHER_PUBLIC_DIR=/path/to/publisher/public npm run test:publisher",
  );
}

export default defineConfig({
  ...baseConfig,
  testIgnore: [],
  testMatch: "publisher-publication.spec.js",
});
