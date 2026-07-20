import { defineVars, style } from "../src/index"
import { expect, test } from "./fixtures/test"

const colors = defineVars({
	adaptiveText: {
		default: "black",
		"@media (prefers-color-scheme: dark)": "white",
	},
	text: "rgb(12, 34, 56)",
})

test("injects declarations and resolves numeric lengths", async ({
	renderStyledComponent,
}) => {
	const { subject } = await renderStyledComponent(
		<button>Save</button>,
		{ color: "red", paddingTop: 8 },
	)

	await expect.element(subject).toHaveComputedStyle({
		color: "rgb(255, 0, 0)",
		paddingTop: "8px",
	})
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

test("applies independent styles to multiple elements", async ({
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

test("applies conditional styles across active media features", async ({
	emulateMedia,
	renderStyledComponent,
}) => {
	await emulateMedia({
		colorScheme: "dark",
		reducedMotion: "reduce",
		viewport: {
			width: 400,
			height: 600,
		},
	})

	const { subject } = await renderStyledComponent(
		<main>Media preferences</main>,
		{
			color: colors.adaptiveText,
			fontSize: 12,
			transitionDuration: "1s",
			"@media (prefers-reduced-motion: reduce)": {
				transitionDuration: "0s",
			},
			"@media (max-width: 500px)": {
				fontSize: 20,
			},
		},
	)

	await expect.element(subject).toHaveComputedStyle({
		color: "rgb(255, 255, 255)",
		fontSize: "20px",
		transitionDuration: "0s",
	})
})

test("applies print-specific nested styles", async ({
	emulateMedia,
	renderStyledComponent,
}) => {
	await emulateMedia({ media: "print" })

	const { subject } = await renderStyledComponent(
		<article>Printable</article>,
		{
			color: "red",
			"@media print": {
				color: "blue",
			},
		},
	)

	await expect.element(subject).toHaveComputedStyle({
		color: "rgb(0, 0, 255)",
	})
})
