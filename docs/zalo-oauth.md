# Zalo OAuth: profile retrieval

The callback validates the state and ten-minute PKCE cookies, exchanges the code,
and retrieves the granting user's profile. It returns HTTP 200 JSON to that browser:

```json
{
  "message": "Lấy hồ sơ Zalo thành công",
  "profile": { "id": "<Zalo ID>", "name": "<display name or null>", "avatar_url": "<image URL or null>" },
  "applicationSessionCreated": false
}
```

This operation retrieves a profile; it does not create an application session.
No Supabase session is required. The flag describes this operation, not any
pre-existing session in the browser. No database writes, identity provisioning,
new public lookup endpoint, or long-term token storage are added.

## API contract

Checked 2026-10-04 against [Zalo's official documentation](https://docs.zaloplatforms.com/docs/Social/social-api/tai-lieu/thong-tin-ten-anh-dai-dien):
GET `https://graph.zalo.me/v2.0/me?fields=id,name,picture`, token in the
`access_token` header. The user must grant permission to the application.
The response supplies `id`, `name`, and `picture.data.url` (normalized to
`avatar_url`). No email/phone permission is requested.

IDs must be nonempty strings without whitespace/control characters, never coerced
from numbers. Missing/blank names and missing/invalid avatar URLs become `null`;
no fallback identity data is invented. Avatars must use HTTP(S) without credentials.
Requests have a ten-second timeout, no cache, and HTTP/JSON/business-error checks.

All callback responses clear both temporary cookies and use `Cache-Control:
no-store` and `Referrer-Policy: no-referrer`. Neither tokens nor profiles are placed
in redirect query strings. Provider errors are replaced with fixed local codes.
Invalid state, expired cookies, missing code and denial return HTTP 400. Failed
token/profile requests or invalid profiles return HTTP 502, without provider details.

## Real Zalo test

1. Keep `.env` unchanged. Existing variables from `.env.example` are `ZALO_APP_ID`,
   `ZALO_SECRET_KEY`, `ZALO_CALLBACK_URL_DEV` for development, and
   `ZALO_CALLBACK_URL_PRODUCT` for production. No new variable is required.
2. Run `npm run dev`. With port 3000, open
   `http://localhost:3000/api/auth/zalo/login`. If the configured callback uses an
   HTTPS domain/tunnel, open `/api/auth/zalo/login` on that same domain pointing
   to this server. The callback variable and Zalo dashboard registration must
   agree, using `/api/auth/zalo/callback`. Do not mix localhost, 127.0.0.1 and a
   tunnel host: the callback needs the cookies from the login host.
3. At the Zalo page, scan the QR/sign in yourself and grant permission using your
   own account. Complete within ten minutes. Do not share tokens or OAuth codes.
4. The browser returns to the callback and displays the JSON above. Compare
   `profile.name` with the granting account. Open `profile.avatar_url` separately
   to compare the avatar if it is not null. The ID is scoped to the Zalo app,
   not a phone number or public username. Repeating OAuth with the same account
   and same app should yield the same ID. Independent ID comparison requires
   Zalo API data for that same app/account, not an ID from a different app.
5. Start again at the login route to retry; reloading the old callback should fail
   because its temporary cookies are cleared and the OAuth code is single-use.
   Also try denying permission to verify a controlled error.

## Automated checks

Run `npm test`, `npx next typegen`, `npx tsc --noEmit`, `npm run build`, and:

```sh
npx eslint services/auth.service.ts app/api/auth/zalo/login/route.ts app/api/auth/zalo/callback/route.ts tests/zalo-auth.test.mjs
```

Tests mock Zalo and run the real callback. They do not load `.env` or contact Zalo.
The earlier full lint run found an existing encoding error in
`types/database.types.ts` (reported as binary) and an unused `_headers` warning in
`lib/supabase/server.ts`. Next.js also warns about the existing deprecated
`middleware.ts` convention. Those unrelated files are unchanged.

Mock tests and build success do not prove a real Zalo request succeeded. Real
verification requires the user to complete QR/consent and inspect the returned JSON.

Latest checks after the scope correction: 38 mock tests passed; targeted ESLint,
Next.js type generation, TypeScript check and production build passed. Local HTTP
smoke checks: login returned 307 to Zalo and set both temporary cookies; callback
without cookies returned 400, no-store, and cleared both cookies. These HTTP checks
did not exchange a real Zalo authorization code or retrieve a real user's profile.

## Diagnosing the real OAuth failure (2026-10-05)

The first instrumented real callback passed callback validation, then failed in
`token_exchange` with a network error before any HTTP response or profile request.
A credential-free HEAD probe to the same Zalo token endpoint failed with `EACCES`
inside the sandbox and returned HTTP 200 outside it. The local Next.js process was
verified against this repository and restarted outside the sandbox on port 3000.
TLS verification remains enabled. No authorization code was retried.

Server diagnostics use the `[zalo-oauth]` prefix and include only stage, fixed
error category, HTTP status, bounded numeric Zalo error code, allowlisted network
code, or a locally named invalid field. They do not include provider messages,
request/response bodies, cookies, credentials, callback URLs or profile data.
Next.js development incoming-request logging ignores Zalo auth routes to avoid
printing OAuth query credentials. Start a fresh OAuth flow after a network failure.

44 tests now include safe diagnostic filtering and the observed EACCES condition,
including verification that the token exchange is not retried. These checks do
not replace confirmation from the real callback after the server restart.

Real verification after restart succeeded: a fresh user-initiated OAuth callback
logged `callback_validation: passed`, `token_exchange: passed`, and
`profile_validation: passed` in sequence. This confirms a real Zalo token exchange
and a real profile with a valid ID; the callback returns the normalized profile as
HTTP 200 JSON. The user should visually compare the returned name/avatar with the
account they authorized. No profile values or credentials are recorded here.
