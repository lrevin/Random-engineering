# 뽑공 저장소 작업 안내 (AI 도구용)

작업을 시작하기 전에 **[docs/TEAM_RULES.md](docs/TEAM_RULES.md)를 먼저 읽고 그대로 따릅니다.** 팀 전체가 같은 규칙을 씁니다.

꼭 지킬 것:
- 기준 브랜치는 `develop`입니다. 새 작업은 `develop`에서 `feature/*` 브랜치를 따서 합니다.
- DB 변경은 `api/mysql/migrations/`에 Flyway 새 파일(`V<다음번호>__*.sql`)로만 합니다. 기존 V 파일은 고치지 않습니다.
- 재화·보상·권한은 서버에서만 지급하고 검증합니다. 앱이 보낸 값을 믿지 않습니다.
- 기기 저장 키는 `app/src/lib/local-data.ts`의 `LOCAL_KEYS`에 등록합니다.
- UI에 이모지를 쓰지 않습니다. 아이콘은 `app/src/components/Icon.tsx`를 씁니다.
- 비밀값(.env, 키)을 읽거나 커밋하지 않습니다.
- 올리기 전 검사:
  - 앱: `cd app && npx tsc --noEmit && npx eslint src && npm test`
  - 서버: `cd api/server && npm test`
- 주석, 문서, 커밋 메시지는 한국어로 씁니다.
