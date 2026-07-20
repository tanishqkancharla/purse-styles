import { Destructor, joinDestructors } from "./destructors"
import { hashObject } from "./hashObject"

export type CSSVar = `var(--${string})`

export type VariablePrimitive = string | number

export type VariableCondition = string

export type ConditionalVariableValue<
	T extends VariablePrimitive = VariablePrimitive,
> = {
	default: T
} & Partial<Record<VariableCondition, T>>

export type VariableDefinition =
	| VariablePrimitive
	| ConditionalVariableValue

type NormalizedTokenDefinition = {
	default: VariablePrimitive
	conditions: Record<string, VariablePrimitive>
}

type NormalizedDefinitions = Record<string, NormalizedTokenDefinition>

export type VariableGroupMetadata = {
	groupId: string
	definitions: NormalizedDefinitions
	names: Record<string, `--${string}`>
}

export type VariableGroup<T extends Record<string, unknown>> = {
	readonly [K in keyof T]: CSSVar
}

export type AnyVariableGroup = VariableGroup<Record<string, unknown>>

export type VariableStyleSink = {
	addGlobalStyle: (styleRule: string) => Destructor
}

const VARIABLE_GROUP_META = Symbol("purse.variableGroup")

type VariableGroupWithMeta<T extends Record<string, unknown>> =
	VariableGroup<T> & {
		readonly [VARIABLE_GROUP_META]: VariableGroupMetadata
	}

const registeredGroups = new Map<string, VariableGroupMetadata>()
const listeners = new Set<(metadata: VariableGroupMetadata) => void>()

function normalizeDefinition(
	value: VariableDefinition,
): NormalizedTokenDefinition {
	if (typeof value !== "object" || value === null) {
		return { default: value, conditions: {} }
	}

	const conditions: Record<string, VariablePrimitive> = {}
	for (const key of Object.keys(value).sort()) {
		if (key === "default") continue
		conditions[key] = value[key as VariableCondition]!
	}

	return {
		default: value.default,
		conditions,
	}
}

function canonicalizeDefinitions(
	definitions: Record<string, VariableDefinition>,
): NormalizedDefinitions {
	const canonical: NormalizedDefinitions = {}
	for (const key of Object.keys(definitions).sort()) {
		canonical[key] = normalizeDefinition(definitions[key]!)
	}
	return canonical
}

function assertValidTokenKeys(definitions: Record<string, VariableDefinition>) {
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

export function compileVariableGroupRules(
	metadata: VariableGroupMetadata,
): string[] {
	let rootDeclarations = ""
	const declarationsByCondition = new Map<string, string>()

	for (const key of Object.keys(metadata.definitions)) {
		const definition = metadata.definitions[key]!
		const customProperty = metadata.names[key]!
		rootDeclarations += `${customProperty}:${definition.default};`

		for (const condition of Object.keys(definition.conditions).sort()) {
			const existing = declarationsByCondition.get(condition) ?? ""
			declarationsByCondition.set(
				condition,
				`${existing}${customProperty}:${definition.conditions[condition]};`,
			)
		}
	}

	const rules = [`:root{${rootDeclarations}}`]
	for (const condition of [...declarationsByCondition.keys()].sort()) {
		const declarations = declarationsByCondition.get(condition)
		rules.push(
			condition.startsWith("@")
				? `${condition}{:root{${declarations}}}`
				: `${condition}{${declarations}}`,
		)
	}
	return rules
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

		const destructor = joinDestructors(
			compileVariableGroupRules(metadata).map((rule) =>
				styleApi.addGlobalStyle(rule),
			),
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
	const T extends Record<string, VariableDefinition>,
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
	const metadata = (group as VariableGroupWithMeta<Record<string, unknown>>)[
		VARIABLE_GROUP_META
	]
	if (!metadata) {
		throw new Error("Expected a variable group created by defineVars")
	}
	return metadata
}
