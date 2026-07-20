import type {} from "@vitest/browser-playwright"
import type { BrowserCommand } from "vitest/node"

import type { BrowserMediaOptions } from "./mediaOptions"

export const emulateMediaCommand: BrowserCommand<
	[options: BrowserMediaOptions]
> = async ({ page, provider }, options) => {
	if (provider.name !== "playwright") {
		throw new Error(
			`emulateMedia requires Playwright, received ${provider.name}`,
		)
	}

	await page.emulateMedia(options)
}
