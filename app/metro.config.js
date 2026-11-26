const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')
const { withUniwindConfig } = require('uniwind/metro')

const config = getDefaultConfig(__dirname)

// Code in ../shared is used by the web app too. Metro watches it, and its package imports
// (react, @tanstack/react-query, …) resolve from this app, so nothing is loaded twice.
const sharedDir = path.resolve(__dirname, '../shared')
const srcDir = path.resolve(__dirname, 'src')
config.watchFolders = [sharedDir]

// Aliases are resolved here rather than from tsconfig paths (disabled in app.json), because
// tsconfig also maps some type packages for TypeScript only.
const aliases = { '@shared/': sharedDir, '@/': srcDir }

const resolveDefault = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = resolveDefault ?? context.resolveRequest
  const alias = Object.keys(aliases).find((prefix) => moduleName.startsWith(prefix))
  if (alias) return resolve(context, path.join(aliases[alias], moduleName.slice(alias.length)), platform)

  const isPackage = !moduleName.startsWith('.') && !path.isAbsolute(moduleName)
  const fromShared = context.originModulePath.startsWith(sharedDir)
  const ctx = isPackage && fromShared ? { ...context, originModulePath: path.join(__dirname, 'package.json') } : context
  return resolve(ctx, moduleName, platform)
}

// Uniwind has to be the outermost wrapper.
module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
})
