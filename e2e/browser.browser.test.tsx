import { expect, test } from "vitest"
import { render } from "vitest-browser-react"

test("renders React in a real browser", async () => {
	const screen = await render(<p>Browser test ready</p>)

	await expect.element(screen.getByText("Browser test ready")).toBeVisible()
})
