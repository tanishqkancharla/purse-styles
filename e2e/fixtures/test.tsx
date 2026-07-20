import {
	cloneElement,
	type ReactElement,
	type JSX,
} from "react"
import {
	commands,
	page,
	type Locator,
} from "vitest/browser"
import { expect, test as baseTest } from "vitest"
import { render, type RenderResult } from "vitest-browser-react/pure"

import {
	PurseProvider,
	type StyleArgument,
	useStyles,
} from "../../src/index"
import {
	DEFAULT_VIEWPORT,
	type BrowserMediaOptions,
	type EmulateMediaOptions,
	RESET_MEDIA_OPTIONS,
} from "./emulateMediaCommand"
import "./toHaveComputedStyle"

declare module "vitest/browser" {
	interface BrowserCommands {
		emulateMedia(
			options: BrowserMediaOptions,
		): Promise<void>
	}
}

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

type EmulateMedia = (options: EmulateMediaOptions) => Promise<void>

type PurseFixtures = {
	emulateMedia: EmulateMedia
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
	emulateMedia: async ({}, use) => {
		let changed = false

		try {
			await use(async ({ viewport, ...mediaOptions }) => {
				changed = true

				if (viewport !== undefined) {
					await page.viewport(viewport.width, viewport.height)
				}

				await commands.emulateMedia(mediaOptions)
			})
		} finally {
			if (changed) {
				await commands.emulateMedia(RESET_MEDIA_OPTIONS)
				await page.viewport(
					DEFAULT_VIEWPORT.width,
					DEFAULT_VIEWPORT.height,
				)
			}
		}
	},
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
