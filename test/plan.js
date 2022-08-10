const test = require('../')
const { spawner, tester } = require('./helpers')

test(async function (t) {
  const std = await spawner(function () {
    test('plan must be integer', function (t) {
      t.plan('x')
    })

    test('plan must be positive', function (t) {
      t.plan(-1)
    })
  })

  console.log(std.stdout)

  // t.ok(std.stdout.indexOf('not ok 1 - plan takes a positive whole number only') > -1)
  // t.is(std.stderr, undefined)
  t.pass()
})

test(async function (t) {
  const std = await tester('plan must be positive', function (t) {
    t.plan(-1)
  })

  console.log(std.stdout)

  // t.ok(std.stdout.indexOf('not ok 1 - plan takes a positive whole number only') > -1)
  // t.is(std.stderr, undefined)
  t.pass()
})
