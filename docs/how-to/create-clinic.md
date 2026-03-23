# Create a Clinic

Clinics (Hospital Locations) live in VistA **File 44**. This guide covers how to create one.

## Via Admin UI

1. Open `http://127.0.0.1:4530/tenant/clinics`
2. Click **New Clinic**
3. Complete all required fields:
   - Clinic Name (uppercase recommended)
   - Facility (select from list)
   - Stop Code (3-digit DSS code)
   - Type (e.g., `C` = Clinic)
4. Click **Create**

## Via API

```powershell
# Authenticate
$body = '{"accessCode":"PRO1234","verifyCode":"PRO1234!!"}'
Invoke-WebRequest -Uri http://127.0.0.1:4520/auth/login `
  -Method POST -ContentType "application/json" -Body $body `
  -SessionVariable s -UseBasicParsing

# Create clinic
$clinic = @{
  name = "PRIMARY CARE"
  facility = "500"
  stopCode = "323"
  type = "C"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://127.0.0.1:4520/clinics `
  -Method POST -ContentType "application/json" -Body $clinic `
  -WebSession $s -UseBasicParsing
```

## Stop Code Reference

Stop codes are defined by VA DSS (Decision Support System). Common examples:

| Code | Description |
|------|-------------|
| 323 | Primary Care |
| 534 | Psychiatry |
| 407 | Physical Therapy |
| 351 | Pharmacy |

## VistA File Reference

| Field | File 44 Field # | Notes |
|-------|----------------|-------|
| Name | .01 | Required, uppercase |
| Division | 3.5 | Links to File 40.8 |
| Stop Code | .07 | 3-digit DSS code |
| Type | 2 | `C`=Clinic, `W`=Ward |
| Inactivate Date | 2505 | Set to deactivate |
