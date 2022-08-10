const test = require('../')
const { spawner } = require('./helpers')

test(async function (t) {
  const std = await spawner(() => {
    test('plan must be positive', function (t) {
      t.plan(-1)
    })
  })

  t.ok(std.stdout.indexOf('not ok 1 - plan takes a positive whole number only') > -1)
  t.is(std.stderr, undefined)
  t.pass()
})
