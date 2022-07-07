'use strict'
const { fileURLToPath } = require('url')
const { readFileSync } = require('fs')
const { AssertionError } = require('assert')
const { Console } = require('console')
const { format } = require('util')
const yaml = require('tap-yaml')
const deepEqual = require('deep-equal')
const tmatch = require('tmatch')
const SonicBoom = require('sonic-boom')
const StackParser = require('error-stack-parser')
const winr = require('why-is-node-running')
const ss = require('snap-shot-core')
const { serializeError } = require('serialize-error')
const stream = require('stream')
const { Readable } = stream

let tap = null

stream.Readable = class extends Readable {
  constructor (...args) {
    super(...args)
    if ('plan' in this) {
      tap = this
      stream.Readable = Readable
    }
  }
}
const nodeTest = require('test')

const { TestError, TestTypeError, PrimitiveError } = require('./lib/errors')
const {
  kIncre,
  kCount,
  kIndex,
  kCounted,
  kError,
  kResolve,
  kReject,
  kTimeout,
  kTeardowns,
  kSnap,
  kInfo,
  kChildren,
  kEnding,
  kSkip,
  kTodo,
  kSolo,
  kLevel,
  kInverted,
  kInject,
  kReset,
  kQueue,
  kAssertQ,
  kComplete,
  kDone,
  kMain
} = require('./lib/symbols')

const console = new Console(process.stdout, process.stderr)
const parseStack = StackParser.parse.bind(StackParser)
const noop = () => {}
const cwd = process.cwd()
const { constructor: AsyncFunction } = Object.getPrototypeOf(async () => {})
const env = process.env
const LEVEL = Number.isInteger(+env.BRITTLE_INTERNAL_LEVEL) ? +env.BRITTLE_INTERNAL_LEVEL : 0
const SNAP = Number.isInteger(+env.SNAP) ? !!env.SNAP : env.SNAP && new RegExp(env.SNAP)
const SOLO = Number.isInteger(+env.SOLO) ? !!env.SOLO : env.SOLO && new RegExp(env.SOLO)
const TIMEOUT = Number.isInteger(+env.BRITTLE_TIMEOUT) ? +env.BRITTLE_TIMEOUT : 30000

Object.hasOwn = Object.hasOwn || ((o, p) => Object.hasOwnProperty.call(o, p))

process.setUncaughtExceptionCaptureCallback((err) => {
  Object.defineProperty(err, 'fatal', { value: true })
  if (!process.emit('uncaughtException', err)) {
    Promise.reject(err)
  }
})

process.on('unhandledRejection', (reason, promise) => {
  if (reason.fatal || promise instanceof Test || reason instanceof TestError || reason instanceof TestTypeError) {
    console.error('Brittle: Fatal Error')
    console.error(reason)
    process.exit(1)
  }
  const name = 'UnhandledPromiseRejectionWarning'
  const warning = new Error(
    'Unhandled promise rejection. This error originated either by ' +
      'throwing inside of an async function without a catch block, ' +
      'or by rejecting a promise which was not handled with .catch(). ' +
      'To terminate the node process on unhandled promise ' +
      'rejection, use the CLI flag `--unhandled-rejections=strict` (see ' +
      'https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). '
  )
  warning.name = name
  try {
    if (reason instanceof Error) {
      warning.stack = reason.stack
      process.emitWarning(reason.stack, name)
    } else {
      process.emitWarning(reason, name)
    }
  } catch {}

  process.emitWarning(warning)
})

async function ender (tests = main[kChildren]) {
  for (const test of tests) {
    const children = test[kChildren]
    const endedTest = (children.length > 0) && await ender(children)
    if (endedTest) return
    if (test.ended === false) {
      try { await test.end() } catch {}
      return true
    }
  }
  return false
}

// const drain = async (...args) => {
//   const endedTest = await ender()
//   if (endedTest === false && main.ended === false) await main.end()
//   // allow another beforeExit
//   if (endedTest) setImmediate(() => {})
// }

// process.on('beforeExit', async () => {
//   await drain()
// })

// process.once('exit', async () => {
//   if (main.ended === false) main.end()
// })

process.prependListener('SIGINT', async function why () {
  process.removeListener('SIGINT', why)
  const listeners = process.rawListeners('SIGINT')
  process.removeAllListeners('SIGINT')
  await main.comment('Active Handles Report')
  winr({
    error (...args) {
      main.comment(format(...args))
    }
  })
  // await drain()
  // honour any other sigint listeners
  for (const listener of listeners) await listener()
  setTimeout(() => { process.exit(127) }, 0).unref() // allow for output flushing before exit
})



const methods = ['plan', 'end', 'pass', 'fail', 'ok', 'absent', 'is', 'not', 'alike', 'unlike', 'exception', 'execution', 'snapshot', 'comment', 'timeout', 'teardown', 'configure']
const coercables = ['is', 'not', 'alike', 'unlike']

const booms = new Map()
const stackScrub = (err) => {
  if (err && err.stack) {
    const scrubbed = parseStack(err).filter(({ fileName }) => fileName !== __filename)
    if (scrubbed.length > 0) {
      err.stack = `${Error.prototype.toString.call(err)}\n    at ${scrubbed.join('\n    at ').replace(/\?cacheBust=\d+/g, '')}`
    }
  }
  return err
}

const nodeT = { test: nodeTest, diagnostic () {} }

class Test extends Promise {
  static get [Symbol.species] () { return Promise }
  tap = tap
  #t = nodeT
  constructor (t = nodeT, options = {}) {
    const resolver = {}
    super((resolve, reject) => { Object.assign(resolver, { resolve, reject }) })
    this.#t = t
    this.tap = tap
    Object.defineProperties(this, { [kResolve]: { value: resolver.resolve } })
    Object.defineProperties(this, { [kReject]: { value: resolver.reject } })
    this[kInverted] = options[kInverted] || false
    this[kSolo] = options[kSolo] || false
    this.ended = false
    this.error = null
    this[kEnding] = false
    this[kIndex] = 0
    
    // non-enumerables:
    if (this.assert) {
      this[kTeardowns].length = 0
    } else {
      Object.defineProperties(this, {
        assert: { value: this },
        [kTeardowns]: { value: [] },
        advice: { value: [] },
      })
    }

    this.configure(options)

    if (this[kMain] === false) {

    } else {
      this[kSnap] = SNAP
    }

    if (this[kSkip] || this[kTodo]) {
      for (const method of methods) this[method] = noop
      for (const method of coercables) this[method].coercively = noop
      this.exception.all = noop
    } else {
      for (const method of methods) {
        this[method] = this[method].bind(this)
        if (method === 'exception') {
          this[method].all = (functionOrPromise, expectedError, message) => {
            return this[method](functionOrPromise, expectedError, message, true)
          }
        }
      }
      for (const method of coercables) {
        this[method].coercively = (actual, expected, message) => this[method](actual, expected, message, false)
      }
    }
  }

  get [Symbol.toStringTag] () {} // just the presence of this corrects the callframe name of this class from Promise to Test

  async #assert ({ message, ok, explanation }) {
    this.#t.test(message, ok ? () => {} : async () => {
      const split = yaml.stringify(explanation).split('\n')
      for (const line of split.filter((line) => line.trim())) this.#t.diagnostic(line)

      if (this.bail) process.nextTick(() => {
        process.stdout.write(`Bail out! Failed test - ${this.description}\n`)
        process.exit(1)
      })
      throw explanation.err
    })
  }


  [kError] (err) {
    if (this.error) return
    if (typeof err !== 'object' || err === null) err = new PrimitiveError(err)
    if ('trace' in err) return
    stackScrub(err)
    clearTimeout(this[kTimeout])
    this[kTimeout] = null
    this.error = err

    if (this.ended || err.code === 'ERR_CONFIGURE_FIRST') {
      throw Promise.reject(err) // cause unhandled rejection
    }

    if (this[kInverted]) {
      err.trace = { ...err }
      this.execution(Promise.reject(err), err.message)
      this[kReject](err)
    } else {
      this.execution(Promise.reject(err), err.message)
    }
  }

  [kCount] () {
    this[kCounted] += 1
    if (this[kEnding] && this.planned > 0 && this[kCounted] >= this.planned) return this.end().catch(noop)
  }

  [kIncre] () {
    try {
      if (this.error) throw this.error
      if (this.ended) {
        if (this.planned > 0 && this.count + 1 > this.planned) {
          throw new TestError('ERR_COUNT_EXCEEDS_PLAN_AFTER_END', {
            count: this.count + 1,
            planned: this.planned,
            description: this.description
          })
        }

        throw new TestError('ERR_ASSERT_AFTER_END', { description: this.description })
      }
      this.count += 1
      if (this.count === this.planned) {
        this[kEnding] = true
        return
      }
      if (this.planned > 0 && this.count > this.planned) {
        throw new TestError('ERR_COUNT_EXCEEDS_PLAN', { count: this.count, planned: this.planned })
      }
    } catch (err) {
      this[kError](err)
    }
  }

  configure (options) {
    if (this.count > 0) {
      this[kError](new TestError('ERR_CONFIGURE_FIRST'))
      return
    }
    const {
      timeout = TIMEOUT,
      bail = this.bail || false,
    } = options


    Object.defineProperties(this, {
      options: { value: options, configurable: true },
      bail: { value: bail, configurable: true },
      [kSkip]: { value: options.skip === true, writable: true },
      [kTodo]: { value: options.todo === true, writable: true }
    })

  }

  async end () {

    const teardowns = this[kTeardowns].slice()
    this[kTeardowns].length = 0

    if (this.ended === false) {
      this.ended = true
      for (const fn of teardowns) {
        try { await fn() } catch (err) { this[kError](err) }
      }
    }

    this[kResolve]()

    return this
  }


  then (onFulfilled, onRejected) {
    return super.then(onFulfilled, onRejected)
  }

  get test () {
    function test (description = `${this.description} - subtest`, opts, fn) {
      if (typeof opts === 'function') {
        fn = opts
        opts = undefined
      }
      opts = opts || { ...this.options, concurrency: 1 }
      opts[kInverted] = !fn
      opts.only = !!opts.solo
      return this.#t.test(description, opts, async (t) => {
        try {
          await fn(new Test(t))
        } catch (err) {
          this[kError](err)
          throw err
        }
      })
    }
    test.skip = this.skip.bind(this)
    test.todo = this.todo.bind(this)
    test.configure = this.configure.bind(this)
    Object.defineProperty(this, 'test', { value: test.bind(this) })

    test.test = this.test

    return this.test
  }

  solo (description, opts = {}, fn) {
    if (typeof opts === 'function') {
      fn = opts
      opts = {}
    }
    this[kSolo] = true
    opts[kSolo] = true

    if (arguments.length > 0) return this.test(description, opts, fn)
  }

  skip (description, opts = {}, fn) {
    if (typeof opts === 'function') {
      fn = opts
      opts = {}
    }
    opts.skip = true

    return this.test(description, opts, fn)
  }

  todo (description, opts = {}, fn) {
    if (typeof opts === 'function') {
      fn = opts
      opts = {}
    }
    opts.todo = true

    return this.test(description, opts, fn)
  }

  async plan (planned, comment) {
    if (typeof planned !== 'number' || planned < 0) throw new TestTypeError('ERR_PLAN_POSITIVE')
    const idx = this[kIndex]++
    this.planned = planned

    this.tap.plan('    ', this.planned, comment)
    // TODO output plan when relevant, don't allow test to finish unless plan is finished (or else timeout)
  }

  async pass (message = 'passed') {
    this[kIncre]()
    const idx = this[kIndex]++
    const type = 'assert'
    const assert = 'pass'
    const ok = true
    const count = this.count
    const explanation = null
    await this.#assert({ type, assert, ok, message, count, explanation, idx })
    return ok
  }

  async fail (message = 'failed') {
    this[kIncre]()
    const idx = this[kIndex]++
    const type = 'assert'
    const assert = 'fail'
    const ok = false
    const count = this.count
    const explanation = explain(ok, message, assert, Test.prototype.fail)
    await this.#assert({ type, assert, ok, message, count, explanation, idx })
    return ok
  }

  async ok (assertion, message = 'expected truthy value') {
    this[kIncre]()
    const idx = this[kIndex]++
    const type = 'assert'
    const assert = 'ok'
    const ok = assertion
    const count = this.count
    const explanation = explain(ok, message, assert, Test.prototype.ok, assertion, true)
    await this.#assert({ type, assert, ok, message, count, explanation, idx })
    return ok
  }

  async absent (assertion, message = 'expected falsey value') {
    this[kIncre]()
    const idx = this[kIndex]++
    const type = 'assert'
    const assert = 'absent'
    const ok = !assertion
    const count = this.count
    const explanation = explain(ok, message, assert, Test.prototype.absent, assertion, false)
    await this.#assert({ type, assert, ok, message, count, explanation, idx })
    return ok
  }

  async is (actual, expected, message = 'should be equal', strict = true) {
    this[kIncre]()
    const idx = this[kIndex]++
    const type = 'assert'
    const assert = 'is'
    const ok = strict ? actual === expected : actual == expected // eslint-disable-line
    const count = this.count
    const explanation = explain(ok, message, assert, Test.prototype.is, actual, expected)
    await this.#assert({ type, assert, ok, message, count, explanation, idx })
    return ok
  }

  async not (actual, expected, message = 'should not be equal', strict = true) {
    this[kIncre]()
    const idx = this[kIndex]++
    const type = 'assert'
    const assert = 'not'
    const ok = strict ? actual !== expected : actual != expected // eslint-disable-line
    const count = this.count
    const explanation = explain(ok, message, assert, Test.prototype.not, actual, expected)
    await this.#assert({ type, assert, ok, message, count, explanation, idx })
    return ok
  }

  async alike (actual, expected, message = 'should deep equal', strict = true) {
    this[kIncre]()
    const idx = this[kIndex]++
    const type = 'assert'
    const assert = 'alike'
    const ok = deepEqual(actual, expected, { strict })
    const count = this.count
    const explanation = explain(ok, message, assert, Test.prototype.alike, actual, expected)
    await this.#assert({ type, assert, ok, message, count, explanation, idx })
    return ok
  }

  async unlike (actual, expected, message = 'should not deep equal', strict = true) {
    this[kIncre]()
    const idx = this[kIndex]++
    const type = 'assert'
    const assert = 'unlike'
    const ok = deepEqual(actual, expected, { strict }) === false
    const count = this.count
    const explanation = explain(ok, message, assert, Test.prototype.unlike, actual, expected)
    await this.#assert({ type, assert, ok, message, count, explanation, idx })
    return ok
  }

  async exception (functionOrPromise, expectedError, message, natives = false) {
    async function exception (functionOrPromise, expectedError, message, natives = false) {
      this[kIncre]()
      const idx = this[kIndex]++
      if (typeof expectedError === 'string') {
        [message, expectedError] = [expectedError, message]
      }
      const top = originFrame(Test.prototype.exception)
      const pristineMessage = message === undefined
      message = pristineMessage ? 'should throw' : message
      const type = 'assert'
      const assert = 'exception'
      const count = this.count
      let syncThrew = true
      let ok = null
      let actual = false
      try {
        if (typeof functionOrPromise === 'function') functionOrPromise = functionOrPromise()
        syncThrew = false
        if (functionOrPromise instanceof Promise && pristineMessage) message = 'should reject'
        await functionOrPromise
        ok = false
      } catch (err) {
        if (syncThrew) await null // tick
        const native = natives === false && (err instanceof SyntaxError ||
        err instanceof ReferenceError ||
        err instanceof TypeError ||
        err instanceof EvalError ||
        err instanceof RangeError)
        if (native) {
          ok = false
          actual = err
        } else {
          if (!expectedError) {
            ok = true
          } else {
            ok = tmatch(err, expectedError)
          }
        }
      }
      const explanation = explain(ok, message, assert, Test.prototype.exception, actual, expectedError, top)
      await this.#assert({ type, assert, ok, message, count, explanation, idx })
      return ok
    }

    return Object.assign(exception.bind(this, functionOrPromise, expectedError, message, natives))
  }

  async execution (functionOrPromise, message) {
    async function execution (functionOrPromise, message) {
      this[kIncre]()
      const idx = this[kIndex]++
      const top = originFrame(Test.prototype.execution)
      const pristineMessage = message === undefined
      message = pristineMessage ? 'should return' : message
      const type = 'assert'
      const assert = 'execution'
      const count = this.count
      let ok = false
      let error = null
      try {
        if (typeof functionOrPromise === 'function') functionOrPromise = functionOrPromise()
        if (functionOrPromise instanceof Promise && pristineMessage) message = 'should resolve'
        await functionOrPromise
        ok = true
      } catch (err) {
        error = err
      }
      const explanation = explain(ok, message, assert, Test.prototype.execution, error, null, top)
      await this.#assert({ type, assert, ok, message, count, explanation, idx })
      return ok
    }

    return execution.bind(this, functionOrPromise, message)
  }

  async snapshot (actual, message = 'should match snapshot') {
    this[kIncre]()
    const idx = this[kIndex]++
    if (actual === undefined) actual = `<${actual}>`
    if (typeof actual === 'symbol') actual = `<${actual.toString()}>`
    if (actual instanceof Error) {
      actual = serializeError(actual)
      delete actual.stack
    }
    const top = originFrame(Test.prototype.snapshot)
    let file = top.getFileName().replace(/\?.+/, '')
    try { file = fileURLToPath(file) } catch {}
    const type = 'assert'
    const assert = 'snapshot'
    const count = this.count
    let ok = true
    let expected = null
    let specName = this.description
    let parent = this.parent
    do {
      if (parent[kMain] === false) specName = `${parent.description} > ${specName}`
    } while (parent = parent.parent) // eslint-disable-line
    const { toJSON } = BigInt.prototype
    BigInt.prototype.toJSON = function () { return this.toString() } // eslint-disable-line
    try {
      ss.core({
        what: actual,
        file: file,
        specName: specName,
        raiser (o) {
          expected = o.expected
          if (deepEqual(o.value, expected) === false) throw new TestError('ERR_SNAPSHOT_MATCH_FAILED')
        },
        ext: '.snapshot.cjs',
        opts: {
          update: main[kSnap] instanceof RegExp ? main[kSnap].test(specName) : main[kSnap],
          useRelativePath: true
        }
      })
    } catch (err) {
      ok = false
      if (err.code !== 'ERR_SNAPSHOT_MATCH_FAILED') this[kError](err)
    } finally {
      BigInt.prototype.toJSON = toJSON // eslint-disable-line
    }
    if (!ok) {
      main.advice.push(`# Snapshot "${specName}" is failing. To surgically update:\n`)
      if (main.runner) {
        main.advice.push({
          specName,
          file: file,
          advice: `# brittle --snap "${specName}" ${process.argv.slice(2).join(' ')}\n`,
          [Symbol.toPrimitive] () { return this.advice }
        })
      } else {
        main.advice.push(`# SNAP="${specName}" node ${file.replace(cwd, '').slice(1)}\n`)
      }
    }
    const explanation = explain(ok, message, assert, Test.prototype.snapshot, actual, expected, top)
    await this.#assert({ type, assert, ok, message, count, explanation, idx })
    return ok
  }

  async comment (message) {
    const idx = this[kIndex]++
    if (this.ended) {
      this[kError](new TestError('ERR_COMMENT_AFTER_END', { description: this.description, comment: message }))
      return
    }
    this.tap.diagnostic('    ', message)
  }


  teardown (fn) {
    if (this.ended || this[kEnding]) {
      this[kError](new TestError('ERR_TEARDOWN_AFTER_END'))
    }
    this[kTeardowns].push(fn)
  }

  timeout (ms) {
    clearTimeout(this[kTimeout])
    Object.defineProperties(this, {
      [kTimeout]: {
        configurable: true,
        writable: true,
        value: setTimeout(() => {
          this[kError](new TestError('ERR_TIMEOUT', { ms }))
        }, ms)
      }
    })
    this[kTimeout].unref()
  }
}

function originFrame (stackStartFunction) {
  const { prepareStackTrace } = Error
  Error.prepareStackTrace = (_, stack) => {
    if (stack[0].getFunctionName() === '[brittle.error]') return null
    if (stack[0].getMethodName() === 'coercively') return stack[1]
    return stack[0]
  }
  const err = {}
  Error.captureStackTrace(err, stackStartFunction)
  const { stack: top } = err
  Error.prepareStackTrace = prepareStackTrace
  return top
}

function explain (ok, message, assert, stackStartFunction, actual, expected, top = !ok && originFrame(stackStartFunction), extra) {
  if (ok) return null

  const err = new AssertionError({ stackStartFunction, message, operator: assert, actual, expected })
  stackScrub(err)
  if (top) {
    err.at = {
      line: top.getLineNumber(),
      column: top.getColumnNumber(),
      file: top.getFileName()?.replace(/\?cacheBust=\d+/g, '')
    }
    try {
      let file = err.at.file
      try { file = fileURLToPath(new URL(err.at.file, 'file:')) } catch {}
      const code = readFileSync(file, { encoding: 'utf-8' })
      const split = code.split(/[\n\r]/g)
      const point = Array.from({ length: err.at.column - 1 }).map(() => '-').join('') + '^'
      const source = [...split.slice(err.at.line - 2, err.at.line), point, ...split.slice(err.at.line, err.at.line + 2)]
      err.source = source.join('\n')
    } /* c8 ignore next */ catch {}
  }
  const { code, generatedMessage, ...info } = err
  err.code = code
  err.generatedMessage = generatedMessage
  Object.defineProperty(info, 'err', { value: err })
  info.stack = err.stack.split('\n').slice(1).map((line) => {
    let match = false
    line = line.slice(7).replace(cwd, () => {
      match = true
      return ''
    })
    if (match) line = line.replace(/file:\/?\/?\/?/, '')
    return line
  }).join('\n').trim()

  if (!info.stack || code === 'ERR_TIMEOUT' || code === 'ERR_PREMATURE_END' || actual?.code === 'ERR_TIMEOUT' || actual?.code === 'ERR_PREMATURE_END') delete info.stack

  if (actual === undefined && expected === undefined) {
    delete info.actual
    delete info.expected
  }
  return info
}

class PromiseQueue extends Array {
  constructor ({ concurrency } = {}) {
    super()
    this.concurrency = concurrency
    this.pending = 0
    this.jobs = []
    // queueMicrotask()
    this.drain()
  }

  setConcurrency (concurrency) {
    this.concurrency = concurrency
    this.drain()
  }

  async empty () {
    if (this.pending === 0) return
    if (this.length === 0) return
    do {
      await Promise.allSettled(this)
    } while (this.pending > 0)
  }

  add (fn) {
    return new Promise((resolve, reject) => {
      const run = async () => {
        this.pending++
        try { resolve(await fn()) } catch (err) { reject(err) }
        this.pending--
        this.next()
      }
      this.jobs.push(run)
      this.next()
    })
  }

  next () {
    if (this.jobs.length === 0) return false
    if (this.pending >= this.concurrency) return false
    const run = this.jobs.shift()
    if (!run) return false
    this.push(run())
    return true
  }

  drain () {
    while (this.next()) {} // eslint-disable-line
  }
}

const main = new Test()
if (SOLO) main.solo()
module.exports = main.test.bind(main)
module.exports.skip = main.skip.bind(main)
module.exports.solo = main.solo.bind(main)
module.exports.todo = main.todo.bind(main)
module.exports.configure = main.configure.bind(main)
module.exports.test = module.exports
module.exports[kMain] = main
