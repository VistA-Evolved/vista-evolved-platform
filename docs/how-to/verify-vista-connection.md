# Verify VistA Connection

Use these commands to verify that the tenant-admin server can reach VistA and that real data is being returned.

## Step 1: Ping VistA

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:4520/ping -UseBasicParsing | Select-Object -ExpandProperty Content
```

Expected response:
```json
{"ok":true,"source":"vista-live","port":9431}
```

If `"ok":false`, check:
- VistA Docker container is running (`docker ps | Select-String vehu`)
- Port 9431 is accessible
- `.env.local` has correct `VISTA_PORT=9431`

## Step 2: Authenticate

```powershell
$body = '{"accessCode":"PRO1234","verifyCode":"PRO1234!!"}'
$r = Invoke-WebRequest -Uri http://127.0.0.1:4520/auth/login `
  -Method POST -ContentType "application/json" -Body $body `
  -SessionVariable s -UseBasicParsing
$r.Content
```

Expected:
```json
{"ok":true,"token":"...","user":{"duz":"1","name":"PROGRAMMER,ONE",...}}
```

## Step 3: Verify Real VistA Data

```powershell
# List users from VistA File 200
Invoke-WebRequest -Uri "http://127.0.0.1:4520/users?limit=5" `
  -WebSession $s -UseBasicParsing | Select-Object -ExpandProperty Content
```

Expected: A list of real VistA user records with IENs and names.

```powershell
# List facilities from VistA File 4
Invoke-WebRequest -Uri "http://127.0.0.1:4520/facilities" `
  -WebSession $s -UseBasicParsing | Select-Object -ExpandProperty Content
```

## Interpreting Responses

| Field | Meaning |
|-------|---------|
| `"source":"vista-live"` | Data came from the live VistA instance |
| `"source":"error"` | VistA call failed — check server logs |
| Empty `"data":[]` | VistA responded but no records found |
| `"ok":false` | Authentication or connection problem |

!!! warning "Never trust cached responses"
    Always run fresh requests. Never assume a route works based on a previous session.
