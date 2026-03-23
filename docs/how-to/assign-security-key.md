# Assign a Security Key to a User

Security keys in VistA gate access to specific menu options and RPCs. They live in **File 19.1**.

## Via Admin UI

1. Open `http://127.0.0.1:4530/tenant/users`
2. Click on the user you want to modify
3. Go to the **Security Keys** tab
4. Click **Assign Key**
5. Select the key from the dropdown
6. Click **Assign**

## Via API

```powershell
# Authenticate
$body = '{"accessCode":"PRO1234","verifyCode":"PRO1234!!"}'
Invoke-WebRequest -Uri http://127.0.0.1:4520/auth/login `
  -Method POST -ContentType "application/json" -Body $body `
  -SessionVariable s -UseBasicParsing

# Assign security key (replace {ien} with user IEN)
$keyBody = '{"key":"XUMGR"}'
Invoke-WebRequest -Uri "http://127.0.0.1:4520/users/{ien}/security-keys" `
  -Method POST -ContentType "application/json" -Body $keyBody `
  -WebSession $s -UseBasicParsing

# Remove security key
Invoke-WebRequest -Uri "http://127.0.0.1:4520/users/{ien}/security-keys/XUMGR" `
  -Method DELETE -WebSession $s -UseBasicParsing
```

## Common Security Keys

| Key | Purpose |
|-----|---------|
| `XUMGR` | User management — required for admin tasks |
| `XUPROG` | Programmer access |
| `ORES` | Order entry — required for CPRS ordering |
| `ORELSE` | Order entry (limited) |
| `PROVIDER` | Clinical provider role |
| `TIU AUTHOR` | TIU document authoring |
| `DGZMENU` | Patient registration |
| `SDWL PARAMETER` | Scheduling parameters |

## Verification

After assigning, verify the key appears:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:4520/users/{ien}" `
  -WebSession $s -UseBasicParsing | Select-Object -ExpandProperty Content
```

The response should include `"securityKeys":["XUMGR",...]`.
