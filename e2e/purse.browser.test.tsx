import { expect, test } from "./fixtures/test"

test("applies styles to the rendered element", async ({
	renderStyledComponent,
}) => {
	const { subject } = await renderStyledComponent(
		<button className="existing" disabled type="button">
			Save
		</button>,
		{ color: "red" },
	)

	await expect.element(subject).toHaveTextContent("Save")
	await expect.element(subject).toBeDisabled()

	const button = subject.element() as HTMLButtonElement
	expect(button.getAttribute("type")).toBe("button")
	expect(button.classList).toContain("existing")
	expect(getComputedStyle(button).color).toBe("rgb(255, 0, 0)")
})
