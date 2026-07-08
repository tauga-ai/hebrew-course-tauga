import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitSegments } from '../src/lib/tzav-rishon-segments'

test('splitSegments: plain Hebrew text with no math stays one text segment', () => {
  const segs = splitSegments('בבית הספר יש מאה תלמידים')
  assert.deepEqual(segs, [{ type: 'text', content: 'בבית הספר יש מאה תלמידים' }])
})

test('splitSegments: a bare \\displaystyle number is isolated from surrounding Hebrew', () => {
  const segs = splitSegments('יש \\displaystyle 100 תלמידים')
  assert.deepEqual(segs, [
    { type: 'text', content: 'יש ' },
    { type: 'math', content: '\\displaystyle 100' },
    { type: 'text', content: ' תלמידים' },
  ])
})

test('splitSegments: \\text{} inside a formula protects embedded Hebrew from ending the run', () => {
  const segs = splitSegments('נוסחה: \\frac{\\text{סכום}}{\\text{כמות}} = תוצאה')
  assert.deepEqual(segs, [
    { type: 'text', content: 'נוסחה: ' },
    { type: 'math', content: '\\frac{\\text{סכום}}{\\text{כמות}} =' },
    { type: 'text', content: ' תוצאה' },
  ])
})

test('splitSegments: bare subscript with a Latin base (v_{...}) is captured as one math run, not split mid-brace', () => {
  const segs = splitSegments('המהירות: v_{\\text{ממוצעת}} = 48')
  assert.deepEqual(segs, [
    { type: 'text', content: 'המהירות: ' },
    { type: 'math', content: 'v_{\\text{ממוצעת}} = 48' },
  ])
})

test('splitSegments: bare superscript with no backslash (5t^2) pulls back only the single-character base', () => {
  const segs = splitSegments('הדרך היא 5t^2 . נתון')
  assert.deepEqual(segs, [
    { type: 'text', content: 'הדרך היא 5' },
    { type: 'math', content: 't^2 .' },
    { type: 'text', content: ' נתון' },
  ])
})

test('splitSegments: a run of underscores (blank-line placeholder) is never treated as a subscript trigger', () => {
  const segs = splitSegments('b שווה ל-___ אחוזים מ- a')
  assert.deepEqual(segs, [{ type: 'text', content: 'b שווה ל-___ אחוזים מ- a' }])
})

test('splitSegments: dollar-delimited math ($^2$) is recognized as an alternative math delimiter', () => {
  const segs = splitSegments('שטח 100 سم$^2$ ומ')
  assert.deepEqual(segs, [
    { type: 'text', content: 'שטח 100 سم' },
    { type: 'math', content: '^2' },
    { type: 'text', content: ' ומ' },
  ])
})

test('splitSegments: a stray closing brace at depth 0 ends the run instead of being swallowed', () => {
  // Simulates what would happen if a run somehow started mid-expression —
  // the run must stop at the unmatched `}` rather than consuming it.
  const segs = splitSegments('\\frac{1}{2}} שאר')
  assert.deepEqual(segs, [
    { type: 'math', content: '\\frac{1}{2}' },
    { type: 'text', content: '} שאר' },
  ])
})

test('splitSegments: \\(...\\) inline-math delimiters are recognized as a third math convention', () => {
  const segs = splitSegments('השינוי היה: \\(38-y\\). לכן')
  assert.deepEqual(segs, [
    { type: 'text', content: 'השינוי היה: ' },
    { type: 'math', content: '38-y' },
    { type: 'text', content: '. לכן' },
  ])
})

test('splitSegments: a bare (unescaped) percent sign is auto-escaped, since unescaped "%" starts a LaTeX comment', () => {
  const segs = splitSegments('הוכפל ב־\\displaystyle 300% . מה')
  assert.deepEqual(segs, [
    { type: 'text', content: 'הוכפל ב־' },
    { type: 'math', content: '\\displaystyle 300\\% .' },
    { type: 'text', content: ' מה' },
  ])
})

test('splitSegments: an already-escaped percent sign is left untouched (not double-escaped)', () => {
  const segs = splitSegments('\\displaystyle 92\\% תקינים')
  assert.deepEqual(segs, [
    { type: 'math', content: '\\displaystyle 92\\%' },
    { type: 'text', content: ' תקינים' },
  ])
})

test('splitSegments: \\left(...\\right) parses as one run, not two dangling delimiter commands', () => {
  const segs = splitSegments('פשטו: 4 + 2 \\cdot \\left(\\frac{6}{8} + \\frac{3}{4}\\right) - 5')
  assert.deepEqual(segs, [
    { type: 'text', content: 'פשטו: 4 + 2 ' },
    { type: 'math', content: '\\cdot \\left(\\frac{6}{8} + \\frac{3}{4}\\right) - 5' },
  ])
})

test('splitSegments: the \\; spacing macro does not leave a dangling backslash', () => {
  const segs = splitSegments('נחשב: 2 \\;+\\; 3 \\;=\\; 5 . סיום')
  assert.deepEqual(segs, [
    { type: 'text', content: 'נחשב: 2 ' },
    { type: 'math', content: '\\;+\\; 3 \\;=\\; 5 .' },
    { type: 'text', content: ' סיום' },
  ])
})

test('splitSegments: trailing whitespace inside a captured run is handed back to the following text segment', () => {
  const segs = splitSegments('\\displaystyle 30\\% . הבא')
  assert.equal(segs[0].type, 'math')
  assert.ok(!segs[0].content.endsWith(' '), 'math segment should not end with whitespace')
  assert.equal(segs[1].type, 'text')
  assert.ok(segs[1].content.startsWith(' '), 'trailing whitespace should be handed to the text segment')
})
