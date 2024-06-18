function toAlphabeticChar(code: number) {
	return String.fromCharCode(code + (code > 25 ? 39 : 97))
}

function toAlphabeticName(code: number) {
	let name = ""
	let x

	for (x = Math.abs(code); x > 52; x = (x / 52) | 0)
		name = toAlphabeticChar(x % 52) + name

	return toAlphabeticChar(x % 52) + name
}

function toPhash(h: number, x: string) {
	let i = x.length
	while (i) {
		i--
		h = (h * 33) ^ x.charCodeAt(i)
	}
	return h
}

export const hashObject = (value: Object) =>
	toAlphabeticName(toPhash(5381, JSON.stringify(value)) >>> 0)
