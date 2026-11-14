# 카카오 로그인 설정

앱은 카카오 SDK 없이 **서버를 거쳐** 카카오 로그인을 합니다. 카카오 키는 서버 `.env`에만 두고 앱에는 넣지 않습니다.

## 흐름

1. 앱이 무작위 `verifier`를 만들고 `challenge = SHA256(verifier)`를 붙여 브라우저로 `GET /auth/kakao/start?challenge=…`를 엽니다.
2. 서버는 challenge를 서명해 넣은 `state`와 함께 카카오 로그인 화면(`kauth.kakao.com/oauth/authorize`)으로 보냅니다.
3. 로그인이 끝나면 카카오가 `GET /auth/kakao/callback?code&state`로 돌아옵니다. 서버가 하는 일:
   - `code`를 카카오 토큰으로 바꾸고, `/v2/user/me`에서 회원번호를 받습니다.
   - `auth_identities`의 `provider='kakao'` 행으로 계정을 찾습니다. 없으면 새로 만듭니다.
   - 우리 세션을 **60초짜리 일회용 코드**로 보관한 뒤 `ppobgong://auth/kakao?code=…`로 앱에 돌려보냅니다.
4. 앱이 `POST /auth/kakao/exchange {code, verifier}`를 보내면 accessToken과 refreshToken을 받습니다. 이후 동작은 이메일 로그인과 같습니다.

이렇게 나눈 이유:
- verifier가 있어야 세션을 받을 수 있습니다. 그래서 다른 앱이 `ppobgong://` 주소를 가로채도 세션을 가져갈 수 없습니다.
- 같은 이메일의 기존 이메일 계정과는 자동으로 합치지 않습니다. 계정 가로채기를 막기 위해서입니다.
- DB 구조는 바뀌지 않습니다. V1에 이미 `provider IN ('kakao','apple')` 제약이 있습니다.

## 현재 상태 (2026-11-14, 팀장 카카오 계정)

- 카카오 앱 "뽑공" (앱 ID 1650041). 카테고리는 교육, 대표 도메인은 https://ppobgong.o-r.kr.
- 카카오 로그인 ON.
- REST API 키의 로그인 리다이렉트 URI: `https://ppobgong.o-r.kr/auth/kakao/callback`
- 클라이언트 시크릿(카카오 로그인) ON.
- **남은 일:** 콘솔 > 앱 > 플랫폼 키 > REST API 키 화면에서 REST API 키와 카카오 로그인 클라이언트 시크릿을 EC2 서버 `.env`에 넣고 서버를 다시 시작합니다. 키는 채팅이나 Git에 올리지 않습니다.

## 카카오 개발자 콘솔 (한 번만)

> 새 콘솔에서는 리다이렉트 URI와 클라이언트 시크릿이 "앱 > 플랫폼 키 > REST API 키 수정" 화면에 있습니다.


<https://developers.kakao.com> → 내 애플리케이션 → 애플리케이션 추가 (앱 이름: 뽑공)

1. **앱 키**: REST API 키를 복사합니다. 서버 `.env`의 `KAKAO_REST_API_KEY`에 넣습니다.
2. **플랫폼 > Web**: 사이트 도메인에 `https://ppobgong.o-r.kr`을 등록합니다.
3. **카카오 로그인**:
   - 활성화 설정을 ON으로 바꿉니다.
   - Redirect URI에 `https://ppobgong.o-r.kr/auth/kakao/callback`을 등록합니다.
4. **카카오 로그인 > 동의항목**:
   - 닉네임은 필요 없습니다. 앱에서 따로 정합니다.
   - 카카오계정(이메일)은 "선택 동의"로 둡니다. 비즈 앱이 아니면 못 켤 수 있는데, 그래도 동작합니다. 이메일은 없어도 됩니다.
5. **카카오 로그인 > 보안 > Client Secret**:
   - 코드를 만들고 "사용함"으로 바꿉니다.
   - 서버 `.env`의 `KAKAO_CLIENT_SECRET`에 넣습니다.

## 서버 `.env` (EC2)

```
KAKAO_REST_API_KEY=...
KAKAO_CLIENT_SECRET=...
KAKAO_REDIRECT_URI=https://ppobgong.o-r.kr/auth/kakao/callback
```

서버를 다시 시작한 뒤 `GET /health`의 `"kakao": true`를 확인합니다. 키가 없으면 카카오 경로가 꺼집니다. 이때 앱 버튼은 "카카오 로그인이 아직 준비되지 않았어요"라고 안내합니다.

## 시험

- 서버 단위 시험: `cd api/server && node --test kakao-test.mjs`
  - DB와 카카오 없이 시작 → 콜백 → 교환 흐름을 확인합니다.
  - state 위조, 틀린 verifier, 코드 재사용 거절도 확인합니다.
- 실제 로그인은 위 키를 넣은 뒤 앱의 첫 화면 "카카오로 시작하기"로 확인합니다.

## 아직 안 한 것

- 카카오 계정의 **탈퇴 신청 취소**: 지금은 이메일과 비밀번호로만 취소할 수 있습니다. 카카오 계정은 로그인하면 `account_deleting` 안내만 나옵니다.
- 카카오톡 앱으로 바로 로그인: 네이티브 SDK가 필요하고, 지금은 브라우저의 카카오계정 로그인만 됩니다.
- Apple 로그인: 이번에는 하지 않습니다.
