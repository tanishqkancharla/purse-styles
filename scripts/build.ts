#! tsx
/// <reference types="@types/node" />

import assert from "assert/strict"
import * as esbuild from "esbuild"
import fs from "fs"
import typescript from "typescript"

const packageJson = JSON.parse(fs.readFileSync("./package.json").toString())

const {
	source: entryFile,
	main: esmOutFile,
	peerDependencies = {},
	dependencies = {},
} = packageJson

assert(entryFile, "`source` (entry point) not specified in package.json")
assert(esmOutFile, "`main` (esm out file) not specified in package.json")

async function main() {
	await fs.promises.rm("dist", { recursive: true, force: true })
	await fs.promises.mkdir("dist")

	await runEsbuild()
	runTypeScript()
}

const sharedConfig: esbuild.BuildOptions = {
	entryPoints: [entryFile],
	minify: false,
	bundle: true,
	platform: "browser",
	sourcemap: "linked",
	sourcesContent: false,
	external: Object.keys({ ...peerDependencies, ...dependencies }),
}

function runEsbuild() {
	return esbuild
		.build({ ...sharedConfig, format: "esm", outfile: esmOutFile })
		.then((r) => {
			console.log(`Wrote ${esmOutFile}`)
			return r
		})
}

function runTypeScript() {
	const tsConfig = typescript.readConfigFile(
		"./tsconfig.json",
		typescript.sys.readFile,
	)
	const tsConfigParseResult = typescript.parseJsonConfigFileContent(
		tsConfig.config,
		typescript.sys,
		"./",
	)
	const program = typescript.createProgram(tsConfigParseResult.fileNames, {
		...tsConfigParseResult.options,
		emitDeclarationOnly: true,
	})

	program.emit()

	console.log("TypeScript declaration file emitted")
}

main().catch((e) => {
	console.error("build failed", e)
	process.exit(1)
})
