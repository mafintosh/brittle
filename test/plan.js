const test = require('../')
const { spawner, tester } = require('./helpers')

test(async function (t) {
  await tester(t, 'plan must be positive',
    function (t) {
      t.plan(-1)
    },
    `
    TAP version 13
    not ok 1 - plan takes a positive whole number only
    ---
    operator: plan
    at:
    line: 4
    column: 9
    stack: |
    ...
    not ok 1 - plan must be positive
    1..1
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
    not ok 1 - plan takes a positive whole number only
    ---
    operator: plan
    at:
    line: 4
    column: 11
    stack: |
    ...
    not ok 1 - plan must be integer
    not ok 1 - plan takes a positive whole number only
    ---
    operator: plan
    at:
    line: 8
    column: 11
    stack: |
    ...
    not ok 2 - plan must be positive
    1..2
    `
  )
})
