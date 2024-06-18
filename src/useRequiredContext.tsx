import React, { useContext } from "react"

export function useRequiredContext<T>(
	context: React.Context<T | undefined>,
): T {
	const value = useContext(context)
	if (value === undefined) {
		throw new Error(`Expected value of ${context} to be defined`)
	}
	return value
}
