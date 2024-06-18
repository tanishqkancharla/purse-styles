export type CSSVar = `var(--${string})`

export function createCssVar(name: string): CSSVar {
	return `var(--${name})`
}
