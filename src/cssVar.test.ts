import assert from "assert"
import { describe, expect, expectTypeOf, it } from "vitest"
import {
	CSSVar,
	compileVariableGroupRules,
	defineVars,
	getVariableGroupMetadata,
} from "./cssVar"
import { createInMemoryStyleApi, style } from "./purse"

function expectInjectedRules(
	api: ReturnType<typeof createInMemoryStyleApi>,
	metadata: ReturnType<typeof getVariableGroupMetadata>,
) {
	for (const rule of compileVariableGroupRules(metadata)) {
		expect(api.styleRulesRef.current).toContain(rule)
	}
}

describe("defineVars", () => {
	it("returns typed var() references for each key", () => {
		const colors = defineVars({
			text: "black",
			accent: "blue",
		})

		expectTypeOf(colors.text).toEqualTypeOf<CSSVar>()
		expectTypeOf(colors.accent).toEqualTypeOf<CSSVar>()
		expect(colors.text).toMatch(/^var\(--purse-[A-Za-z]+-text\)$/)
		expect(colors.accent).toMatch(/^var\(--purse-[A-Za-z]+-accent\)$/)
	})

	it("generates deterministic names for the same definitions", () => {
		const first = defineVars({
			text: "black",
			accent: "blue",
		})
		const second = defineVars({
			text: "black",
			accent: "blue",
		})

		expect(first.text).toBe(second.text)
		expect(first.accent).toBe(second.accent)
		expect(getVariableGroupMetadata(first).groupId).toBe(
			getVariableGroupMetadata(second).groupId,
		)
	})

	it("ignores object key insertion order when hashing", () => {
		const first = defineVars({
			text: "black",
			accent: "blue",
		})
		const second = defineVars({
			accent: "blue",
			text: "black",
		})

		expect(first.text).toBe(second.text)
		expect(first.accent).toBe(second.accent)
	})

	it("rejects keys that start with --", () => {
		expect(() =>
			defineVars({
				"--brand": "blue",
			}),
		).toThrow(/cannot start with "--"/)
	})

	it("can be used as style values", () => {
		const colors = defineVars({
			text: "black",
		})

		const test = style({
			color: colors.text,
		})

		assert(test.owned !== undefined)
		expect(test.owned.styleRules).toContain(
			`.${test.className}{color:${colors.text};}`,
		)
	})

	it("stores canonical metadata for later registration", () => {
		const colors = defineVars({
			accent: "blue",
			text: "black",
		})

		const metadata = getVariableGroupMetadata(colors)
		expect(Object.keys(metadata.definitions)).toEqual(["accent", "text"])
		expect(metadata.names.text).toBe(
			colors.text.slice("var(".length, -1),
		)
	})
})

describe("variable group injection", () => {
	it("compiles scalar defaults onto :root", () => {
		const colors = defineVars({
			accent: "blue",
			text: "black",
			space: 2,
		})
		const metadata = getVariableGroupMetadata(colors)

		expect(compileVariableGroupRules(metadata)).toEqual([
			`:root{${metadata.names.accent}:blue;${metadata.names.space}:2;${metadata.names.text}:black;}`,
		])
	})

	it("injects already-registered groups when a style api attaches", () => {
		const colors = defineVars({
			phase3Existing: "navy",
		})

		const api = createInMemoryStyleApi()
		expectInjectedRules(api, getVariableGroupMetadata(colors))
	})

	it("injects groups registered after a style api attaches", () => {
		const api = createInMemoryStyleApi()
		const colors = defineVars({
			phase3Late: "teal",
		})

		expectInjectedRules(api, getVariableGroupMetadata(colors))
	})

	it("deduplicates identical variable groups into one root rule", () => {
		const api = createInMemoryStyleApi()
		const first = defineVars({
			phase3Deduped: "purple",
		})
		defineVars({
			phase3Deduped: "purple",
		})

		const [expectedRule] = compileVariableGroupRules(
			getVariableGroupMetadata(first),
		)
		expect(
			api.styleRulesRef.current.filter((rule) => rule === expectedRule),
		).toHaveLength(1)
	})

	it("removes injected variable rules when detached", () => {
		const colors = defineVars({
			phase3Cleanup: "orange",
		})
		const expectedRules = compileVariableGroupRules(
			getVariableGroupMetadata(colors),
		)
		const api = createInMemoryStyleApi()

		expectInjectedRules(api, getVariableGroupMetadata(colors))
		api.detachVariableGroups()
		for (const rule of expectedRules) {
			expect(api.styleRulesRef.current).not.toContain(rule)
		}
	})
})

describe("conditional variable values", () => {
	const DARK = "@media (prefers-color-scheme: dark)"

	it("compiles defaults and at-rule overrides", () => {
		const colors = defineVars({
			accent: "blue",
			text: {
				default: "black",
				[DARK]: "white",
			},
		})
		const metadata = getVariableGroupMetadata(colors)

		expect(compileVariableGroupRules(metadata)).toEqual([
			`:root{${metadata.names.accent}:blue;${metadata.names.text}:black;}`,
			`${DARK}{:root{${metadata.names.text}:white;}}`,
		])
	})

	it("groups multiple tokens that share a condition", () => {
		const colors = defineVars({
			background: {
				default: "white",
				[DARK]: "black",
			},
			text: {
				default: "black",
				[DARK]: "white",
			},
		})
		const metadata = getVariableGroupMetadata(colors)

		expect(compileVariableGroupRules(metadata)).toEqual([
			`:root{${metadata.names.background}:white;${metadata.names.text}:black;}`,
			`${DARK}{:root{${metadata.names.background}:black;${metadata.names.text}:white;}}`,
		])
	})

	it("ignores condition key order when hashing", () => {
		const first = defineVars({
			text: {
				default: "black",
				"@supports (color: color(display-p3 1 1 1))": "red",
				[DARK]: "white",
			},
		})
		const second = defineVars({
			text: {
				[DARK]: "white",
				"@supports (color: color(display-p3 1 1 1))": "red",
				default: "black",
			},
		})

		expect(first.text).toBe(second.text)
		expect(getVariableGroupMetadata(first).groupId).toBe(
			getVariableGroupMetadata(second).groupId,
		)
	})

	it("injects conditional rules through the style api", () => {
		const api = createInMemoryStyleApi()
		const colors = defineVars({
			phase4Conditional: {
				default: "black",
				[DARK]: "white",
			},
		})

		expectInjectedRules(api, getVariableGroupMetadata(colors))
	})
})
