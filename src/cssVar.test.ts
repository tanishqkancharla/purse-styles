import assert from "assert"
import { describe, expect, expectTypeOf, it } from "vitest"
import {
	CSSVar,
	compileVariableGroupRule,
	defineVars,
	getVariableGroupMetadata,
} from "./cssVar"
import { createInMemoryStyleApi, style } from "./purse"

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

		expect(compileVariableGroupRule(metadata)).toBe(
			`:root{${metadata.names.accent}:blue;${metadata.names.space}:2;${metadata.names.text}:black;}`,
		)
	})

	it("injects already-registered groups when a style api attaches", () => {
		const colors = defineVars({
			phase3Existing: "navy",
		})
		const expectedRule = compileVariableGroupRule(
			getVariableGroupMetadata(colors),
		)

		const api = createInMemoryStyleApi()
		expect(api.styleRulesRef.current).toContain(expectedRule)
	})

	it("injects groups registered after a style api attaches", () => {
		const api = createInMemoryStyleApi()
		const colors = defineVars({
			phase3Late: "teal",
		})
		const expectedRule = compileVariableGroupRule(
			getVariableGroupMetadata(colors),
		)

		expect(api.styleRulesRef.current).toContain(expectedRule)
	})

	it("deduplicates identical variable groups into one root rule", () => {
		const api = createInMemoryStyleApi()
		const first = defineVars({
			phase3Deduped: "purple",
		})
		defineVars({
			phase3Deduped: "purple",
		})

		const expectedRule = compileVariableGroupRule(
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
		const expectedRule = compileVariableGroupRule(
			getVariableGroupMetadata(colors),
		)
		const api = createInMemoryStyleApi()

		expect(api.styleRulesRef.current).toContain(expectedRule)
		api.detachVariableGroups()
		expect(api.styleRulesRef.current).not.toContain(expectedRule)
	})
})
