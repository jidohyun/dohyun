/**
 * Hook drift 검사: `.claude/settings.json` 의 hooks 블록이
 * `.claude/settings.template.json` 과 일치하는지 검사한다.
 *
 * 본 모듈은 doctor (`scripts/doctor.ts`) 가 사용하는 순수 함수들을 모아
 * 단위 테스트 가능한 표면으로 분리한다 (M2.2.c).
 *
 * 검사 항목:
 *   1. event 이름 차집합 — template 에 있는데 settings 에 없는 event
 *   2. command drift — 같은 event 의 command 가 template 과 다름
 *   3. matcher drift — 같은 event 의 matcher 가 template 과 다름
 *
 * `{{DOHYUN_ROOT}}` placeholder 는 비교 직전에 `opts.dohyunRoot` 로 치환된다.
 * settings 가 없거나 hooks 블록이 비어 있으면 모든 expected event 가
 * `missingEvents` 에 들어간다.
 */

export type HookEvent = string

export interface HookCommandEntry {
  type?: string
  command?: string
}

export interface HookMatcherEntry {
  matcher?: string
  hooks?: HookCommandEntry[]
}

export interface SettingsHooksBlock {
  hooks?: Record<HookEvent, HookMatcherEntry[]>
}

export interface CompareHooksOptions {
  /**
   * `{{DOHYUN_ROOT}}` placeholder 를 치환할 절대 경로.
   * 미지정 시 placeholder 를 그대로 비교 (대부분의 settings 와 어긋남).
   */
  dohyunRoot?: string
}

export interface CommandDrift {
  event: HookEvent
  expected: string
  actual: string
}

export interface MatcherDrift {
  event: HookEvent
  expected: string
  actual: string
}

export interface HookDriftReport {
  /** 모든 검사가 통과하면 true */
  ok: boolean
  /** template 에 있으나 settings 에 누락된 event 이름들 */
  missingEvents: HookEvent[]
  /** template 의 command 와 settings 의 command 가 다른 경우들 */
  commandDrifts: CommandDrift[]
  /** template 의 matcher 와 settings 의 matcher 가 다른 경우들 */
  matcherDrifts: MatcherDrift[]
}

const PLACEHOLDER = '{{DOHYUN_ROOT}}'

function substitute(s: string, dohyunRoot: string | undefined): string {
  if (!dohyunRoot) return s
  return s.split(PLACEHOLDER).join(dohyunRoot)
}

function firstMatcherEntry(entries: HookMatcherEntry[] | undefined): HookMatcherEntry | undefined {
  if (!entries || entries.length === 0) return undefined
  return entries[0]
}

function firstCommand(entry: HookMatcherEntry | undefined): string | undefined {
  return entry?.hooks?.[0]?.command
}

/**
 * settings 와 template 의 hooks 블록을 비교한다.
 * 입력은 둘 다 이미 파싱된 JSON 이며, null 은 "파일 없음" 을 의미.
 */
export function compareHooks(
  settings: SettingsHooksBlock | null,
  template: SettingsHooksBlock | null,
  opts: CompareHooksOptions = {},
): HookDriftReport {
  const settingsHooks = settings?.hooks ?? {}
  const templateHooks = template?.hooks ?? {}
  const settingsEvents = Object.keys(settingsHooks)
  const templateEvents = Object.keys(templateHooks).length > 0
    ? Object.keys(templateHooks)
    : ['SessionStart', 'PreToolUse', 'Stop']

  const missingEvents = templateEvents.filter(e => !settingsEvents.includes(e))

  const commandDrifts: CommandDrift[] = []
  const matcherDrifts: MatcherDrift[] = []

  for (const event of templateEvents) {
    if (missingEvents.includes(event)) continue

    const tplEntry = firstMatcherEntry(templateHooks[event])
    const setEntry = firstMatcherEntry(settingsHooks[event])
    if (!tplEntry || !setEntry) continue

    const expectedCommand = substitute(firstCommand(tplEntry) ?? '', opts.dohyunRoot)
    const actualCommand = firstCommand(setEntry) ?? ''
    if (expectedCommand !== actualCommand) {
      commandDrifts.push({ event, expected: expectedCommand, actual: actualCommand })
    }

    const expectedMatcher = tplEntry.matcher ?? ''
    const actualMatcher = setEntry.matcher ?? ''
    if (expectedMatcher !== actualMatcher) {
      matcherDrifts.push({ event, expected: expectedMatcher, actual: actualMatcher })
    }
  }

  return {
    ok: missingEvents.length === 0 && commandDrifts.length === 0 && matcherDrifts.length === 0,
    missingEvents,
    commandDrifts,
    matcherDrifts,
  }
}
