const path = require('path')
const child_process = require('child_process')

const pkg = JSON.stringify(path.resolve(path.join('..', 'index.js')))

module.exports = { tester, spawner, standardizeTap }

async function tester (t, name, func, expected) {
  name = JSON.stringify(name)
  func = functionToString(func, { raw: true })

  const script = `const test = require(${pkg})\n\ntest(${name}, ${func})`
  const { stdout, stderr } = await executeCode(script)
  const tapout = standardizeTap(stdout)

  t.is(stderr, '') // + temp
  t.is(tapout, standardizeTap(expected))

  return { stdout, tapout, stderr }
}

async function spawner (t, func, expected) {
  func = functionToString(func)

  const script = `const test = require(${pkg})\n\n${func}`
  const { stdout, stderr } = await executeCode(script)
  const tapout = standardizeTap(stdout)

  t.is(stderr, '') // + temp
  t.is(tapout, standardizeTap(expected))

  return { stdout, tapout, stderr }
}

function executeCode (script) {
  return new Promise((resolve, reject) => {
    const args = ['-e', script]
    const opts = { timeout: 30000 }
    const child = child_process.execFile(process.execPath, args, opts, callback)

    function callback (error, stdout, stderr) {
      if (error) reject(error)
      else resolve({ stdout, stderr })
    }
  })
}

function standardizeTap (stdout) {
  return stdout
    .replace(/#.+\n/g, '') // strip comments
    .replace(/\n[^\n]*node:internal[^\n]*\n/g, '\n') // strip internal node stacks
    .replace(/\n[^\n]*(\[eval\])[^\n]*\n/g, '\n') // strip internal node stacks
    .split('\n')
    .map(n => n.trim())
    .filter(n => n)
    .join('\n')
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
