import {
	expect,
	type MatcherResult,
	type MatcherState,
} from "vitest"

export type ComputedStyleExpectation = Record<string, string | RegExp>

interface CustomMatchers<R = unknown> {
	toHaveComputedStyle(expected: ComputedStyleExpectation): R
}

declare module "vitest" {
	interface Matchers<T = any> extends CustomMatchers<T> {}
}

function toCssPropertyName(property: string): string {
	if (property.startsWith("--")) {
		return property
	}

	return property.replace(
		/[A-Z]/g,
		(character) => `-${character.toLowerCase()}`,
	)
}

function toHaveComputedStyle(
	this: MatcherState,
	received: unknown,
	expected: ComputedStyleExpectation,
): MatcherResult {
	if (!(received instanceof Element)) {
		return {
			pass: false,
			message: () =>
				`expected ${this.utils.printReceived(received)} to be an element`,
		}
	}

	const computedStyle = getComputedStyle(received)
	const actual: Record<string, string> = {}
	const failedProperties: string[] = []

	for (const [property, expectedValue] of Object.entries(expected)) {
		const value = computedStyle
			.getPropertyValue(toCssPropertyName(property))
			.trim()
		actual[property] = value

		const matches =
			expectedValue instanceof RegExp
				? new RegExp(expectedValue).test(value)
				: value === expectedValue

		if (!matches) {
			failedProperties.push(property)
		}
	}

	const pass = failedProperties.length === 0

	return {
		pass,
		actual,
		expected,
		message: () => {
			const assertion = this.isNot ? "not to have" : "to have"
			const details = failedProperties
				.map(
					(property) =>
						`${property}: expected ${this.utils.printExpected(
							expected[property],
						)}, received ${this.utils.printReceived(actual[property])}`,
				)
				.join("\n")

			return [
				`expected element ${assertion} computed styles`,
				details,
			]
				.filter(Boolean)
				.join("\n")
		},
	}
}

expect.extend({ toHaveComputedStyle })
