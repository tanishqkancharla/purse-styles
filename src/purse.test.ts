import assert from "assert"
import { expect } from "extendable-expect"
import { describe, it } from "vitest"
import { InMemoryStyleApi, createInMemoryStyleApi, style } from "./purse"

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

	it.skip("Inserts into given style element correctly", () => {})
	it.skip("Works if you pass style rule or object to useStyles", () => {})
	it.skip("Works if you pass multiple style rule or object to useStyles", () => {})
	it.skip("Inserts browser prefixes", () => {})

	it.skip("Inserting two styles with shared style object then removing one", () => {})
	it.skip("Inserting two styles with shared style object then removing both", () => {})
})
