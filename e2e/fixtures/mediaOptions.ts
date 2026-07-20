import type { Page } from "playwright"

export type BrowserMediaOptions = Exclude<
	Parameters<Page["emulateMedia"]>[0],
	undefined
>

export type Viewport = {
	width: number
	height: number
}

export type EmulateMediaOptions = BrowserMediaOptions & {
	viewport?: Viewport
}

export const DEFAULT_VIEWPORT: Viewport = {
	width: 1280,
	height: 720,
}

export const RESET_MEDIA_OPTIONS: BrowserMediaOptions = {
	colorScheme: null,
	contrast: null,
	forcedColors: null,
	media: null,
	reducedMotion: null,
}
