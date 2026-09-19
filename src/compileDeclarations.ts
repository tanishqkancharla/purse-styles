import { entries } from "lodash-es"
import CSS from "csstype"
import { hyphenateStyleName } from "./hyphenateStyleName"

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

export type BaseCSSProperties = CSS.Properties<number | string, string & {}>

export type CustomProperties = {
	[name: `--${string}`]: string | number | undefined
}

export type Declarations = BaseCSSProperties & CustomProperties

function isCustomProperty(name: string): name is `--${string}` {
	return name.startsWith("--")
}

export function compileDeclarations(declarations: Declarations) {
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
