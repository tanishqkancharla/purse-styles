import { expect, test } from "./fixtures/test"

test("applies styles to the rendered element", async ({
	renderStyledComponent,
}) => {
	const { subject } = await renderStyledComponent(
		<button className="existing" disabled type="button">
			Save
		</button>,
		{ color: "red", paddingTop: 8 },
	)

	await expect.element(subject).toHaveTextContent("Save")
	await expect.element(subject).toBeDisabled()
	await expect.element(subject).toHaveComputedStyle({
		color: "rgb(255, 0, 0)",
		paddingTop: "8px",
	})

	const button = subject.element() as HTMLButtonElement
	expect(button.getAttribute("type")).toBe("button")
	expect(button.classList).toContain("existing")
})
