const test = require('../')
const { tester, spawner } = require('./helpers')

test(async function (t) {
  await tester(t, 'plan must be positive',
    function (t) {
      // t.fail('not correct')
      t.plan(-1)
    },
    `
    TAP version 13

    # plan must be positive
        not ok 1 - plan takes a positive whole number only
          ---
          operator: plan
          at: 
            line: 5
            column: 9
            file: /[eval]
          stack: |
            [eval]:5:9
            processTicksAndRejections (node:internal/process/task_queues:96:5)
          ...
    not ok 1 - plan must be positive # time = 4.043233ms

    1..1
    # tests = 0/1 pass
    # asserts = 0/1 pass
    # time = 7.180862ms

    # not ok
    `
  )
})

test(async function (t) {
  await spawner(t,
    function () {
      test('plan must be integer', function (t) {
        t.plan('x')
      })

      test('plan must be positive', function (t) {
        t.plan(-1)
      })
    },
    `
    TAP version 13

    # plan must be integer
        not ok 1 - plan takes a positive whole number only
          ---
          operator: plan
          at: 
            line: 4
            column: 11
            file: /[eval]
          stack: |
            [eval]:4:11
            processTicksAndRejections (node:internal/process/task_queues:96:5)
          ...
    not ok 1 - plan must be integer # time = 4.137088ms

    # plan must be positive
        not ok 1 - plan takes a positive whole number only
          ---
          operator: plan
          at: 
            line: 8
            column: 11
            file: /[eval]
          stack: |
            [eval]:8:11
            processTicksAndRejections (node:internal/process/task_queues:96:5)
          ...
    not ok 2 - plan must be positive # time = 0.359364ms

    1..2
    # tests = 0/2 pass
    # asserts = 0/2 pass
    # time = 8.126944ms

    # not ok
    `
  )
})
