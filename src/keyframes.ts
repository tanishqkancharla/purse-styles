import { compileDeclarations, type Declarations } from "./compileDeclarations"
import { Destructor } from "./destructors"
import { hashObject } from "./hashObject"

export type KeyframeStop = "from" | "to" | `${number}%`

/** Flat declarations only. No nested selectors or at-rules inside a stop. */
export type KeyframesDefinition = {
	[K in KeyframeStop]?: Declarations
}

export type KeyframesName = string & { readonly __keyframes__: unique symbol }

type KeyframesMetadata = {
	name: KeyframesName
	canonicalStops: Record<string, string>
}

export type KeyframesStyleSink = {
	addGlobalStyle: (styleRule: string) => Destructor
}

const registeredKeyframes = new Map<string, KeyframesMetadata>()
const listeners = new Set<(metadata: KeyframesMetadata) => void>()

const PERCENT_STOP = /^-?(?:\d+(?:\.\d+)?|\.\d+)%$/

function isKeyframeStop(key: string): key is KeyframeStop {
	return key === "from" || key === "to" || PERCENT_STOP.test(key)
}

function assertFlatDeclarations(stop: string, declarations: Declarations) {
	for (const [property, value] of Object.entries(declarations)) {
		if (value != null && typeof value === "object") {
			throw new Error(
				`Keyframe stop "${stop}" must contain flat declarations only (nested "${property}" is not allowed).`,
			)
		}
	}
}

function canonicalizeStops(
	definition: KeyframesDefinition,
): Record<string, string> {
	const keys = Object.keys(definition)
	if (keys.length === 0) {
		throw new Error("keyframes() requires at least one stop")
	}

	const canonical: Record<string, string> = {}
	for (const key of keys.sort()) {
		if (!isKeyframeStop(key)) {
			throw new Error(
				`Invalid keyframe stop "${key}". Expected "from", "to", or a percentage such as "50%".`,
			)
		}

		const declarations = definition[key]
		if (declarations == null) {
			continue
		}

		assertFlatDeclarations(key, declarations)
		canonical[key] = compileDeclarations(declarations)
	}

	if (Object.keys(canonical).length === 0) {
		throw new Error("keyframes() requires at least one stop")
	}

	return canonical
}

function compileKeyframesRule(metadata: KeyframesMetadata): string {
	let body = ""
	for (const stop of Object.keys(metadata.canonicalStops)) {
		body += `${stop}{${metadata.canonicalStops[stop]}}`
	}
	return `@keyframes ${metadata.name}{${body}}`
}

function registerKeyframes(metadata: KeyframesMetadata) {
	if (registeredKeyframes.has(metadata.name)) {
		return
	}

	registeredKeyframes.set(metadata.name, metadata)
	for (const listener of listeners) {
		listener(metadata)
	}
}

export function subscribeKeyframes(
	listener: (metadata: KeyframesMetadata) => void,
): Destructor {
	listeners.add(listener)

	for (const metadata of registeredKeyframes.values()) {
		listener(metadata)
	}

	return () => {
		listeners.delete(listener)
	}
}

export function attachKeyframes(styleApi: KeyframesStyleSink): Destructor {
	const inserted = new Map<string, Destructor>()

	function ensure(metadata: KeyframesMetadata) {
		if (inserted.has(metadata.name)) {
			return
		}

		inserted.set(
			metadata.name,
			styleApi.addGlobalStyle(compileKeyframesRule(metadata)),
		)
	}

	const unsubscribe = subscribeKeyframes(ensure)

	return () => {
		unsubscribe()
		for (const destructor of inserted.values()) {
			destructor()
		}
		inserted.clear()
	}
}

export function keyframes(definition: KeyframesDefinition): KeyframesName {
	const canonicalStops = canonicalizeStops(definition)
	const name = `purse-${hashObject(canonicalStops)}` as KeyframesName

	registerKeyframes({ name, canonicalStops })

	return name
}
