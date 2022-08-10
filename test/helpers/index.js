const path = require('path')
const { spawn } = require('child_process')
const tapParser = require('tap-parser')

const pkg = JSON.stringify(path.resolve(path.join('..', 'index.js')))

module.exports = { spawner, tester }

async function tester (name, func) {
  name = JSON.stringify(name)
  func = functionToString(func, { raw: true })

  const script = `const test = require(${pkg})\n\ntest(${name}, ${func})`

  return executeCode(script)
}

async function spawner (func) {
  func = functionToString(func)

  const script = `const test = require(${pkg})\n\n${func}`

  return executeCode(script)
}

function executeCode (script, opts = {}) {
  return new Promise((resolve, reject) => {
    // + timeout?
    const proc = spawn(process.execPath, ['-e', script/* , ...args */], { stdio: ['pipe', 'pipe', 'pipe']/* , ...opts */ })

    const stdout = []
    const stderr = []

    proc.on('close', function (code) {
      let out = cleanStd(stdout)
      let err = cleanStd(stderr)

      if (true) {
        out = parseTap(out)
      }

      resolve({
        stdout: out,
        stderr: err
      })
    })

    proc.on('error', function (error) {
      reject(error)
    })

    proc.stdout.setEncoding('utf-8')
    proc.stderr.setEncoding('utf-8')
    proc.stdout.on('data', (chunk) => stdout.push(chunk))
    proc.stderr.on('data', (chunk) => stderr.push(chunk))
    proc.stdout.on('end', (chunk) => stdout.push(chunk))
    proc.stderr.on('end', (chunk) => stderr.push(chunk))
  })
}

function cleanStd (std) {
  if (!std.length || std[0] === undefined) {
    return undefined
  }
  return std.join('')
}

function parseTap (stdout) {
  const parsed = tapParser.parse(stdout)
  return parsed
  // return JSON.stringify(parsed, replacer, '  ')

  function replacer (k, v) {
    if (!Array.isArray(v)) return v
    return v.filter(item => !Array.isArray(item) || item[0] !== 'comment')
  }
}

function functionToString (func, opts = {}) {
  func = func.toString()

  if (!opts.raw) {
    // very naively done but works for now
    if (func.indexOf('function () {') === 0) func = func.replace('function () {', '')
    else if (func.indexOf('() => {') === 0) func = func.replace('() => {', '')
    else throw new Error('Function for spawning not valid')

    func = func.slice(0, -1) // removes "}" from the end
  }

  // + there are some remaining spaces
  return func.trim()
}
