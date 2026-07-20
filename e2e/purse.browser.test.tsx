import { defineVars, style } from "../src/index"
import { expect, test } from "./fixtures/test"

const DARK_MEDIA = "@media (prefers-color-scheme: dark)"
const DARK_THEME = ':root[data-theme="dark"]'
const GROUPED_THEME = ':root[data-purse-grouped-theme="dark"]'
const COLOR_1 = "rgb(12, 34, 56)"
const COLOR_2 = "rgb(240, 241, 242)"
const COLOR_3 = "rgb(100, 101, 102)"
const COLOR_4 = "rgb(1, 2, 3)"

const colors = defineVars({
	adaptiveText: {
		default: "black",
		[DARK_MEDIA]: "white",
	},
	text: COLOR_1,
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
		color: COLOR_1,
		"--local-accent": "rebeccapurple",
		outlineColor: /^rgb\(102,\s*51,\s*153\)$/,
	})
})

test("applies selector-conditioned variables from root attributes", async ({
	renderStyledComponent,
}) => {
	const selectorColors = defineVars({
		selectorText: {
			default: COLOR_1,
			[DARK_THEME]: COLOR_2,
		},
	})
	const { subject } = await renderStyledComponent(
		<p>Selector variables</p>,
		{ color: selectorColors.selectorText },
	)

	try {
		await expect.element(subject).toHaveComputedStyle({
			color: COLOR_1,
		})

		document.documentElement.dataset.theme = "dark"

		await expect.element(subject).toHaveComputedStyle({
			color: COLOR_2,
		})
	} finally {
		delete document.documentElement.dataset.theme
	}
})

test("applies mixed at-rule and selector variable conditions", async ({
	emulateMedia,
	renderStyledComponent,
}) => {
	await emulateMedia({ colorScheme: "dark" })
	const mixedConditionColors = defineVars({
		mixedText: {
			default: COLOR_1,
			[DARK_THEME]: COLOR_3,
			[DARK_MEDIA]: COLOR_2,
		},
	})
	const { subject } = await renderStyledComponent(
		<p>Mixed variable conditions</p>,
		{ color: mixedConditionColors.mixedText },
	)

	try {
		await expect.element(subject).toHaveComputedStyle({
			color: COLOR_2,
		})

		document.documentElement.dataset.theme = "dark"

		await expect.element(subject).toHaveComputedStyle({
			color: COLOR_3,
		})
	} finally {
		delete document.documentElement.dataset.theme
	}
})

test("applies a selector condition to multiple tokens", async ({
	renderStyledComponent,
}) => {
	const groupedSelectorColors = defineVars({
		background: {
			default: COLOR_1,
			[GROUPED_THEME]: COLOR_4,
		},
		text: {
			default: COLOR_1,
			[GROUPED_THEME]: COLOR_2,
		},
	})
	const { subject } = await renderStyledComponent(
		<p>Grouped selector variables</p>,
		{
			backgroundColor: groupedSelectorColors.background,
			color: groupedSelectorColors.text,
		},
	)

	try {
		document.documentElement.dataset.purseGroupedTheme = "dark"

		await expect.element(subject).toHaveComputedStyle({
			backgroundColor: COLOR_4,
			color: COLOR_2,
		})
	} finally {
		delete document.documentElement.dataset.purseGroupedTheme
	}
})

test("hashes variable conditions independently of insertion order", () => {
	const first = defineVars({
		deterministicText: {
			default: COLOR_1,
			[DARK_THEME]: COLOR_2,
			[DARK_MEDIA]: COLOR_3,
		},
	})
	const second = defineVars({
		deterministicText: {
			[DARK_MEDIA]: COLOR_3,
			[DARK_THEME]: COLOR_2,
			default: COLOR_1,
		},
	})

	expect(first.deterministicText).toBe(second.deterministicText)
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
