const test = require('../../')
const { tester, spawner } = require('../helpers')

test(async function (t) {
  await tester(t, 'assert after end',
    async function (t) {
      t.pass()
      t.end()
      t.pass()
    },
    `
    TAP version 13

    # assert after end
        ok 1 - passed
    ok 1 - assert after end # time = 0.762984ms
        ok 2 - passed
    not ok 2 - assertion after end (in assert after end)

    1..2
    # tests = 1/2 pass
    # asserts = 2/2 pass
    # time = 3.777711ms

    # not ok
    `,
    { exitCode: 0 }
  )
})

test(async function (t) {
  await spawner(t,
    function () {
      const t = test('assert after end')
      t.pass()
      t.end()
      t.pass()
    },
    `
    # assert after end
    ok 1 - passed
    ok 1 - assert after end # time = 0.757493ms
        ok 2 - passed
    not ok 2 - assertion after end (in assert after end)

    1..2
    # tests = 1/2 pass
    # asserts = 2/2 pass
    # time = 3.322585ms

    # not ok
    `,
    { exitCode: 0 }
  )
})
