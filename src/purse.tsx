import CSS from "csstype"
import { entries, isObject, mapValues } from "lodash-es"
import React, {
	DependencyList,
	createContext,
	useInsertionEffect,
	useLayoutEffect,
	useMemo,
} from "react"
import { clsx } from "./clsx"
import { CSSVar } from "./cssVar"
import { Destructor, joinDestructors } from "./destructors"
import { hashObject } from "./hashObject"
import { hyphenateStyleName } from "./hyphenateStyleName"
import { useRequiredContext } from "./useRequiredContext"

const UNITLESS_NUMBER_PROPS = [
	"animation-iteration-count",
	"border-image-outset",
	"border-image-slice",
	"border-image-width",
	"box-flex",
	"box-flex-group",
	"box-ordinal-group",
	"column-count",
	"columns",
	"flex",
	"flex-grow",
	"flex-positive",
	"flex-shrink",
	"flex-negative",
	"flex-order",
	"grid-row",
	"grid-row-end",
	"grid-row-span",
	"grid-row-start",
	"grid-column",
	"grid-column-end",
	"grid-column-span",
	"grid-column-start",
	"font-weight",
	"line-clamp",
	"line-height",
	"opacity",
	"order",
	"orphans",
	"tabSize",
	"widows",
	"z-index",
	"zoom",

	// SVG-related properties
	"fill-opacity",
	"flood-opacity",
	"stop-opacity",
	"stroke-dasharray",
	"stroke-dashoffset",
	"stroke-miterlimit",
	"stroke-opacity",
	"stroke-width",
]

type BaseCSSProperties = CSS.Properties<number | string, string & {}>
type CSSVarDeclarations = Record<CSSVar, string>

type NestedRuleKey =
	| `&${CSS.SimplePseudos}`
	| `${CSS.AtRules}${string}`
	| `.${string}`
	| `&${string}`

export type CSSProperties = {
	[Key in keyof BaseCSSProperties]?: BaseCSSProperties[Key]
} & {
	[Key in NestedRuleKey]?: BaseCSSProperties
}

const PurseContext = createContext<StyleApi | undefined>(undefined)

export type StyleApi = {
	addStyleElement: (styleElement: StyleElement) => Destructor
	addGlobalStyle: (styleRule: string) => Destructor
}

const __style__ = Symbol("style-element")

type StyleRule = string

export type StyleElement = {
	__style__: typeof __style__
	composed: StyleElement[]
	owned?: {
		styleRules: StyleRule[]
		className: string
	}
	className: string
}

function isStyleElement(o: any): o is StyleElement {
	return "__style__" in o && o["__style__"] === __style__
}

const DEV = process.env.NODE_ENV === "development"

export type InMemoryStyleApi = {
	styleRulesRef: { current: string[] }
	addStyleElement: StyleApi["addStyleElement"]
	addGlobalStyle: StyleApi["addGlobalStyle"]
}

export function createInMemoryStyleApi(): InMemoryStyleApi {
	let styleRules: string[] = []

	type InsertedStyleElement = {
		refCount: number
		destructor: Destructor
	}

	const insertedStyleElementClassNames = new Map<string, InsertedStyleElement>()

	function addStyleRule(rule: StyleRule): Destructor {
		styleRules.push(rule)

		return () => {
			const ruleToRemove = rule
			styleRules = styleRules.filter((rule) => rule !== ruleToRemove)
		}
	}

	function removeStyleElement(styleElement: StyleElement) {
		for (const composed of styleElement.composed) {
			removeStyleElement(composed)
		}

		if (styleElement.owned) {
			const { className } = styleElement.owned

			const maybeInsertedStyleElement =
				insertedStyleElementClassNames.get(className)
			if (!maybeInsertedStyleElement) return

			const { refCount, destructor } = maybeInsertedStyleElement
			const newRefCount = refCount - 1

			if (newRefCount <= 0) {
				insertedStyleElementClassNames.delete(className)
				destructor()
			} else {
				insertedStyleElementClassNames.set(className, {
					refCount: newRefCount,
					destructor,
				})
			}
		}
	}

	function addStyleElement(styleElement: StyleElement): Destructor {
		for (const composed of styleElement.composed) {
			addStyleElement(composed)
		}

		if (styleElement.owned) {
			const { className, styleRules } = styleElement.owned
			const maybeInsertedStyleElement =
				insertedStyleElementClassNames.get(className)

			if (maybeInsertedStyleElement) {
				const { destructor, refCount } = maybeInsertedStyleElement
				insertedStyleElementClassNames.set(className, {
					destructor,
					refCount: refCount + 1,
				})
			} else {
				const destructors: Destructor[] = styleRules.map(addStyleRule)
				const destructor = joinDestructors(destructors)

				insertedStyleElementClassNames.set(className, {
					destructor,
					refCount: 1,
				})
			}
		}

		return () => removeStyleElement(styleElement)
	}

	return {
		addStyleElement,
		addGlobalStyle: addStyleRule,
		styleRulesRef: {
			get current() {
				return styleRules
			},
		},
	}
}

export function PurseProvider(props: { children?: React.ReactNode }) {
	const htmlStyleElement = useMemo(() => document.createElement("style"), [])
	const atRuleHtmlStyleElement = useMemo(
		() => document.createElement("style"),
		[],
	)

	useInsertionEffect(() => {
		document.head.appendChild(htmlStyleElement)
		document.head.appendChild(atRuleHtmlStyleElement)

		return () => {
			document.head.removeChild(htmlStyleElement)
			document.head.removeChild(atRuleHtmlStyleElement)
		}
	}, [htmlStyleElement, atRuleHtmlStyleElement])

	const styleApi: StyleApi = useMemo(() => {
		type InsertedStyleElement = {
			refCount: number
			destructor: Destructor
		}

		const insertedStyleElementClassNames = new Map<
			string,
			InsertedStyleElement
		>()

		function addStyleRule(rule: StyleRule): Destructor {
			const styleSheet = htmlStyleElement.sheet
			if (!styleSheet)
				throw new Error(`Could not get style sheet of style element`)

			try {
				// TODO: do these in dev
				// styleSheet.insertRule(styleRule, insertPosition)

				const isAtRule = rule.startsWith("@")
				const styleText = new Text(rule)

				if (isAtRule) {
					// atRuleStyleElement.sheet?.insertRule(rule)

					// We add as Text here because otherwise, the styles don't show up in chrome dev tools
					atRuleHtmlStyleElement.appendChild(styleText)

					return () => atRuleHtmlStyleElement.removeChild(styleText)
				} else {
					// styleSheet?.insertRule(rule)
					htmlStyleElement.appendChild(styleText)

					return () => {
						htmlStyleElement.removeChild(styleText)
					}
				}
			} catch (error) {
				if (DEV) {
					throw new Error(`Could not add style rule ${rule}`)
				} else {
					console.warn(`Could not add style rule ${rule}`)
					return () => {}
				}
			}
		}

		function removeStyleElement(styleElement: StyleElement) {
			for (const composed of styleElement.composed) {
				removeStyleElement(composed)
			}

			if (styleElement.owned) {
				const { className } = styleElement.owned

				const maybeInsertedStyleElement =
					insertedStyleElementClassNames.get(className)
				if (!maybeInsertedStyleElement) return

				const { refCount, destructor } = maybeInsertedStyleElement
				const newRefCount = refCount - 1

				if (newRefCount <= 0) {
					insertedStyleElementClassNames.delete(className)
					destructor()
				} else {
					insertedStyleElementClassNames.set(className, {
						refCount: newRefCount,
						destructor,
					})
				}
			}
		}

		function addStyleElement(styleElement: StyleElement): Destructor {
			for (const composed of styleElement.composed) {
				addStyleElement(composed)
			}

			if (styleElement.owned) {
				const { className, styleRules } = styleElement.owned
				const maybeInsertedStyleElement =
					insertedStyleElementClassNames.get(className)

				if (maybeInsertedStyleElement) {
					const { destructor, refCount } = maybeInsertedStyleElement
					insertedStyleElementClassNames.set(className, {
						destructor,
						refCount: refCount + 1,
					})
				} else {
					const destructors: Destructor[] = styleRules.map(addStyleRule)
					const destructor = joinDestructors(destructors)

					insertedStyleElementClassNames.set(className, {
						destructor,
						refCount: 1,
					})
				}
			}

			return () => removeStyleElement(styleElement)
		}

		return { addStyleElement, addGlobalStyle: addStyleRule }
	}, [])

	return (
		<PurseContext.Provider value={styleApi}>
			{props.children}
		</PurseContext.Provider>
	)
}

function compileDeclarations(declarations: BaseCSSProperties) {
	// return entries(prefix(declarations))
	return entries(declarations)
		.map(([camelCaseProperty, value]) => {
			const kebabProperty = hyphenateStyleName(camelCaseProperty)
			const needToAddPixelsUnit =
				typeof value === "number" &&
				!UNITLESS_NUMBER_PROPS.includes(kebabProperty)

			if (needToAddPixelsUnit) {
				return `${kebabProperty}:${value}px;`
			} else {
				return `${kebabProperty}:${value};`
			}
		})
		.join("")
}

function groupEntriesBy<K extends string | number | symbol, V>(
	obj: Record<K, V>,
	predicate: (key: K, value: V) => string,
): Record<string, Record<K, V>> {
	const groupedEntries: Record<string, any> = {}

	for (const key in obj) {
		const value = obj[key]
		const group = predicate(key, value)

		if (group in groupedEntries) {
			groupedEntries[group][key] = value
		} else {
			groupedEntries[group] = { [key]: value }
		}
	}

	return groupedEntries
}

function isObjectEmpty(obj: {}): boolean {
	return Object.keys(obj).length === 0
}

type CSSPropertiesGroup = {
	"": BaseCSSProperties
} & {
	[Key in NestedRuleKey]?: BaseCSSProperties
}

function mergeCSSProperties(...groups: CSSProperties[]): CSSProperties {
	const merged: CSSProperties = {}

	for (const group of groups) {
		for (const _propertyOrSelector in group) {
			const propertyOrSelector = _propertyOrSelector as keyof typeof group
			const isNestedRule = isObject(group[propertyOrSelector])

			if (isNestedRule) {
				// Type-casting to a key that only has nested rules
				const selector = propertyOrSelector as NestedRuleKey
				const existingStyles = merged[selector] || {}

				merged[selector] = {
					...existingStyles,
					...group[selector],
				}
			} else {
				const property = propertyOrSelector as keyof BaseCSSProperties

				;(merged as any)[property] = group[property]
			}
		}
	}

	return merged
}

function groupCSSProperties(properties: CSSProperties): CSSPropertiesGroup {
	const styleDeclarationsBySelector: Record<string, any> = { "": {} }

	for (const _propertyOrSelector in properties) {
		const propertyOrSelector = _propertyOrSelector as keyof typeof properties
		const value = properties[propertyOrSelector]
		if (value === undefined || value === null) continue
		const isNestedRule = isObject(value)

		if (isNestedRule) {
			// Type-casting to a key that only has nested rules
			const selector = propertyOrSelector as `&:${CSS.SimplePseudos}`
			const existingStyles = styleDeclarationsBySelector[selector] || {}

			styleDeclarationsBySelector[selector] = {
				...existingStyles,
				...properties[selector],
			}
		} else {
			const property = propertyOrSelector as keyof BaseCSSProperties
			const value = (properties as any)[property]

			styleDeclarationsBySelector[""][property] = value
		}
	}

	for (const selector in styleDeclarationsBySelector) {
		const declarations = styleDeclarationsBySelector[selector]
		if (declarations && isObjectEmpty(declarations)) {
			delete styleDeclarationsBySelector[selector]
		}
	}

	return styleDeclarationsBySelector as CSSPropertiesGroup
}

function compileCSS(properties: CSSProperties): StyleElement["owned"] {
	if (isObjectEmpty(properties)) {
		return undefined
	}

	const groupedCSSProperties = groupCSSProperties(properties)

	const compiledStyleDeclarationsByGroup = mapValues(
		groupedCSSProperties,
		compileDeclarations,
	)

	const className = hashObject(compiledStyleDeclarationsByGroup)
	const styleRules: StyleRule[] = entries(compiledStyleDeclarationsByGroup).map(
		([group, styles]) => {
			if (group === "") {
				// Base group
				return `.${className}{${styles}}`
			} else if (group.startsWith("@")) {
				// At rules
				return `${group}{.${className}{${styles}}}`
			} else {
				// Nested Rules
				const selector = group.replace(/&/g, `.${className}`)
				return `${selector}{${styles}}`
			}
		},
	)

	return { styleRules, className }
}

export function style(
	...styleElementsOrCSS: (CSSProperties | StyleElement)[]
): StyleElement {
	let composed: StyleElement[] = []
	let cssPropertyGroups: CSSProperties[] = []

	for (const styleElementOrCSS of styleElementsOrCSS) {
		if (isStyleElement(styleElementOrCSS)) {
			composed.push(styleElementOrCSS)
		} else {
			cssPropertyGroups.push(styleElementOrCSS)
		}
	}

	const cssProperties = mergeCSSProperties(...cssPropertyGroups)
	const owned = compileCSS(cssProperties)

	const composedClassNames = composed.map((composed) => composed.className)
	const className = clsx(...composedClassNames, owned?.className)

	return {
		__style__,
		composed,
		className,
		owned,
	}
}

function styleElementToRules({ owned, composed }: StyleElement): StyleRule[] {
	const styleRules = composed.flatMap(styleElementToRules)
	if (owned) styleRules.push(...owned.styleRules)
	return styleRules
}

export function useInjectGlobalStyles(
	selector: string,
	cssProperties: BaseCSSProperties & CSSVarDeclarations,
	deps: DependencyList,
) {
	const styleApi = useRequiredContext(PurseContext)

	useLayoutEffect(() => {
		const styleRule = `${selector}{${compileDeclarations(cssProperties)}}`
		const destructor = styleApi.addGlobalStyle(styleRule)

		return destructor
	}, deps)
}

export function useStyles(
	...styleElementsOrCSS: (CSSProperties | StyleElement)[]
): string {
	const styleApi = useRequiredContext(PurseContext)

	// let composed: StyleElement[] = []
	// let cssPropertyGroups: CSSProperties[] = []

	// for (const styleElementOrCSS of styleElementsOrCSS) {
	// 	if (isStyleElement(styleElementOrCSS)) {
	// 		composed.push(styleElementOrCSS)
	// 	} else {
	// 		cssPropertyGroups.push(styleElementOrCSS)
	// 	}
	// }

	// const cssProperties = mergeCSSProperties(...cssPropertyGroups)

	// Will want to memo this somehow at some point but its a little tricky
	const styleElement = style(...styleElementsOrCSS)

	useLayoutEffect(() => {
		if (styleElement.className === "bpsHRa jwfJGj") {
			console.log(styleElement)
		}
		const destructor = styleApi.addStyleElement(styleElement)
		// Dep is class name because its hashed
		return destructor
	}, [styleElement.className])

	// const memoedCSS = useMemoShallowEqual(cssProperties)

	// const ownedStyleElement = useMemo(() => {
	// 	return isObjectEmpty(memoedCSS) ? undefined : style(memoedCSS)
	// }, [memoedCSS])

	// useLayoutEffect(() => {
	// 	for (const styleElement of styleElementsOrCSS.filter(isStyleElement)) {
	// 		styleApi.addStyleElement(styleElement)
	// 	}

	// 	if (ownedStyleElement) {
	// 		styleApi.addStyleElement(ownedStyleElement)
	// 	}
	// }, [ownedStyleElement])

	// if (ownedStyleElement) {
	// 	return composedClassName + " " + ownedStyleElement.className
	// } else {
	// 	return composedClassName
	// }

	return styleElement.className
}
