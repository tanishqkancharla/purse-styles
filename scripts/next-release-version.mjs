#!/usr/bin/env node
/**
 * Print the next Purse release version.
 *
 * Uses package.json if that version is newer than all git tags and npm.
 * Otherwise patch-bumps the max of package.json, git tags, and the npm version.
 *
 *   node scripts/next-release-version.mjs
 *   node scripts/next-release-version.mjs --json
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const json = process.argv.includes("--json")

function parse(value) {
	const match = String(value ?? "")
		.trim()
		.replace(/^v/, "")
		.match(/^(\d+)\.(\d+)\.(\d+)$/)
	if (!match) return null
	return {
		raw: `${match[1]}.${match[2]}.${match[3]}`,
		n: [Number(match[1]), Number(match[2]), Number(match[3])],
	}
}

function cmp(a, b) {
	for (let i = 0; i < 3; i++) {
		if (a.n[i] !== b.n[i]) return a.n[i] - b.n[i]
	}
	return 0
}

function bumpPatch(version) {
	return `${version.n[0]}.${version.n[1]}.${version.n[2] + 1}`
}

function run(command, args, options = {}) {
	return execFileSync(command, args, {
		cwd: repoRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		...options,
	}).trim()
}

const pkg = parse(JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")).version)
if (pkg === null) {
	throw new Error("package.json version is not X.Y.Z")
}

const tags = run("git", ["tag", "-l", "v*.*.*"])
	.split("\n")
	.map(parse)
	.filter(Boolean)

let npmVersion = null
try {
	npmVersion = parse(run("npm", ["view", "purse-styles", "version"]))
} catch {
	npmVersion = null
}

const released = [...tags]
if (npmVersion) released.push(npmVersion)
released.sort(cmp)
const latestReleased = released.at(-1) ?? parse("0.0.0")

const pkgIsReleased = cmp(pkg, latestReleased) <= 0

const next = pkgIsReleased ? bumpPatch([pkg, latestReleased].sort(cmp).at(-1)) : pkg.raw
const bump = next !== pkg.raw

if (json) {
	process.stdout.write(
		`${JSON.stringify({
			version: next,
			current: pkg.raw,
			bump,
			latestTag: tags.sort(cmp).at(-1)?.raw ?? null,
			npmVersion: npmVersion?.raw ?? null,
		})}\n`,
	)
} else {
	process.stdout.write(`${next}\n`)
}
