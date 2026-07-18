import {
	cloneElement,
	type ReactElement,
	type ReactNode,
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

type RenderPurse = (ui: ReactNode) => Promise<RenderResult>

export type StyledRenderResult = RenderResult & {
	subject: Locator
}

type RenderStyled = (
	element: ReactElement<StyledElementProps>,
	...styles: StyleArgument[]
) => Promise<StyledRenderResult>

type PurseFixtures = {
	renderPurse: RenderPurse
	renderStyled: RenderStyled
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
	renderPurse: async ({}, use) => {
		const renderedComponents: RenderResult[] = []

		await use(async (ui) => {
			const result = await render(ui, { wrapper: PurseProvider })
			renderedComponents.push(result)
			return result
		})

		for (const result of renderedComponents.reverse()) {
			await result.unmount()
			result.container.remove()
		}
	},
	renderStyled: async ({ renderPurse }, use) => {
		await use(async (element, ...styles) => {
			const screen = await renderPurse(
				<StyledSubject element={element} styles={styles} />,
			)
			const subject = screen.container.firstElementChild

			if (subject === null) {
				throw new Error("renderStyled expected the element to render")
			}

			return {
				...screen,
				subject: page.elementLocator(subject),
			}
		})
	},
})

export { expect }
