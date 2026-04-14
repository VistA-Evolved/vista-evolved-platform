# Add a VistA User

!!! warning "Live Write Operation"
    This guide covers writing directly to VistA File 200 (New Person) via the DDR FILER RPC. Always test in a sandbox environment first.

## Via the Admin UI (Recommended)

1. Open `http://127.0.0.1:3000/admin/staff/new`
2. Use the **New Staff** wizard
3. Fill in the guided wizard:
   - Name (Last,First format)
   - Access Code / Verify Code
   - Department / Service
   - Title
4. Click **Create User**

!!! note "Current Behavior"
    User creation is live through the admin UI and tenant-admin API. The success screen prints the welcome letter and acknowledgment form immediately after creation.

!!! note "Staff SSN Policy"
    The current staff-create flow intentionally does **not** write File 200 field `9` (SSN) for newly created users. Direct M validation on disposable audit user `10000000445` showed the user record existed while the SSN storage slot remained blank. Any downstream process that depends on the NEW PERSON SSN field or the `^VA(200,"SSN",...)` cross-reference must use a separate governed workflow; this guide's create path does not populate it.

## Via API (Current)

```powershell
# Authenticate first
$body = '{"accessCode":"PRO1234","verifyCode":"PRO1234!!","tenantId":"default"}'
$r = Invoke-WebRequest -Uri http://127.0.0.1:3000/api/ta/v1/auth/login `
  -Method POST -ContentType "application/json" -Body $body `
  -SessionVariable s -UseBasicParsing

# Create user (requires XUMGR security key)
$newUser = @{
  name = "SMITH,JOHN"
  accessCode = "SMITH001"
  verifyCode = "TempPass!001"
  title = "RN"
  serviceSection = "NURSING"
} | ConvertTo-Json
Invoke-WebRequest -Uri http://127.0.0.1:3000/api/ta/v1/users?tenantId=default `
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
