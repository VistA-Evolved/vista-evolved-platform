# Add a VistA User

!!! warning "Live Write Operation"
    This guide covers writing directly to VistA File 200 (New Person) via the DDR FILER RPC. Always test in a sandbox environment first.

## Via the Admin UI (Recommended)

1. Open `http://127.0.0.1:4530/tenant/users`
2. Click **Add User** (when write support is enabled)
3. Fill in the guided wizard:
   - Name (Last,First format)
   - Access Code / Verify Code
   - Service
   - Title
4. Click **Create User**

!!! note "Integration Status"
    Write support for user creation is currently integration-pending. Reads from File 200 are live.

## Via API (Current)

```powershell
# Authenticate first
$body = '{"accessCode":"PRO1234","verifyCode":"PRO1234!!"}'
$r = Invoke-WebRequest -Uri http://127.0.0.1:4520/auth/login `
  -Method POST -ContentType "application/json" -Body $body `
  -SessionVariable s -UseBasicParsing

# Create user (requires XUMGR security key)
$newUser = @{
  name = "SMITH,JOHN"
  title = "RN"
  service = "NURSING"
} | ConvertTo-Json
Invoke-WebRequest -Uri http://127.0.0.1:4520/users `
  -Method POST -ContentType "application/json" -Body $newUser `
  -WebSession $s -UseBasicParsing
```

## Required Security Keys

The calling user must hold:
- `XUMGR` — User management key

## VistA File Reference

| File | Number | Purpose |
|------|--------|---------|
| New Person | 200 | User accounts |
| Security Key | 19.1 | Key definitions |
| Key Assignment | 200 (subfile 19.1) | Key-to-user assignments |
