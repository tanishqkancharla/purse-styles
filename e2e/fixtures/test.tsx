import {
	cloneElement,
	type ReactElement,
	type ReactNode,
	type JSX,
} from "react"
import { page, type Locator } from "vitest/browser"
import { expect, test as baseTest } from "vitest"
import {
	cleanup,
	render,
	type RenderResult,
} from "vitest-browser-react/pure"

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
	styleCleanup: true
	renderPurse: RenderPurse
	renderStyled: RenderStyled
}

function PurseWrapper({ children }: { children: ReactNode }): JSX.Element {
	return <PurseProvider>{children}</PurseProvider>
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
	styleCleanup: [
		async ({}, use) => {
			await cleanup()

			await use(true)

			await cleanup()
		},
		{ auto: true },
	],
	renderPurse: async ({ styleCleanup }, use) => {
		void styleCleanup

		await use((ui) => render(ui, { wrapper: PurseWrapper }))
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
