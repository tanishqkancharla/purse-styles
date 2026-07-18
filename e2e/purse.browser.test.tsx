import { defineVars, style } from "../src/index"
import { expect, test } from "./fixtures/test"

const colors = defineVars({
	text: "rgb(12, 34, 56)",
})

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

test("composes style elements and skips falsy arguments", async ({
	renderStyledComponent,
}) => {
	const base = style({
		color: "blue",
		marginTop: 4,
	})

	const { subject } = await renderStyledComponent(
		<section>Composed</section>,
		base,
		undefined,
		null,
		false,
		{
			backgroundColor: "yellow",
			opacity: 0.75,
		},
	)

	await expect.element(subject).toHaveComputedStyle({
		color: "rgb(0, 0, 255)",
		"margin-top": "4px",
		backgroundColor: "rgb(255, 255, 0)",
		opacity: "0.75",
	})
})

test("applies pseudo-class styles after real browser interaction", async ({
	renderStyledComponent,
}) => {
	const { subject } = await renderStyledComponent(
		<button disabled>Interactive</button>,
		{
			backgroundColor: "gray",
			"&:disabled": {
				backgroundColor: "blue",
			},
			"&:disabled:hover": {
				backgroundColor: "red",
			},
		},
	)

	await expect.element(subject).toHaveComputedStyle({
		backgroundColor: "rgb(0, 0, 255)",
	})

	await subject.hover()

	await expect.element(subject).toHaveComputedStyle({
		backgroundColor: "rgb(255, 0, 0)",
	})
})

test("applies styles from active media rules", async ({
	renderStyledComponent,
}) => {
	const { subject } = await renderStyledComponent(
		<article>Responsive</article>,
		{
			"@media (min-width: 1px)": {
				borderTopColor: "green",
				borderTopStyle: "solid",
				borderTopWidth: 3,
			},
		},
	)

	await expect.element(subject).toHaveComputedStyle({
		borderTopColor: "rgb(0, 128, 0)",
		borderTopStyle: "solid",
		borderTopWidth: "3px",
	})
})

test("resolves generated and custom CSS variables", async ({
	renderStyledComponent,
}) => {
	const { subject } = await renderStyledComponent(
		<p>Variables</p>,
		{
			"--local-accent": "rebeccapurple",
			color: colors.text,
			outlineColor: "var(--local-accent)",
			outlineStyle: "solid",
		},
	)

	await expect.element(subject).toHaveComputedStyle({
		color: "rgb(12, 34, 56)",
		"--local-accent": "rebeccapurple",
		outlineColor: /^rgb\(102,\s*51,\s*153\)$/,
	})
})

test("supports multiple styled components in one test", async ({
	renderStyledComponent,
}) => {
	const first = await renderStyledComponent(<span>First</span>, {
		color: "red",
	})
	const second = await renderStyledComponent(<span>Second</span>, {
		color: "green",
	})

	await expect.element(first.subject).toHaveComputedStyle({
		color: "rgb(255, 0, 0)",
	})
	await expect.element(second.subject).toHaveComputedStyle({
		color: "rgb(0, 128, 0)",
	})
})
