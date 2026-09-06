import ts from 'typescript'
import { readdirSync } from 'node:fs'

// Vercel reads the root tsconfig, rather than following tsc project references.
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile)
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, '.')
const files = readdirSync('api').filter((file) => file.endsWith('.ts')).map((file) => 'api/' + file)
const program = ts.createProgram(files, { ...parsed.options, noEmit: true })
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)]
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: (file) => file, getCurrentDirectory: ts.sys.getCurrentDirectory, getNewLine: () => '\n' }))
  process.exitCode = 1
} else console.log(`API root-config typecheck passed (${files.length} endpoints).`)
