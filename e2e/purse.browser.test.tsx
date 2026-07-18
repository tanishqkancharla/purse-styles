import { expect, test } from "./fixtures/test"

const browserHarnessStyleCount =
	document.head.querySelectorAll("style").length

test("renders an element through PurseProvider and useStyles", async ({
	renderStyled,
}) => {
	expect(document.head.querySelectorAll("style")).toHaveLength(
		browserHarnessStyleCount,
	)

	const { subject } = await renderStyled(
		<button className="existing" disabled type="button">
			Save
		</button>,
		{ color: "red" },
	)

	await expect.element(subject).toHaveTextContent("Save")
	await expect.element(subject).toBeDisabled()

	const button = subject.element()
	expect(button.getAttribute("type")).toBe("button")
	expect(button.classList).toContain("existing")

	const purseClassName = Array.from(button.classList).find(
		(className) => className !== "existing",
	)
	expect(purseClassName).toBeDefined()

	const injectedCss = Array.from(document.head.querySelectorAll("style"))
		.map((styleElement) => styleElement.textContent)
		.join("")
	expect(document.head.querySelectorAll("style")).toHaveLength(
		browserHarnessStyleCount + 2,
	)
	expect(injectedCss).toContain(`.${purseClassName}{color:red;}`)
})

test("automatically cleans up rendered elements and style tags", () => {
	expect(document.querySelector("button")).toBeNull()
	expect(document.head.querySelectorAll("style")).toHaveLength(
		browserHarnessStyleCount,
	)
})
