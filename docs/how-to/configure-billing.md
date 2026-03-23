# Configure Billing (Lago)

VistA Evolved uses [Lago](https://www.getlago.com/) for usage-based billing. This guide covers the full setup.

## Step 1: Start Lago Services

```powershell
cd services\lago

# Generate RSA keys (first time only)
if (-not (Test-Path ".env")) {
  $bytes = [System.Security.Cryptography.RSA]::Create(2048)
  # See lago-billing-setup.md runbook for full key generation
}

docker compose up -d
```

## Step 2: Wait for Migration

Lago runs a `lago-migrate` service that applies database migrations. Wait for it to complete:

```powershell
docker logs ve-lago-migrate --follow
# Wait until you see: "All migrations applied"
```

## Step 3: Verify Organization Creation

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:3040/api/v1/organizations" `
  -Headers @{"Authorization"="Bearer ve-lago-api-key-change-in-production"} `
  -UseBasicParsing
```

Expected: `{"organization":{"name":"VistA Evolved",...}}`

## Step 4: Wire API Key into control-plane-api

```powershell
# Edit apps/control-plane-api/.env
Add-Content -Path "apps/control-plane-api/.env" -Value "`nLAGO_API_URL=http://127.0.0.1:3040/api/v1"
Add-Content -Path "apps/control-plane-api/.env" -Value "LAGO_API_KEY=ve-lago-api-key-change-in-production"

# Restart the API to pick up new env vars
```

## Step 5: Verify Billing Status

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:4510/api/control-plane/v1/billing/status" `
  -UseBasicParsing | Select-Object -ExpandProperty Content
```

Expected: `{"billing":{"configured":true,"provider":"lago","model":"usage-based"}}`

## Access Lago UI

Navigate to `http://127.0.0.1:3041` in your browser.

Default credentials:
- **Email**: `admin@vista-evolved.io`
- **Password**: `VeAdmin2026!!`

## Production Checklist

- [ ] Replace `ve-lago-api-key-change-in-production` with a secure random key
- [ ] Replace RSA keys with production-generated keys
- [ ] Change default admin password
- [ ] Set `LAGO_RSA_PRIVATE_KEY` from a secrets manager
- [ ] Configure `LAGO_WEBHOOK_SECRET`

See the full [Lago Billing Setup runbook](../runbooks/lago-billing-setup.md) for details.
