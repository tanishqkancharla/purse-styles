# Purse

A basic styling solution for web apps with an emphasis on simplicity and purity. The goal is to build a CSS-in-JS version of Tailwind's classname composition model.

```tsx
// Define styles outside your components
const truncate = style({
	overflow: "hidden",
	lineClamp: 1,
	textOverflow: "ellipsis",
})

// Compose styles together
const actionButton = style(truncate, text[14], fonts.interface, border[1])

// Use pseudo or other complex selectors
const button = style({
	"&:disabled": {
		backgroundColor: indigo.indigo8,
	},
	"&:hover[disabled=false]": {
		backgroundColor: indigo.indigo10,
	},
})

// Use styles in your components dynamically
const buttonClassName = useStyles(
	props.quiet ? quietButtonStyles : buttonStyles,
)

// Can also use CSS properties directly
const blueTextClassName = useStyles({
	backgroundColor: "blue",
})
```

## Setup

```sh
npm i purse-styles
```

Wrap your app in `PurseProvider`:

```tsx
<PurseProvider>
	<App />
</PurseProvider>
```

That's all! No build step.

## Variables

Define typed CSS custom properties with `defineVars`. Defaults are injected on `:root` when a `PurseProvider` is mounted.

```tsx
import { PurseProvider, defineVars, style, useStyles } from "purse-styles"

const DARK = "@media (prefers-color-scheme: dark)"

export const colors = defineVars({
	text: { default: "black", [DARK]: "white" },
	background: { default: "white", [DARK]: "black" },
	accent: "blue",
})

const container = style({
	color: colors.text,
	backgroundColor: colors.background,
	borderColor: colors.accent,
})

function App() {
	const className = useStyles(container)
	return <main className={className}>...</main>
}

;<PurseProvider>
	<App />
</PurseProvider>
```

Notes:

- Token names are generated (`var(--purse-<hash>-<key>)`). Identical definition objects share the same names.
- Keys cannot start with `--`; Purse always generates the custom property name.
- Conditional values use a required `default` plus CSS at-rule keys (`@media`, `@supports`, etc.), same family as nested keys in `style()`.
- Variables are root-level only. There is no `createTheme` / subtree theme API. App-wide non-media modes can still override the generated custom properties with root attributes or `useInjectGlobalStyles`.

## Exports

```ts
// Declare styles outside React component
export declare function style(
	...styleElementsOrCSS: (CSSProperties | StyleElement)[]
): StyleElement

// Use declared styles or ad-hoc styles inside react component and get back a classname
export declare function useStyles(
	...styleElementsOrCSS: (CSSProperties | StyleElement)[]
): string

// Inject global styles into the app, you may want to do this as an escape hatch
export declare function useInjectGlobalStyles(
	selector: string,
	cssProperties: BaseCSSProperties & CustomProperties,
	deps: DependencyList,
): void

// Define a typed variable group; defaults are registered on :root via PurseProvider
export declare function defineVars<
	const T extends Record<string, VariableDefinition>,
>(definitions: T): VariableGroup<T>

// Wrap your app in this so Purse can inject styles into the app
export declare function PurseProvider(props: {
	children?: React.ReactNode
}): React.JSX.Element

// An in-memory style API for testing
export type InMemoryStyleApi = {
	styleRulesRef: {
		current: string[]
	}
	addStyleElement: StyleApi["addStyleElement"]
	addGlobalStyle: StyleApi["addGlobalStyle"]
	detachVariableGroups: () => void
}
export declare function createInMemoryStyleApi(): InMemoryStyleApi
```

## TODO

- [x] E2E tests with Playwright
- [ ] Consider exporting a simple `styled` alternative
