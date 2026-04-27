/**
 * backlog-next — `dohyun status` 의 "Next up" 섹션 신호원.
 *
 * backlog.md 의 §2 Now / §3 Next 첫 항목을 markdown 파싱으로 추출.
 * 세션 진입 마찰 완화 (M2.5 후속 dogfood 발견) — 사용자가 backlog 를
 * 직접 다시 읽지 않아도 다음 task 후보를 안내한다.
 *
 * Pure parser — I/O 없음. 호출자가 fs.readFileSync 로 markdown 을 읽어 전달.
 */

export interface NextUp {
  /** 백틱으로 감싼 task ID (예: `M3.5.b`). 없으면 null (ad-hoc 카드). */
  id: string | null
  /** 카드 한 줄 설명. ID 와 우선순위 라벨을 제거한 본문. */
  title: string | null
  /** 어느 섹션에서 추출됐는지. 둘 다 비면 null. */
  section: 'now' | 'next' | null
}

const NOW_HEADER = /^##\s*2\.\s*Now/
const NEXT_HEADER = /^##\s*3\.\s*Next/
const SECTION_BREAK = /^---\s*$/
// 카드 행: "- 🔥 ..." (Now) 또는 "- 🟢 ..." (Next)
const NOW_CARD = /^-\s*🔥\s*(.+)$/
const NEXT_CARD = /^-\s*🟢\s*(.+)$/

/**
 * 카드 본문에서 ID 와 설명을 분리.
 * ID 는 카드의 *맨 앞* 백틱만 인정 — 본문 안의 inline code 는 무시.
 * (예: "ad-hoc — `dohyun status` 끝에 ..." 는 ID 없음.)
 */
function extractCard(body: string): { id: string | null; title: string } {
  const leadingId = /^`([^`]+)`/.exec(body)
  const id = leadingId ? leadingId[1] : null
  const afterId = leadingId ? body.slice(leadingId[0].length) : body
  const title = afterId
    .replace(/\(P\d+\)/g, '')
    .replace(/^[\s—\-:]+/, '')
    .trim()
  return { id, title }
}

export function parseNextUp(markdown: string): NextUp {
  if (!markdown) return { id: null, title: null, section: null }

  const lines = markdown.split(/\r?\n/)
  let nowFirst: string | null = null
  let nextFirst: string | null = null
  let inNow = false
  let inNext = false

  for (const line of lines) {
    if (NOW_HEADER.test(line)) {
      inNow = true
      inNext = false
      continue
    }
    if (NEXT_HEADER.test(line)) {
      inNow = false
      inNext = true
      continue
    }
    // 다음 섹션 진입 (## 4. ... 등) 시 모두 종료.
    if (/^##\s*\d/.test(line) && !NOW_HEADER.test(line) && !NEXT_HEADER.test(line)) {
      inNow = false
      inNext = false
      continue
    }
    // --- 구분선은 섹션을 닫지 않음 (다음 헤더가 닫음).
    if (SECTION_BREAK.test(line)) continue

    if (inNow && nowFirst === null) {
      const m = NOW_CARD.exec(line)
      if (m) nowFirst = m[1]
    }
    if (inNext && nextFirst === null) {
      const m = NEXT_CARD.exec(line)
      if (m) nextFirst = m[1]
    }
  }

  if (nowFirst) {
    const { id, title } = extractCard(nowFirst)
    return { id, title: title || null, section: 'now' }
  }
  if (nextFirst) {
    const { id, title } = extractCard(nextFirst)
    return { id, title: title || null, section: 'next' }
  }
  return { id: null, title: null, section: null }
}
