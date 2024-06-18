const uppercasePattern = /[A-Z]/g
const msPattern = /^ms-/
const cache: { [key: string]: string } = {}

function toHyphenLower(match: string) {
	return "-" + match.toLowerCase()
}

export function hyphenateStyleName(name: string) {
	if (cache.hasOwnProperty(name)) {
		return cache[name]
	}

	var hName = name.replace(uppercasePattern, toHyphenLower)
	return (cache[name] = msPattern.test(hName) ? "-" + hName : hName)
}
