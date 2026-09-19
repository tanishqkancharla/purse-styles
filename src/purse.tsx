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
import { attachVariableGroups } from "./cssVar"
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

const VENDOR_PREFIXES = ["-webkit-", "-moz-", "-ms-", "-o-"] as const

/** True when a numeric value should compile without an implicit `px` suffix. */
function isUnitlessNumberProperty(kebabProperty: string): boolean {
	if (UNITLESS_NUMBER_PROPS.includes(kebabProperty)) {
		return true
	}

	for (const prefix of VENDOR_PREFIXES) {
		if (!kebabProperty.startsWith(prefix)) continue
		const unprefixed = kebabProperty.slice(prefix.length)
		if (UNITLESS_NUMBER_PROPS.includes(unprefixed)) {
			return true
		}
	}

	return false
}

type BaseCSSProperties = CSS.Properties<number | string, string & {}>

type CustomProperties = {
	[name: `--${string}`]: string | number | undefined
}

type Declarations = BaseCSSProperties & CustomProperties

const WRAPPING_AT_RULES = [
	"@media",
	"@supports",
	"@container",
	"@layer",
	"@scope",
] as const

type WrappingAtRule = (typeof WRAPPING_AT_RULES)[number]

type WrappingAtRuleKey = `${WrappingAtRule}${string}`

type NestedRuleKey =
	| `&${CSS.SimplePseudos}`
	| WrappingAtRuleKey
	| `.${string}`
	| `&${string}`

const WRAPPING_AT_RULE_SET: Set<string> = new Set(WRAPPING_AT_RULES)

export type CSSProperties = {
	[Key in keyof BaseCSSProperties]?: BaseCSSProperties[Key]
} & CustomProperties & {
	[Key in NestedRuleKey]?: CSSProperties
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

function isStyleElement(o: unknown): o is StyleElement {
	return (
		o != null &&
		typeof o === "object" &&
		"__style__" in o &&
		o["__style__"] === __style__
	)
}

const DEV = process.env.NODE_ENV === "development"

export type InMemoryStyleApi = {
	styleRulesRef: { current: string[] }
	addStyleElement: StyleApi["addStyleElement"]
	addGlobalStyle: StyleApi["addGlobalStyle"]
	detachVariableGroups: Destructor
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

	const styleApi = {
		addStyleElement,
		addGlobalStyle: addStyleRule,
	}

	return {
		...styleApi,
		detachVariableGroups: attachVariableGroups(styleApi),
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

	useInsertionEffect(() => attachVariableGroups(styleApi), [styleApi])

	return (
		<PurseContext.Provider value={styleApi}>
			{props.children}
		</PurseContext.Provider>
	)
}

function isCustomProperty(name: string): name is `--${string}` {
	return name.startsWith("--")
}

function compileDeclarations(declarations: Declarations) {
	// return entries(prefix(declarations))
	return entries(declarations)
		.map(([name, value]) => {
			if (value === undefined || value === null) {
				return ""
			}

			const property = isCustomProperty(name)
				? name
				: hyphenateStyleName(name)
			const needToAddPixelsUnit =
				typeof value === "number" &&
				!isCustomProperty(name) &&
				!isUnitlessNumberProperty(property)

			if (needToAddPixelsUnit) {
				return `${property}:${value}px;`
			} else {
				return `${property}:${value};`
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

function atRuleName(key: string): string | undefined {
	return key.match(/^@[a-z-]+/i)?.[0]?.toLowerCase()
}

function assertWrappingAtRuleKey(key: string): void {
	const name = atRuleName(key)
	if (name !== undefined && WRAPPING_AT_RULE_SET.has(name)) {
		return
	}

	throw new Error(
		`At-rule "${name ?? key}" cannot be nested in style objects. Only wrapping at-rules are supported: ${WRAPPING_AT_RULES.join(", ")}.`,
	)
}

function mergeCSSProperties(...groups: CSSProperties[]): CSSProperties {
	const merged: CSSProperties = {}

	for (const group of groups) {
		for (const _propertyOrSelector in group) {
			const propertyOrSelector = _propertyOrSelector as keyof typeof group
			const incoming = group[propertyOrSelector]
			const isNestedRule = isObject(incoming)

			if (isNestedRule) {
				const selector = propertyOrSelector as NestedRuleKey
				const existingStyles = merged[selector]

				merged[selector] = isObject(existingStyles)
					? mergeCSSProperties(
							existingStyles as CSSProperties,
							incoming as CSSProperties,
						)
					: mergeCSSProperties(incoming as CSSProperties)
			} else {
				;(merged as any)[propertyOrSelector] = incoming
			}
		}
	}

	return merged
}

function makeGroupKey(atRules: string[], selector: string): string {
	if (atRules.length === 0) {
		return selector
	}
	if (selector === "") {
		return atRules.join("|")
	}
	return `${atRules.join("|")}|${selector}`
}

function parseGroupKey(group: string): {
	atRules: string[]
	selector: string
} {
	if (group === "") {
		return { atRules: [], selector: "" }
	}

	const parts = group.split("|")
	const atRules: string[] = []
	let selector = ""

	for (const part of parts) {
		if (part.startsWith("@")) {
			atRules.push(part)
		} else {
			selector = part
		}
	}

	return { atRules, selector }
}

function composeSelector(parentSelector: string, nestedKey: string): string {
	if (parentSelector === "") {
		return nestedKey
	}
	if (nestedKey.includes("&")) {
		return nestedKey.replace(/&/g, parentSelector)
	}
	return nestedKey
}

function flattenCSSProperties(
	properties: CSSProperties,
	atRules: string[] = [],
	selector: string = "",
	groups: Record<string, Declarations> = {},
): Record<string, Declarations> {
	const declarations: Declarations = {}
	const nestedRules: [string, CSSProperties][] = []

	for (const _propertyOrSelector in properties) {
		const propertyOrSelector = _propertyOrSelector as keyof typeof properties
		const value = properties[propertyOrSelector]
		if (value === undefined || value === null) continue

		if (isObject(value)) {
			nestedRules.push([_propertyOrSelector, value as CSSProperties])
		} else {
			;(declarations as any)[propertyOrSelector] = value
		}
	}

	if (!isObjectEmpty(declarations)) {
		const groupKey = makeGroupKey(atRules, selector)
		const existing = groups[groupKey]
		if (existing) {
			Object.assign(existing, declarations)
		} else {
			groups[groupKey] = declarations
		}
	}

	for (const [key, nested] of nestedRules) {
		if (key.startsWith("@")) {
			assertWrappingAtRuleKey(key)
			flattenCSSProperties(nested, [...atRules, key], selector, groups)
		} else {
			flattenCSSProperties(
				nested,
				atRules,
				composeSelector(selector, key),
				groups,
			)
		}
	}

	return groups
}

function rulesFromCompiledGroups(
	compiledStyleDeclarationsByGroup: Record<string, string>,
	targetSelector: string,
): StyleRule[] {
	return entries(compiledStyleDeclarationsByGroup).map(([group, styles]) => {
		const { atRules, selector } = parseGroupKey(group)
		const resolvedSelector =
			selector === ""
				? targetSelector
				: selector.replace(/&/g, targetSelector)

		let rule = `${resolvedSelector}{${styles}}`
		for (let i = atRules.length - 1; i >= 0; i--) {
			rule = `${atRules[i]}{${rule}}`
		}
		return rule
	})
}

function compileStyleDeclarationGroups(
	properties: CSSProperties,
): Record<string, string> | undefined {
	if (isObjectEmpty(properties)) {
		return undefined
	}

	return mapValues(flattenCSSProperties(properties), (declarations) =>
		compileDeclarations(declarations ?? {}),
	)
}

function compileCSSPropertiesToRules(
	properties: CSSProperties,
	targetSelector: string,
): StyleRule[] {
	const compiledStyleDeclarationsByGroup =
		compileStyleDeclarationGroups(properties)
	if (!compiledStyleDeclarationsByGroup) {
		return []
	}

	return rulesFromCompiledGroups(
		compiledStyleDeclarationsByGroup,
		targetSelector,
	)
}

function compileCSS(properties: CSSProperties): StyleElement["owned"] {
	const compiledStyleDeclarationsByGroup =
		compileStyleDeclarationGroups(properties)
	if (!compiledStyleDeclarationsByGroup) {
		return undefined
	}

	const className = hashObject(compiledStyleDeclarationsByGroup)
	const styleRules = rulesFromCompiledGroups(
		compiledStyleDeclarationsByGroup,
		`.${className}`,
	)

	return { styleRules, className }
}

/** Compile a style object against a selector (same nesting rules as `style()`). */
export function compileGlobalStyleRules(
	selector: string,
	cssProperties: CSSProperties,
): StyleRule[] {
	return compileCSSPropertiesToRules(cssProperties, selector)
}

export type StyleArgument = CSSProperties | StyleElement | false | null | undefined

export function style(...styleElementsOrCSS: StyleArgument[]): StyleElement {
	let composed: StyleElement[] = []
	let cssPropertyGroups: CSSProperties[] = []

	for (const styleElementOrCSS of styleElementsOrCSS) {
		if (styleElementOrCSS == null || styleElementOrCSS === false) {
			continue
		}

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
	cssProperties: CSSProperties,
	deps: DependencyList,
) {
	const styleApi = useRequiredContext(PurseContext)

	useLayoutEffect(() => {
		const styleRules = compileGlobalStyleRules(selector, cssProperties)
		const destructor = joinDestructors(
			styleRules.map((styleRule) => styleApi.addGlobalStyle(styleRule)),
		)

		return destructor
	}, deps)
}

export function useStyles(...styleElementsOrCSS: StyleArgument[]): string {
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
