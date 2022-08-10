const path = require('path')
const { spawn } = require('child_process')

const pkg = path.resolve(path.join('..', '..', 'index.js'))

module.exports = { spawner }

function spawner (func, args, opts) {
  return new Promise((resolve, reject) => {
    func = functionToString(func)

    const script = `const test = require(${JSON.stringify(pkg)})\n\n${func}`

    // + timeout?
    const proc = spawn(process.execPath, ['-e', script/* , ...args */], { stdio: ['pipe', 'pipe', 'pipe']/* , ...opts */ })

    const stdout = []
    const stderr = []

    proc.on('close', function (code) {
      resolve({ stdout: cleanStd(stdout), stderr: cleanStd(stderr) })
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

function functionToString (func) {
  func = func.toString()

  // very naively done but works for now
  if (func.indexOf('function () {') === 0) func = func.replace('function () {', '')
  else if (func.indexOf('() => {') === 0) func = func.replace('() => {', '')
  else throw new Error('Function for spawning not valid')

  func = func.slice(0, -1) // removes "}" from the end

  // + there are some remaining spaces
  return func.trim()
}
