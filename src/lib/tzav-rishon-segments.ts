export type Segment = { type: 'text' | 'math'; content: string }

// Characters that, once a math run has started (triggered by a `\` command),
// keep the run going while at brace-depth 0. Anything else (Hebrew, Arabic,
// parens, quotes, sentence punctuation) ends the run — a whitelist rather
// than a blacklist, so unexpected characters fail safe (end the run early,
// producing two adjacent segments that still render correctly) instead of
// silently swallowing prose into a formula.
const MATH_CONTINUE = /[0-9a-zA-Z.,+\-=*/<>%^_\s]/

/**
 * Splits a string that mixes Hebrew/Arabic prose with bare LaTeX (no
 * `$...$` delimiters, e.g. "יש \displaystyle 100 תלמידים") into alternating
 * text/math segments. Shared between the one-time xlsx conversion script
 * and the content-patches module (both need identical splitting behavior).
 * No dependency on any data — safe to import from anywhere, including tests.
 */
export function splitSegments(raw: string): Segment[] {
  const segments: Segment[] = []
  let i = 0
  let textBuf = ''

  function flushText() {
    if (textBuf) {
      segments.push({ type: 'text', content: textBuf })
      textBuf = ''
    }
  }

  function pushMath(content: string) {
    // Trailing whitespace inside the run is handed back to the following
    // text segment so visible spacing doesn't depend on how KaTeX handles
    // trailing whitespace in rendered math.
    const trimmed = content.replace(/\s+$/, '')
    const trailingWs = content.slice(trimmed.length)
    // A handful of source cells have a bare "%" (percent sign) instead of
    // the escaped "\%" used everywhere else — in real LaTeX (and KaTeX) an
    // unescaped "%" starts a comment that silently swallows the rest of the
    // line, which would drop the "%" glyph (and anything after it) from
    // what's rendered. Auto-escape any "%" not already preceded by "\".
    const escaped = trimmed.replace(/(^|[^\\])%/g, '$1\\%')
    if (escaped) segments.push({ type: 'math', content: escaped })
    if (trailingWs) textBuf += trailingWs
  }

  // Consumes from the current position `i` while at brace-depth 0 the
  // character is a math-continuation character; brace contents (depth>0)
  // are always protected regardless of what's inside (needed for
  // \text{סכום כל המספרים} etc.). A `}` seen at depth 0 isn't ours — it
  // belongs to an outer context — so the run ends there instead of
  // swallowing a stray closer.
  function captureBraceAwareRun(startBuf: string): string {
    let buf = startBuf
    let depth = 0
    while (i < raw.length) {
      const c = raw[i]
      if (c === '{') {
        depth++
        buf += c
        i++
        continue
      }
      if (c === '}') {
        if (depth === 0) break
        depth--
        buf += c
        i++
        continue
      }
      if (depth > 0) {
        buf += c
        i++
        continue
      }
      if (c === '\\' || MATH_CONTINUE.test(c)) {
        buf += c
        i++
        continue
      }
      break
    }
    return buf
  }

  while (i < raw.length) {
    const ch = raw[i]

    // Dollar-delimited math (rare — e.g. "سم$^2$" for cm²), a different
    // convention than the rest of the dataset's bare backslash commands.
    if (ch === '$') {
      const close = raw.indexOf('$', i + 1)
      if (close !== -1) {
        flushText()
        pushMath(raw.slice(i + 1, close))
        i = close + 1
        continue
      }
      // Unmatched $ — fall through and treat it as plain text.
    }

    // \(...\) inline-math delimiters (rare — one occurrence in the dataset,
    // e.g. "השינוי היה: \(38-y\)."), a third convention alongside bare
    // backslash commands and $...$. Without this, `\(` would be misread as
    // a lone backslash command (KaTeX parse error: a bare "\" isn't valid).
    if (ch === '\\' && raw[i + 1] === '(') {
      const close = raw.indexOf('\\)', i + 2)
      if (close !== -1) {
        flushText()
        pushMath(raw.slice(i + 2, close))
        i = close + 2
        continue
      }
      // Unmatched \( — fall through to the general backslash-command handling.
    }

    if (ch === '\\') {
      flushText()
      i++
      pushMath(captureBraceAwareRun('\\'))
      continue
    }

    // Bare ^/_ with no preceding backslash (e.g. "5t^2", "v_{\text{...}}").
    // Guarded against "___" blank-line placeholders in question text —
    // those are runs of 2+ underscores, not LaTeX, and must stay plain text.
    if ((ch === '^' || ch === '_') && raw[i - 1] !== ch && raw[i + 1] !== ch) {
      let base = ''
      if (textBuf && /[0-9a-zA-Z]/.test(textBuf[textBuf.length - 1])) {
        base = textBuf[textBuf.length - 1]
        textBuf = textBuf.slice(0, -1)
      }
      flushText()
      i++
      pushMath(captureBraceAwareRun(base + ch))
      continue
    }

    textBuf += ch
    i++
  }
  flushText()
  return segments
}
