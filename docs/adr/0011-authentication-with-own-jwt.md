# ADR-0011: Authentication ด้วย JWT ของระบบเอง (Own JWT + Rotating Refresh Token)

## Status

Accepted — 2026-11-11

## Context

ก่อนหน้านี้ Backend อ่านตัวตน/สิทธิ์จาก Header `X-TanPms-*` ซึ่งปลอมได้ ต้องมีการยืนยันตัวตนจริงที่แยก `AdminScope` กับ `ClientScope` ตาม [rbac-and-scopes.md](../03-contracts/rbac-and-scopes.md) และให้การปิดบัญชี/เปลี่ยนสิทธิ์มีผลทันที

## Decision

1. **Access Token = JWT ลายเซ็น HS256 อายุ 15 นาที** (`Auth:Jwt:AccessTokenMinutes`) มีเฉพาะ claim `sub`, `scope`, `jti`, `iat`, `exp` (+ `nbf`, `iss`, `aud`); ตรวจ Issuer/Audience/Lifetime/Signature, อนุญาตเฉพาะ `HS256`, `ClockSkew` 30 วินาที, ปิด `MapInboundClaims`
2. **สิทธิ์ไม่อยู่ใน Token:** `JwtCurrentUserContext` อ่าน `sub` + `scope` จาก Token แล้วเรียก `IAuthStore.ResolvePrincipal` ต่อ Request เพื่อได้ `Permissions`, `AllowedPropertyIds`, `CustomerId` และตรวจกะเปิดจาก `ICashierShiftStore` — ผู้ใช้ที่ถูก Deactivate หรือสิทธิ์ที่เปลี่ยนมีผลทันที (Token ที่ยังไม่หมดอายุของผู้ใช้ที่ปิดใช้งานถูกมองเป็นไม่ยืนยันตัวตน)
3. **Refresh Token:** สุ่ม 256 บิต (base64url) เก็บเฉพาะ SHA-256 hex digest (`RefreshTokenCodec`), อายุ `Auth:Jwt:RefreshTokenDays` (7 วัน); **Rotation** ทุกครั้งที่ใช้ (ออกตัวใหม่ใน Family เดิม) และ **ถ้านำ Token ที่หมุนไปแล้วมาใช้ซ้ำ = ถือว่าถูกขโมย เพิกถอนทั้ง Family**; ผู้ใช้ที่ไม่ Active ก็เพิกถอน Family
4. **รหัสผ่าน:** PBKDF2-SHA256 600,000 รอบ รูปแบบมีเวอร์ชัน `pbkdf2-sha256$v1$<iterations>$<salt>$<hash>` (เก็บจำนวนรอบไปกับ Hash เพื่อเพิ่มรอบภายหลังได้), เปรียบเทียบแบบ Fixed-Time; นโยบาย: ยาว 10–256 ตัวอักษร (`auth.password_policy`)
5. **Lockout:** ผิด 5 ครั้ง ล็อก 15 นาที (`Auth:Lockout:Threshold`/`Minutes`); กรณีไม่พบ Identifier, ไม่มีรหัสผ่าน, ถูกล็อก หรือบัญชีไม่ Active จะตอบ `auth.invalid_credentials` ข้อความเดียวกัน และกรณีไม่พบ/ไม่มีรหัส/ถูกล็อกจะเรียก Dummy Hash (`VerifyDummy`) เพื่อให้เวลาตอบใกล้เคียงกัน
6. **`Auth:Mode` = `Jwt` (ค่าเริ่มต้น) | `Headers`:** `Headers` (ใช้ `HttpCurrentUserContext`) อนุญาตเฉพาะ Environment `Development`/`Testing` มิฉะนั้นโปรแกรมหยุดตอนเริ่ม; **Start-up Guard:** `Auth:Mode` ไม่ถูกต้อง, `Auth:Jwt:SigningKey` ว่างนอก Dev/Testing, หรือสั้นกว่า 32 bytes, หรือค่าตัวเลขที่ต้องเป็นบวกไม่เป็นบวก — โยน `InvalidOperationException` (Dev/Testing ที่ไม่ตั้งกุญแจจะสุ่มกุญแจต่อโปรเซส)
7. **`AuthGateMiddleware` (โหมด `Jwt`):** ทุก `/api/v1/*` ยกเว้น `/auth/login` และ `/auth/refresh` ต้องมีตัวตนที่ Active (ไม่ผ่าน = `auth.unauthenticated` 401) และ Scope ของ Token ต้องตรงกลุ่ม Route (`/admin` ต้อง Admin, `/client` ต้อง Client; ไม่ตรง = `auth.permission_denied` 403) ส่วน Permission/Property ตรวจต่อใน Handler
8. **Rate Limiting:** Fixed Window ต่อ IP บน `POST /auth/login` และ `/auth/refresh` (`Auth:RateLimit:Enabled|PermitLimit|WindowSeconds` ค่าเริ่มต้น เปิด/10/60 วินาที) เกินตอบ `auth.rate_limited` 429 พร้อม `Retry-After`
9. **บัญชีลูกค้าสร้างโดยพนักงาน:** `POST /api/v1/admin/customers/{customerId}/account` (`CustomerAccountRequest`: `LoginIdentifier`, `InitialPassword`); **ไม่มีการสมัครเอง (Self-Registration) และยังไม่มี Forgot-Password** — พนักงาน Reset รหัสผ่านผู้ใช้ admin ผ่าน `POST /users/{userId}/reset-password`
10. **ฝั่ง Frontend** (`frontend/src/lib/auth/session-store.ts`, `api-client.ts`): Access Token อยู่ในหน่วยความจำเท่านั้น; Refresh Token ใน `sessionStorage` (ต่อแท็บ) — ยอมรับ Trade-off ว่า XSS อ่านได้ แทนที่จะใช้ `localStorage` (กว้างกว่า) หรือ httpOnly Cookie (Contract ปัจจุบันคืน Token ใน Body); Logout/Forced Logout ซิงก์ข้ามแท็บด้วย `BroadcastChannel`; Refresh แบบ Single-Flight (`refreshPromise`) ใน `ApiClient`; ไม่ Log Token และไม่ใส่ใน URL
11. **ข้อมูลเริ่มต้นสำหรับ Dev:** `Seed:DevPassword` ให้รหัสผ่านบัญชี Seed เฉพาะ Development/Testing (ไม่ทำงานใน Environment อื่น)

## Consequences

- **ข้อดี:** ไม่พึ่งบริการภายนอก, สิทธิ์และการ Deactivate มีผลทันที, Token รั่วมีอายุสั้นและการขโมย Refresh Token ถูกตรวจจับได้, ทดสอบได้ (`JwtAuthenticationWebTests`, `AuthStartupGuardTests`, `JwtAuthPostgresTests`, `AuthSecurityUnitTests`, `OpenApiContractTests`, frontend `pm-auth-jwt.test.tsx`)
- **ต้นทุน:** ทุก Request มี Query แก้สิทธิ์ 1 ครั้ง (ยังไม่มี Cache); ต้องดูแลกุญแจเซ็น (Secret) และการหมุนกุญแจเอง — ยังไม่มีกลไก Key Rotation (เปลี่ยนกุญแจ = ทุก Access Token เดิมใช้ไม่ได้)
- **ข้อจำกัดที่ทราบ (Known Limits):**
  - Refresh พร้อมกันด้วย Token เดียวกันอาจหมุนซ้ำได้ 2 ครั้ง (โค้ดมี `shortcut` comment; ต้องเพิ่ม Row Lock หาก Client แข่งกัน)
  - ไม่มี Job ลบ Refresh Token ที่หมดอายุ (ตารางโตขึ้นเรื่อย ๆ)
  - ไม่มี Forgot-Password / Self-Service Reset สำหรับลูกค้า และไม่มี MFA
  - `appsettings.json` มี Connection String เริ่มต้นสำหรับเครื่องพัฒนา (`postgres/postgres`) ต้อง Override ด้วย `ConnectionStrings__DefaultConnection` ทุกสภาพแวดล้อมที่ Deploy
  - Rate Limit เป็นแบบต่อ Instance (In-Memory) ไม่แชร์ข้ามหลาย Instance

## Alternatives Considered

- **ASP.NET Core Identity:** ครบเครื่องแต่ผูกกับ Schema/UI ของ Identity และต้องปรับให้เข้ากับ Dual-Scope (`admin`/`client`) และโมเดล `AdminUser`/`CustomerAccount` เดิม — ปฏิเสธ
- **IdP ภายนอก / OIDC (Keycloak, Entra ID ฯลฯ):** เหมาะระยะยาว (SSO/MFA/Forgot-Password) แต่เพิ่ม Infra และ Dependency ตอนนี้; ยังเปิดทางย้ายได้เพราะสิทธิ์ถูกอ่านจาก Store ไม่ได้ฝังใน Token — พิจารณาใหม่ก่อน Production
- **httpOnly Cookie Session:** ลดความเสี่ยง XSS อ่าน Token แต่ต้องจัดการ CSRF/CORS Credential และ Contract ปัจจุบันเป็น Bearer — ปฏิเสธในตอนนี้
- **Token อายุสั้น + ตาราง Session ใน DB (Opaque Token):** เพิกถอนทันทีง่าย แต่ทุก Request ต้อง Lookup Session — เลือก JWT สั้น + Resolve สิทธิ์ต่อ Request ซึ่งได้ผลเพิกถอนใกล้เคียงกัน
