import assert from "assert"
import { expect } from "extendable-expect"
import { describe, expectTypeOf, it } from "vitest"
import {
	CSSProperties,
	InMemoryStyleApi,
	compileGlobalStyleRules,
	createInMemoryStyleApi,
	style,
} from "./purse"

describe("Purse", () => {
	const expectStyles = expect.extend({
		toContainRule(api: InMemoryStyleApi, expectedRuleToContain: string) {
			expect(api.styleRulesRef.current).toContain(expectedRuleToContain)
		},
		toOnlyContainRules(
			api: InMemoryStyleApi,
			expectedRulesToContain: string[],
		) {
			for (const expectedRule of expectedRulesToContain) {
				expect(api.styleRulesRef.current).toContain(expectedRule)
			}
		},
		toHaveCount(api: InMemoryStyleApi, expectedCount: number) {
			expect(api.styleRulesRef.current).toHaveLength(expectedCount)
		},
	})

	it("Compiles correctly", () => {
		const test = style({
			accentColor: "blue",
			borderColor: "blue",
		})

		assert(test.owned !== undefined)
		expect(test.owned.styleRules).toContain(
			`.${test.className}{accent-color:blue;border-color:blue;}`,
		)
	})

	it("Compiles simple pseudo selectors", () => {
		const api = createInMemoryStyleApi()

		const test = style({
			"@media (hover: hover)": {
				backgroundColor: "blue",
			},
		})

		api.addStyleElement(test)
		expectStyles(api).toOnlyContainRules([
			`@media (hover: hover){.${test.className}{background-color:blue;}}`,
		])
	})

	it("Compiles simple at selectors", () => {
		const api = createInMemoryStyleApi()

		const test = style({
			"&:disabled": {
				backgroundColor: "blue",
			},
		})

		api.addStyleElement(test)
		expectStyles(api).toOnlyContainRules([
			`.${test.className}:disabled{background-color:blue;}`,
		])
	})

	it("Compiles multiple pseudo selectors", () => {
		const api = createInMemoryStyleApi()

		const test = style({
			"&:disabled": {
				backgroundColor: "blue",
			},
			"&:disabled:hover": {
				backgroundColor: "red",
			},
			"&:hover": {
				backgroundColor: "green",
			},
		})

		api.addStyleElement(test)

		expectStyles(api).toOnlyContainRules([
			`.${test.className}:disabled{background-color:blue;}`,
			`.${test.className}:disabled:hover{background-color:red;}`,
			`.${test.className}:hover{background-color:green;}`,
		])
	})

	it("Skips falsy style arguments", () => {
		const base = style({ color: "red" })
		const composed = style(base, undefined, null, false, { margin: "8px" })

		expect(composed.composed).toHaveLength(1)
		assert.strictEqual(composed.composed[0], base)
		assert(composed.owned !== undefined)
		expect(composed.owned.styleRules).toContain(
			`.${composed.owned.className}{margin:8px;}`,
		)
		assert.ok(composed.className.includes(base.className))
		assert.ok(composed.className.includes(composed.owned.className))
	})

	it("Keeps vendor-prefixed unitless number properties dimensionless", () => {
		const test = style({
			WebkitLineClamp: 3,
			MozLineClamp: 2,
			lineClamp: 1,
		})

		assert(test.owned !== undefined)
		expect(test.owned.styleRules).toContain(
			`.${test.className}{-webkit-line-clamp:3;-moz-line-clamp:2;line-clamp:1;}`,
		)
	})

	it("Still adds px to vendor-prefixed dimensional properties", () => {
		const test = style({
			WebkitTransform: 10,
		})

		assert(test.owned !== undefined)
		expect(test.owned.styleRules).toContain(
			`.${test.className}{-webkit-transform:10px;}`,
		)
	})

	it("Compiles custom property declarations without adding px", () => {
		const test = style({
			"--space": 2,
		})

		assert(test.owned !== undefined)
		expect(test.owned.styleRules).toContain(
			`.${test.className}{--space:2;}`,
		)
	})

	it("Compiles custom property references as ordinary values", () => {
		const test = style({
			color: "var(--color)",
		})

		assert(test.owned !== undefined)
		expect(test.owned.styleRules).toContain(
			`.${test.className}{color:var(--color);}`,
		)
	})

	it("Compiles global style objects against a selector", () => {
		expect(
			compileGlobalStyleRules("body", {
				margin: 0,
				"& a": {
					color: "blue",
				},
				"@media (prefers-color-scheme: dark)": {
					backgroundColor: "black",
				},
			}),
		).toEqual([
			"body{margin:0px;}",
			"body a{color:blue;}",
			"@media (prefers-color-scheme: dark){body{background-color:black;}}",
		])
	})

	it("Accepts nested style objects for useInjectGlobalStyles", () => {
		const cssProperties = {
			margin: 0,
			"&:focus-visible": {
				outline: "2px solid blue",
			},
			"@media (hover: hover)": {
				"&:hover": {
					color: "blue",
				},
			},
		} satisfies CSSProperties

		expectTypeOf(cssProperties).toExtend<CSSProperties>()
	})

	it("Flattens &:hover nested inside @media", () => {
		const test = style({
			padding: 8,
			"@media (hover: hover)": {
				"&:hover": { backgroundColor: "navy" },
			},
		})

		assert(test.owned !== undefined)
		expect(test.owned.styleRules).toEqual([
			`.${test.className}{padding:8px;}`,
			`@media (hover: hover){.${test.className}:hover{background-color:navy;}}`,
		])
	})

	it("Flattens @media nested inside &:hover to the same CSS", () => {
		const mediaThenHover = style({
			"@media (hover: hover)": {
				"&:hover": { backgroundColor: "navy" },
			},
		})
		const hoverThenMedia = style({
			"&:hover": {
				"@media (hover: hover)": { backgroundColor: "navy" },
			},
		})

		assert(mediaThenHover.owned !== undefined)
		assert(hoverThenMedia.owned !== undefined)
		assert.strictEqual(mediaThenHover.className, hoverThenMedia.className)
		expect(mediaThenHover.owned.styleRules).toEqual(
			hoverThenMedia.owned.styleRules,
		)
		expect(mediaThenHover.owned.styleRules).toEqual([
			`@media (hover: hover){.${mediaThenHover.className}:hover{background-color:navy;}}`,
		])
	})

	it("Splits mixed declarations and nested selectors under one at-rule", () => {
		const test = style({
			"@media (min-width: 800px)": {
				padding: 16,
				"&:hover": { backgroundColor: "red" },
				"& .icon": { opacity: 1 },
			},
		})

		assert(test.owned !== undefined)
		expect(test.owned.styleRules).toEqual([
			`@media (min-width: 800px){.${test.className}{padding:16px;}}`,
			`@media (min-width: 800px){.${test.className}:hover{background-color:red;}}`,
			`@media (min-width: 800px){.${test.className} .icon{opacity:1;}}`,
		])
	})

	it("Merges nested @media + &:hover objects without dropping declarations", () => {
		const merged = style(
			{ "@media (hover: hover)": { "&:hover": { color: "red" } } },
			{
				"@media (hover: hover)": {
					"&:hover": { backgroundColor: "blue" },
				},
			},
		)
		const together = style({
			"@media (hover: hover)": {
				"&:hover": { color: "red", backgroundColor: "blue" },
			},
		})

		assert(merged.owned !== undefined)
		assert(together.owned !== undefined)
		assert.strictEqual(merged.className, together.className)
		expect(merged.owned.styleRules).toEqual([
			`@media (hover: hover){.${merged.className}:hover{color:red;background-color:blue;}}`,
		])
	})

	it("Distinguishes hashes for media-on-base vs hover-inside-media", () => {
		const mediaOnBase = style({
			"@media (hover: hover)": { backgroundColor: "navy" },
		})
		const hoverInsideMedia = style({
			"@media (hover: hover)": {
				"&:hover": { backgroundColor: "navy" },
			},
		})

		assert.notStrictEqual(mediaOnBase.className, hoverInsideMedia.className)
	})

	it("Compiles nested global style objects against a selector", () => {
		expect(
			compileGlobalStyleRules("body", {
				"@media (hover: hover)": {
					"& a:hover": { color: "blue" },
				},
			}),
		).toEqual(["@media (hover: hover){body a:hover{color:blue;}}"])

		expect(
			compileGlobalStyleRules("a", {
				"@media (hover: hover)": {
					"&:hover": { color: "blue" },
				},
			}),
		).toEqual(["@media (hover: hover){a:hover{color:blue;}}"])

		expect(
			compileGlobalStyleRules("a", {
				"&:hover": {
					"@media (hover: hover)": { color: "blue" },
				},
			}),
		).toEqual(["@media (hover: hover){a:hover{color:blue;}}"])
	})

	it("Flattens stacked wrapping at-rules", () => {
		const test = style({
			"@media (min-width: 800px)": {
				"@supports (hover: hover)": {
					"&:hover": { backgroundColor: "navy" },
				},
			},
		})

		assert(test.owned !== undefined)
		expect(test.owned.styleRules).toEqual([
			`@media (min-width: 800px){@supports (hover: hover){.${test.className}:hover{background-color:navy;}}}`,
		])
	})

	it("Replaces multiple & occurrences after walking nested at-rules", () => {
		const test = style({
			"@media (hover: hover)": {
				"&:hover &": { color: "red" },
			},
		})

		assert(test.owned !== undefined)
		expect(test.owned.styleRules).toEqual([
			`@media (hover: hover){.${test.className}:hover .${test.className}{color:red;}}`,
		])
	})

	it("Throws for non-wrapping at-rules", () => {
		assert.throws(
			() =>
				style({
					"@keyframes fade": { opacity: 0 },
				} as CSSProperties),
			/@keyframes/,
		)

		assert.throws(
			() =>
				compileGlobalStyleRules("body", {
					"@font-face": { fontFamily: "Example" },
				} as CSSProperties),
			/@font-face/,
		)

		assert.throws(
			() =>
				style({
					"@property --x": { color: "red" },
				} as CSSProperties),
			/@property/,
		)

		assert.throws(
			() =>
				style({
					"@import url(x.css)": { color: "red" },
				} as CSSProperties),
			/@import/,
		)
	})

	it("Rejects non-wrapping at-rule keys in CSSProperties", () => {
		// @ts-expect-error only wrapping at-rules can be nested keys
		const invalidKeyframes: CSSProperties = {
			"@keyframes fade": { opacity: 0 },
		}
		void invalidKeyframes
	})

	it.skip("Inserts into given style element correctly", () => {})
	it.skip("Works if you pass style rule or object to useStyles", () => {})
	it.skip("Works if you pass multiple style rule or object to useStyles", () => {})
	it.skip("Inserts browser prefixes", () => {})

	it.skip("Inserting two styles with shared style object then removing one", () => {})
	it.skip("Inserting two styles with shared style object then removing both", () => {})
})
