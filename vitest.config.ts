import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

import { emulateMediaCommand } from "./e2e/fixtures/emulateMediaCommand"
import { DEFAULT_VIEWPORT } from "./e2e/fixtures/mediaOptions"

export default defineConfig({
	plugins: [react()],
	optimizeDeps: {
		include: ["lodash-es", "react", "vitest-browser-react/pure"],
	},
	test: {
		allowOnly: !process.env.CI,
		projects: [
			{
				test: {
					name: "unit",
					include: ["src/*.test.ts"],
					environment: "node",
				},
			},
			{
				test: {
					name: "browser",
					include: ["e2e/*.browser.test.tsx"],
					browser: {
						commands: {
							emulateMedia: emulateMediaCommand,
						},
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: "chromium" }],
						viewport: DEFAULT_VIEWPORT,
					},
				},
			},
		],
	},
})
