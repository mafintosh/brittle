const path = require('path')
const child_process = require('child_process')
const chalk = require('chalk')

const pkg = JSON.stringify(path.join(__dirname, '..', '..', 'index.js'))

module.exports = { tester, spawner, standardizeTap }

async function tester (t, name, func, expected, expectedMore = {}) {
  name = JSON.stringify(name)
  func = functionToString(func, { raw: true })

  const script = `const test = require(${pkg})\n\ntest(${name}, ${func})`
  print('tester', 'yellow', script)
  return executeTap(t, script, expected, expectedMore)
}

async function spawner (t, func, expected, expectedMore = {}) {
  func = functionToString(func, { raw: true })

  const script = `const test = require(${pkg})\n\n;(${func})()`
  print('spawner', 'yellow', script)
  return executeTap(t, script, expected, expectedMore)
}

async function executeTap (t, script, expected, expectedMore = {}) {
  const { exitCode, error, stdout, stderr } = await executeCode(script)

  if (expectedMore.exitCode !== undefined) {
    t.is(exitCode, expectedMore.exitCode, 'exitCode is the expected')
  }

  if (error) throw error
  if (stderr) throw new Error(stderr)

  const tapout = standardizeTap(stdout)
  const tapexp = standardizeTap(expected)
  t.is(tapout, tapexp, 'TAP output matches the expected output')

  print('stdout', 'green', stdout)
  print('tapout', 'magenta', tapout)
  print('tapexp', 'cyan', tapexp)

  return { exitCode, stdout, tapout, tapexp, stderr }
}

function executeCode (script) {
  return new Promise((resolve, reject) => {
    const args = ['-e', script]
    const opts = { timeout: 30000 }
    const child = child_process.execFile(process.execPath, args, opts, callback)

    let exitCode // + should listen to 'close' or 'exit'? (note: 'close' is called after callback)
    child.on('exit', function (code) {
      exitCode = code
    })

    function callback (error, stdout, stderr) {
      if (error) resolve({ exitCode, error })
      else resolve({ exitCode, stdout, stderr })
    }
  })
}

function standardizeTap (stdout) {
  return stdout
    .replace(/#.+\n/g, '\n') // strip comments
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

function print (name, color, str) {
  console.log(chalk[color]('[' + name + ']'))
  console.log(str)
  console.log(chalk[color]('[/' + name + ']'))
}
