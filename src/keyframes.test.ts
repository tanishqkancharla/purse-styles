import assert from "assert"
import { describe, expect, expectTypeOf, it } from "vitest"
import { defineVars } from "./cssVar"
import {
	KeyframesName,
	keyframes,
} from "./keyframes"
import { createInMemoryStyleApi, style } from "./purse"

describe("keyframes", () => {
	it("returns a branded animation name", () => {
		const fadeIn = keyframes({
			from: { opacity: 0 },
			to: { opacity: 1 },
		})

		expectTypeOf(fadeIn).toEqualTypeOf<KeyframesName>()
		expect(fadeIn).toMatch(/^purse-[A-Za-z]+$/)
	})

	it("generates deterministic names for the same definitions", () => {
		const first = keyframes({
			from: { opacity: 0 },
			to: { opacity: 1 },
		})
		const second = keyframes({
			from: { opacity: 0 },
			to: { opacity: 1 },
		})

		expect(first).toBe(second)
	})

	it("ignores stop key insertion order when hashing", () => {
		const first = keyframes({
			from: { opacity: 0 },
			to: { opacity: 1 },
		})
		const second = keyframes({
			to: { opacity: 1 },
			from: { opacity: 0 },
		})

		expect(first).toBe(second)
	})

	it("does not rewrite from/to to 0%/100%", () => {
		const fromTo = keyframes({
			from: { opacity: 0 },
			to: { opacity: 1 },
		})
		const percents = keyframes({
			"0%": { opacity: 0 },
			"100%": { opacity: 1 },
		})

		expect(fromTo).not.toBe(percents)

		const api = createInMemoryStyleApi()
		expect(api.styleRulesRef.current).toContain(
			`@keyframes ${fromTo}{from{opacity:0;}to{opacity:1;}}`,
		)
		expect(api.styleRulesRef.current).toContain(
			`@keyframes ${percents}{0%{opacity:0;}100%{opacity:1;}}`,
		)
	})

	it("throws on empty definitions", () => {
		expect(() => keyframes({})).toThrow(/at least one stop/)
	})

	it("throws on invalid stop keys", () => {
		expect(() =>
			keyframes({
				// @ts-expect-error invalid stop key
				"50": { opacity: 1 },
			}),
		).toThrow(/Invalid keyframe stop/)
	})

	it("throws on nested objects inside a stop", () => {
		expect(() =>
			keyframes({
				from: {
					// @ts-expect-error nested objects are not declarations
					"&:hover": { opacity: 1 },
				},
			}),
		).toThrow(/flat declarations only/)
	})

	it("allows a single stop", () => {
		const fadeTo = keyframes({
			to: { opacity: 1 },
		})

		const api = createInMemoryStyleApi()
		expect(api.styleRulesRef.current).toContain(
			`@keyframes ${fadeTo}{to{opacity:1;}}`,
		)
	})

	it("compiles numeric values with the same px / unitless rules as style()", () => {
		const move = keyframes({
			from: { opacity: 0, margin: 8 },
			to: { opacity: 1, margin: 16 },
		})

		const api = createInMemoryStyleApi()
		expect(api.styleRulesRef.current).toContain(
			`@keyframes ${move}{from{opacity:0;margin:8px;}to{opacity:1;margin:16px;}}`,
		)
	})
})

describe("keyframes injection", () => {
	it("emits unused keyframes when a style api attaches", () => {
		const fadeIn = keyframes({
			from: { opacity: 0 },
			to: { opacity: 1 },
		})
		const api = createInMemoryStyleApi()

		expect(api.styleRulesRef.current).toContain(
			`@keyframes ${fadeIn}{from{opacity:0;}to{opacity:1;}}`,
		)
	})

	it("injects already-registered keyframes when a style api attaches", () => {
		const existing = keyframes({
			from: { transform: "rotate(0deg)" },
			to: { transform: "rotate(360deg)" },
		})

		const api = createInMemoryStyleApi()
		expect(api.styleRulesRef.current).toContain(
			`@keyframes ${existing}{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}`,
		)
	})

	it("injects keyframes registered after a style api attaches", () => {
		const api = createInMemoryStyleApi()
		const late = keyframes({
			from: { color: "red" },
			to: { color: "blue" },
		})

		expect(api.styleRulesRef.current).toContain(
			`@keyframes ${late}{from{color:red;}to{color:blue;}}`,
		)
	})

	it("deduplicates identical keyframes into one rule", () => {
		const api = createInMemoryStyleApi()
		const first = keyframes({
			from: { letterSpacing: 1 },
			to: { letterSpacing: 2 },
		})
		keyframes({
			from: { letterSpacing: 1 },
			to: { letterSpacing: 2 },
		})

		const expected = `@keyframes ${first}{from{letter-spacing:1px;}to{letter-spacing:2px;}}`
		expect(
			api.styleRulesRef.current.filter((rule) => rule === expected),
		).toHaveLength(1)
	})

	it("removes injected keyframe rules when detached", () => {
		const pulse = keyframes({
			from: { opacity: 0.6 },
			to: { opacity: 1 },
		})
		const expected = `@keyframes ${pulse}{from{opacity:0.6;}to{opacity:1;}}`
		const api = createInMemoryStyleApi()

		expect(api.styleRulesRef.current).toContain(expected)
		api.detachKeyframes()
		expect(api.styleRulesRef.current).not.toContain(expected)
	})

	it("inlines the name from style({ animationName })", () => {
		const fadeIn = keyframes({
			from: { opacity: 0 },
			to: { opacity: 1 },
		})
		const api = createInMemoryStyleApi()
		const el = style({
			animationName: fadeIn,
			animationDuration: "200ms",
		})
		api.addStyleElement(el)

		assert(el.owned !== undefined)
		expect(el.owned.styleRules).toContain(
			`.${el.className}{animation-name:${fadeIn};animation-duration:200ms;}`,
		)
		expect(api.styleRulesRef.current).toContain(
			`.${el.className}{animation-name:${fadeIn};animation-duration:200ms;}`,
		)
	})

	it("can be interpolated into the animation shorthand", () => {
		const fadeIn = keyframes({
			from: { opacity: 0 },
			to: { opacity: 1 },
		})
		const spin = keyframes({
			from: { transform: "rotate(0deg)" },
			to: { transform: "rotate(360deg)" },
		})
		const el = style({
			animation: `${fadeIn} 200ms ease-out, ${spin} 1s linear infinite`,
		})

		assert(el.owned !== undefined)
		expect(el.owned.styleRules).toContain(
			`.${el.className}{animation:${fadeIn} 200ms ease-out, ${spin} 1s linear infinite;}`,
		)
	})

	it("compiles defineVars tokens inside stops", () => {
		const colors = defineVars({
			keyframesToken: "black",
		})
		const pulse = keyframes({
			from: { color: colors.keyframesToken, opacity: 0.6 },
			to: { color: colors.keyframesToken, opacity: 1 },
		})

		const api = createInMemoryStyleApi()
		expect(api.styleRulesRef.current).toContain(
			`@keyframes ${pulse}{from{color:${colors.keyframesToken};opacity:0.6;}to{color:${colors.keyframesToken};opacity:1;}}`,
		)
	})
})
