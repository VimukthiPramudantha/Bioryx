# Bioryx v1.2.0 — Release Notes

**Release Date:** October 27, 2026  
**Installer Package:** `release/Bioryx Setup 1.0.0.exe`  
**Portable Directory:** `release/win-unpacked/Bioryx.exe`

---

## Highlights

Bioryx v1.2.0 transitions from prototype sample figures to **100% production-ready, real-time dynamic biometric data**. All hardcoded mock statistics and dummy table records across the dashboard and sync views have been completely removed and replaced with dynamic data pipelines connected to physical ZKTeco hardware and MongoDB.

---

## Key Improvements & Changes

### 1. Dynamic Real-Data Dashboard Metrics
- **Total Employees**: Replaced hardcoded `150` with live totals queried directly from the device's enrolled users (`getDeviceUsers()`). Defaults to `0` when no employees are enrolled.
- **Today's Attendance**: Replaced hardcoded static addition (`145 + livePunches`) with real-time grouping of distinct employees who checked in today across device logs and real-time punch streams.
- **Late Arrivals**: Calculated dynamically by analyzing each user's earliest check-in against the shift schedule (after 9:15 AM).
- **Missed Punches**: Automatically detects single recorded check-ins without an accompanying clock-out punch for the day.

### 2. Clean Activity Feeds & Empty States
- **Recent Device Activity Table**:
  - Removed dummy placeholder devices (`ZKTeco Main Reader 192.168.1.201`, `ZKTeco Secondary Reader 192.168.1.202`, and `Canteen Terminal 192.168.1.203`).
  - Added clean empty-state fallback: *"No recent device activity recorded."*
  - Automatically transitions to real activity logs when live punch events occur.

### 3. Sync Manager Real-Time Logging
- **Dynamic Sync Logs**: Removed hardcoded sample rows (`Fetched Attendance`, `Updated Employees`, etc.).
- **Interactive Force Sync**: Connected the **"Force Sync Now"** button to the background sync routine (`syncDeviceDatabase()`).
- **Live Event Recording**: Logs actual punch sync count, MongoDB database reconnection status, and manual sync results.
- **Empty State**: Displays *"No synchronization events recorded."* when no synchronization actions have occurred yet.

### 4. Production Windows Installer
- Packaged into an installable desktop application using NSIS:
  - **Installer Executable**: `release/Bioryx Setup 1.0.0.exe`
  - Configured custom installation directory selection.
  - Generates desktop and start menu shortcuts (`Bioryx`).
  - Includes portable standalone bundle under `release/win-unpacked/`.

---

## Distribution Files

| File | Description | Location |
|---|---|---|
| **Setup Installer** | Windows NSIS installer wizard | [`release/Bioryx Setup 1.0.0.exe`](file:///d:/Projects/Bioryx/release/Bioryx%20Setup%201.0.0.exe) |
| **Portable Executable** | Direct unpacked executable | [`release/win-unpacked/Bioryx.exe`](file:///d:/Projects/Bioryx/release/win-unpacked/Bioryx.exe) |
| **Config Spec** | Builder configuration | [`package.json`](file:///d:/Projects/Bioryx/package.json) |

