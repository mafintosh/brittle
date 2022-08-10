const test = require('../')
const { spawner, tester, standardizeTap } = require('./helpers')

test(async function (t) {
  const std = await spawner(function () {
    test('plan must be integer', function (t) {
      t.plan('x')
    })

    test('plan must be positive', function (t) {
      t.plan(-1)
    })
  })

  t.is(std.stderr, '')
  t.is(std.stdout, standardizeTap(`
  TAP version 13
    not ok 1 - plan takes a positive whole number only
      ---
      operator: plan
      at:
        line: 4
        column: 9
        file: /[eval]
      stack: |
        [eval]:4:9
      ...
  not ok 1 - plan must be integer
      not ok 1 - plan takes a positive whole number only
        ---
        operator: plan
        at:
          line: 8
          column: 9
          file: /[eval]
        stack: |
          [eval]:8:9
          processTicksAndRejections (node:internal/process/task_queues:96:5)
        ...
  not ok 2 - plan must be positive
  1..2
  `))

  t.pass()
})

test(async function (t) {
  const std = await tester('plan must be positive', function (t) {
    t.plan(-1)
  })

  t.is(std.stderr, '')
  t.is(std.stdout, standardizeTap(`
  TAP version 13
    not ok 1 - plan takes a positive whole number only
      ---
      operator: plan
      at:
        line: 4
        column: 7
        file: /[eval]
      stack: |
        [eval]:4:7
      ...
  not ok 1 - plan must be positive
  1..1
  `))

  t.pass()
})
