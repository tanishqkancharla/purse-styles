import {
	cloneElement,
	type ReactElement,
	type JSX,
} from "react"
import { page, type Locator } from "vitest/browser"
import { expect, test as baseTest } from "vitest"
import { render, type RenderResult } from "vitest-browser-react/pure"

import {
	PurseProvider,
	type StyleArgument,
	useStyles,
} from "../../src/index"

type StyledElementProps = {
	className?: string
}

export type StyledComponentRenderResult = RenderResult & {
	subject: Locator
}

type RenderStyledComponent = (
	element: ReactElement<StyledElementProps>,
	...styles: StyleArgument[]
) => Promise<StyledComponentRenderResult>

type PurseFixtures = {
	renderStyledComponent: RenderStyledComponent
}

function StyledSubject({
	element,
	styles,
}: {
	element: ReactElement<StyledElementProps>
	styles: StyleArgument[]
}): JSX.Element {
	const purseClassName = useStyles(...styles)
	const className = [element.props.className, purseClassName]
		.filter(Boolean)
		.join(" ")

	return cloneElement(element, { className })
}

export const test = baseTest.extend<PurseFixtures>({
	renderStyledComponent: async ({}, use) => {
		const renderedComponents: RenderResult[] = []

		await use(async (element, ...styles) => {
			const screen = await render(
				<StyledSubject element={element} styles={styles} />,
				{ wrapper: PurseProvider },
			)
			renderedComponents.push(screen)
			const subject = screen.container.firstElementChild

			if (subject === null) {
				throw new Error(
					"renderStyledComponent expected the element to render",
				)
			}

			return {
				...screen,
				subject: page.elementLocator(subject),
			}
		})

		for (const result of renderedComponents.reverse()) {
			await result.unmount()
			result.container.remove()
		}
	},
})

export { expect }
