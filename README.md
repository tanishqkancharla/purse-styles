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
	cssProperties: BaseCSSProperties & CSSVarDeclarations,
	deps: DependencyList,
): void

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
}
export declare function createInMemoryStyleApi(): InMemoryStyleApi
```

## TODO

- [ ] E2E tests with Playwright
- [ ] Consider exporting a simple `styled` alternative
