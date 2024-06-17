# npm-ts-boilerplate
A boilerplate for typescript packages for npm. [Esbuild](https://esbuild.github.io), [Vitest](https://vitest.dev).

```sh
# Build into dist folder
npm run build

# Check types
npm run check

npm run test

# Build and publish to NPM (make sure the version is bumped)
npm run release

# Print the bundlesize of the minified package and exit
npm run bundlesize
```

I've been iterating on this for a while. Here are the interesting bits:

* Packages are bundled into `index.cjs` (for CommonJS) and `index.js` (for ESM).
* Types are all bundled into `index.d.ts`
* Sourcemaps for bundles point to `src` directory. One could argue the bundles are readable by themselves (since they're not minified), but the source map files are small, and reading in Typescript vs. Javascript can help debug (you know the type of each variable).
* Only `src` and `dist` folders are published to NPM.
* Tests are in `*.test.ts` files, run by Vitest

The reason I don't just use Parcel (my preferred build system) is because of:
* https://github.com/parcel-bundler/parcel/issues/7951
* Parcel mangles names, and I didn't know how to turn that off.
