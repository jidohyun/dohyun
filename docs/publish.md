# Publishing dohyun to npm

dohyun은 `@jidohyun/dohyun` 스코프 하에 npm에 공개 배포된다. 이 문서는 재배포 절차를 기록한다. 첫 배포는 v0.7.1 (2026-04).

## 사전 점검

```bash
npm whoami                     # jidohyun 이어야 함
npm run build                  # 경고 0건
npm test                       # 전부 GREEN
git status                     # dirty 없음, HEAD = main
```

## 배포 절차

1. **Version bump**
   ```bash
   npm version <patch|minor|major> --no-git-tag-version
   ```
   patch: 버그 수정, minor: 기능 추가, major: 파괴적 변경.

2. **CHANGELOG 작성**
   `CHANGELOG.md`에 새 섹션을 추가한다. Keep a Changelog 형식:
   ```markdown
   ## [X.Y.Z] - YYYY-MM-DD

   ### Added
   - 기능
   ### Fixed
   - 버그
   ```

3. **커밋 + 태그**
   ```bash
   git add CHANGELOG.md package.json package-lock.json
   git commit -m "chore(release): X.Y.Z — <summary>"
   git tag vX.Y.Z
   ```

4. **Dry-run으로 패키지 내용 확인**
   ```bash
   npm pack --dry-run
   ```
   - dist/, skills/, .claude/commands/, docs/, prompts/, CLAUDE.md, README.md, LICENSE 모두 포함되어야 한다.
   - `.dohyun/`, `node_modules/`, `.env`, `.git/`, `.DS_Store`, `*.log`는 없어야 한다.
   - 크기는 보통 500KB 이내.

5. **Publish**
   ```bash
   npm publish --access public --dry-run   # 최종 검증
   npm publish --access public             # 실배포
   ```

6. **Push + 검증**
   ```bash
   git push origin main --tags
   npm view @jidohyun/dohyun version         # 방금 올린 버전이 보여야 함

   # fresh dir에서 설치 검증
   cd /tmp && mkdir dohyun-install-test && cd dohyun-install-test
   npx @jidohyun/dohyun --version
   ```

## Unpublish 정책

npm은 72시간 내 unpublish만 허용하며, 스코프 패키지는 더 엄격하다.
- 실수 배포 발견 시 즉시 `npm unpublish @jidohyun/dohyun@X.Y.Z` 시도.
- 그 이상 시간이 흘렀으면 deprecate: `npm deprecate @jidohyun/dohyun@X.Y.Z "reason"` 후 patch 버전 재배포.

## 패키지 메타데이터

`package.json`의 주요 필드:
- `"name": "@jidohyun/dohyun"` — scoped package
- `"publishConfig": { "access": "public" }` — scoped 기본은 private이므로 명시
- `"files": [...]` — tarball에 포함될 항목 whitelist
- `"bin": { "dohyun": "dist/src/cli/index.js" }` — `npx dohyun` 및 글로벌 설치 후 `dohyun` 명령
- `"prepublishOnly": "npm run test"` — publish 직전 테스트 자동 실행

## 프로젝트 적용 (소비자 관점)

새 repo에서:
```bash
npm install -g @jidohyun/dohyun
dohyun setup
dohyun status
```

또는 1회성으로:
```bash
npx @jidohyun/dohyun setup
```
