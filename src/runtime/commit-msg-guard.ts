/**
 * commit-msg hook guard — phase marker 강제 (AGENT.md 9, SYSTEM-DESIGN 외부 결정)
 *
 * 정규식: <type>[<phase>]: <description>
 * - type:  feat | fix | refactor | docs | test | chore | perf | ci  (8 종 — `infra` 드롭)
 * - phase: red | green | refactor | structural | behavioral | chore (6 종)
 *
 * Pure function — 부수효과 없음. CLI handler 가 결과를 받아 stderr 출력 + exit code 결정.
 */

const TYPES = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'ci'] as const
const PHASES = ['red', 'green', 'refactor', 'structural', 'behavioral', 'chore'] as const

const PATTERN = /^(feat|fix|refactor|docs|test|chore|perf|ci)\[(red|green|refactor|structural|behavioral|chore)\]: .+$/

export interface CheckResult {
  readonly ok: boolean
  readonly title: string
  readonly reason?: string
}

/**
 * 메시지 본문에서 첫 번째 비주석 · 비공백 줄을 제목으로 추출하고 정규식 검증.
 * git commit-msg hook 컨텍스트의 `#` 안내문 줄은 제외 (chazm check-commit-msg.sh:37-39 와 동일).
 */
export function checkCommitMessage(message: string): CheckResult {
  const lines = message.split(/\r?\n/)
  let title = ''
  for (const line of lines) {
    if (line.startsWith('#')) continue
    if (line.trim() === '') continue
    title = line
    break
  }

  if (title === '') {
    return { ok: false, title: '', reason: 'empty subject line' }
  }

  if (PATTERN.test(title)) {
    return { ok: true, title }
  }

  return { ok: false, title, reason: 'subject does not match required format' }
}

/**
 * Reject 메시지 — stderr 에 출력될 사용자용 안내.
 * chazm check-commit-msg.sh:63-82 와 동등 형식, infra 예시 제거.
 */
export function rejectMessage(result: CheckResult): string {
  const got = result.title === '' ? '(empty)' : result.title
  return [
    '✗ commit-msg: subject line does not match required format',
    '',
    `  Got:      ${got}`,
    '  Expected: <type>[<phase>]: <description>',
    '',
    `  type:     ${TYPES.join(' | ')}`,
    `  phase:    ${PHASES.join(' | ')}`,
    '            (TDD 사이클 마커 OR Tidy First 마커, 정확히 하나)',
    '',
    '  Examples:',
    '    test[red]: add failing test for breath gate fix counter',
    '    feat[green]: count fix tasks toward featuresSinceTidy',
    '    refactor[refactor]: extract countSealedFeatures helper',
    '    docs[structural]: AGENT.md 9 phase marker 표 추가',
    '    chore[chore]: bump @types/node',
    '',
    '  See AGENT.md 9 (Commit & PR Guidelines) for full rules.',
  ].join('\n')
}

/**
 * `[red]` advisory — staged 파일이 test 패턴 외에 있으면 경고. commit 자체는 허용.
 * chazm AGENT.md 9.6 advisory 와 동등. infra placeholder 예외는 dohyun 에서 의미 없으므로 제거.
 */
const TEST_PATTERNS = [
  /^tests?\//,
  /\.test\.(mjs|ts|tsx|js|jsx|cjs)$/,
  /\.test\.sh$/,
]

export function isTestFile(path: string): boolean {
  return TEST_PATTERNS.some((re) => re.test(path))
}

export function nonTestStagedFiles(stagedPaths: readonly string[]): readonly string[] {
  return stagedPaths.filter((p) => !isTestFile(p))
}
