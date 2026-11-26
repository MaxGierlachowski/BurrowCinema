const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')
const { withUniwindConfig } = require('uniwind/metro')

const config = getDefaultConfig(__dirname)

// Code in ../shared is used by the web app too. Metro watches it, and its package imports
// (react, @tanstack/react-query, …) resolve from this app, so nothing is loaded twice.
const sharedDir = path.resolve(__dirname, '../shared')
config.watchFolders = [sharedDir]

const resolveDefault = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isPackage = !moduleName.startsWith('.') && !path.isAbsolute(moduleName)
  const fromShared = context.originModulePath.startsWith(sharedDir)
  const ctx = isPackage && fromShared ? { ...context, originModulePath: path.join(__dirname, 'package.json') } : context
  return (resolveDefault ?? context.resolveRequest)(ctx, moduleName, platform)
}

// Uniwind has to be the outermost wrapper.
module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
})
