import { Destructor } from "./destructors"
import { hashObject } from "./hashObject"

export type CSSVar = `var(--${string})`

export type VariablePrimitive = string | number

type ScalarDefinitions = Record<string, VariablePrimitive>

export type VariableGroupMetadata = {
	groupId: string
	definitions: ScalarDefinitions
	names: Record<string, `--${string}`>
}

export type VariableGroup<T extends ScalarDefinitions> = {
	readonly [K in keyof T]: CSSVar
}

export type AnyVariableGroup = VariableGroup<ScalarDefinitions>

export type VariableStyleSink = {
	addGlobalStyle: (styleRule: string) => Destructor
}

const VARIABLE_GROUP_META = Symbol("purse.variableGroup")

type VariableGroupWithMeta<T extends ScalarDefinitions> = VariableGroup<T> & {
	readonly [VARIABLE_GROUP_META]: VariableGroupMetadata
}

const registeredGroups = new Map<string, VariableGroupMetadata>()
const listeners = new Set<(metadata: VariableGroupMetadata) => void>()

function canonicalizeDefinitions(
	definitions: ScalarDefinitions,
): ScalarDefinitions {
	const canonical: ScalarDefinitions = {}
	for (const key of Object.keys(definitions).sort()) {
		canonical[key] = definitions[key]
	}
	return canonical
}

function assertValidTokenKeys(definitions: ScalarDefinitions) {
	for (const key of Object.keys(definitions)) {
		if (key.startsWith("--")) {
			throw new Error(
				`defineVars keys cannot start with "--" (received "${key}"). Purse generates custom property names automatically.`,
			)
		}
	}
}

function registerVariableGroup(metadata: VariableGroupMetadata) {
	if (registeredGroups.has(metadata.groupId)) {
		return
	}

	registeredGroups.set(metadata.groupId, metadata)
	for (const listener of listeners) {
		listener(metadata)
	}
}

export function compileVariableGroupRule(
	metadata: VariableGroupMetadata,
): string {
	let declarations = ""
	for (const key of Object.keys(metadata.definitions)) {
		declarations += `${metadata.names[key]}:${metadata.definitions[key]};`
	}
	return `:root{${declarations}}`
}

export function subscribeVariableGroups(
	listener: (metadata: VariableGroupMetadata) => void,
): Destructor {
	listeners.add(listener)

	for (const metadata of registeredGroups.values()) {
		listener(metadata)
	}

	return () => {
		listeners.delete(listener)
	}
}

export function attachVariableGroups(
	styleApi: VariableStyleSink,
): Destructor {
	const insertedGroups = new Map<string, Destructor>()

	function ensureGroup(metadata: VariableGroupMetadata) {
		if (insertedGroups.has(metadata.groupId)) {
			return
		}

		const destructor = styleApi.addGlobalStyle(
			compileVariableGroupRule(metadata),
		)
		insertedGroups.set(metadata.groupId, destructor)
	}

	const unsubscribe = subscribeVariableGroups(ensureGroup)

	return () => {
		unsubscribe()
		for (const destructor of insertedGroups.values()) {
			destructor()
		}
		insertedGroups.clear()
	}
}

export function defineVars<
	const T extends Record<string, VariablePrimitive>,
>(definitions: T): VariableGroup<T> {
	assertValidTokenKeys(definitions)

	const canonicalDefinitions = canonicalizeDefinitions(definitions)
	const groupId = hashObject(canonicalDefinitions)
	const names: Record<string, `--${string}`> = {}
	const references = {} as VariableGroupWithMeta<T>

	for (const key of Object.keys(canonicalDefinitions)) {
		const customProperty = `--purse-${groupId}-${key}` as const
		names[key] = customProperty
		;(references as Record<string, CSSVar>)[key] =
			`var(${customProperty})`
	}

	const metadata = {
		groupId,
		definitions: canonicalDefinitions,
		names,
	} satisfies VariableGroupMetadata

	Object.defineProperty(references, VARIABLE_GROUP_META, {
		value: metadata,
		enumerable: false,
	})

	registerVariableGroup(metadata)

	return references
}

export function getVariableGroupMetadata(
	group: AnyVariableGroup,
): VariableGroupMetadata {
	const metadata = (group as VariableGroupWithMeta<ScalarDefinitions>)[
		VARIABLE_GROUP_META
	]
	if (!metadata) {
		throw new Error("Expected a variable group created by defineVars")
	}
	return metadata
}
