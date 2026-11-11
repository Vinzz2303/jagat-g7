# JAGAT G7 — T-045: Staging to R530 Migration Plan

**Status:** Draft
**Created:** 2026-06-14
**Task:** T-045 (Technical Backlog)
**Owner:** AI Builder + Faturachman
**Type:** Docs-only (no code changes)

---

## 1. Ringkasan Eksekutif

Dokumen ini mendefinisikan rencana migrasi JAGAT G7 dari server staging (Ryzen 5 3600, Windows) ke server enterprise target (Dell PowerEdge R530, Linux/Proxmox). Migrasi bersifat **lift-and-shift bertahap** — satu layanan per waktu, dengan rollback path di setiap langkah.

**Tujuan:** JAGAT berjalan penuh di R530 tanpa kehilangan data, tanpa downtime publik >4 jam, dan tanpa mengubah arsitektur aplikasi.

---

## 2. Current State

| Komponen | Lokasi Saat Ini | Port | Status |
|----------|----------------|------|--------|
| Express BFF | 103.190.0.113:5000 | 5000 | ONLINE |
| Next.js UI | 103.190.0.113:50012 | 50012 | ONLINE |
| Redis | 127.0.0.1:6379 | 6379 | ONLINE |
| Qdrant | 127.0.0.1:6333 | 6333 | ONLINE |
| Ollama | localhost | 11434 | ONLINE |
| Remote Ollama (Server B) | 100.107.244.82:11434 | 11434 | ONLINE (opt-in) |
| WhatsApp Bot | Embedded in Express | N/A | WA_ENABLED |
| OS | Windows 64-bit | — | — |
| RAM | 32GB | — | — |
| CPU | AMD Ryzen 5 3600 (6C/12T) | — | — |

---

## 3. Target State (R530)

| Komponen | Target | Port | Notes |
|----------|--------|------|-------|
| Express BFF | r530:5000 | 5000 | Node.js 20+ LTS |
| Next.js UI | r530:50012 | 50012 | Node.js 20+ LTS |
| Redis | r530:6379 | 6379 | Redis 7+ |
| Qdrant | r530:6333 | 6333 | Qdrant latest stable |
| Ollama | r530:11434 | 11434 | With GPU (future) |
| WhatsApp Bot | Embedded in Express | N/A | Same code |
| OS | Linux (Proxmox VE or Ubuntu 22.04 LTS) | — | — |
| RAM | 336GB | — | — |
| CPU | 2x Intel Xeon E5-2680 v4 (28C/56T) | — | — |
| Storage | ~2.6TB + ~5.8TB | — | Separate data volume |

---

## 4. Pre-Migration Checklist (Founder Actions)

- [ ] R530 hardware powered on and stable
- [ ] Linux OS installed (recommend Ubuntu 22.04 LTS or Proxmox VE)
- [ ] Network configured: static IP, firewall (ufw), SSH access
- [ ] Storage partitioned: OS on smaller volume, data on larger volume
- [ ] Domain/DNS or IP assignment finalized
- [ ] Tailscale installed and connected to existing network
- [ ] UPS connected and tested
- [ ] Backup destination identified (external drive or cloud)

---

## 5. Migration Phases

### Phase M1: Foundation Setup (Day 1-2)

**Goal:** R530 running Linux with base services installed.

**Steps:**
1. Install Node.js 20 LTS (via nvm or nodesource)
2. Install Redis 7 (`apt install redis-server`)
3. Install Qdrant (Docker or binary)
4. Install Ollama (`curl -fsSL https://ollama.com/install.sh | sh`)
5. Install Tailscale (`curl -fsSL https://tailscale.com/install.sh | sh`)
6. Configure firewall: open 5000, 50012, 6379 (internal only), 6333 (internal only)
7. Create `jagat` system user
8. Clone JAGAT repository to `/opt/jagat` or `/home/jagat`
9. Run `npm install` in both `C:\JAGAT` → `/opt/jagat` and `jagat-ui/`
10. Verify: `npx tsc --noEmit` passes, `npm run build` passes

**Verification:**
```bash
node --version        # v20.x
redis-cli ping        # PONG
curl http://localhost:6333/healthz  # OK
ollama --version      # present
tailscale status      # connected
```

**Rollback:** None needed — no traffic yet.

---

### Phase M2: Data Migration (Day 2-3)

**Goal:** Redis and Qdrant data copied from staging to R530.

**Steps:**
1. **Redis dump:**
   ```bash
   # On staging (Windows)
   redis-cli BGSAVE
   # Copy dump.rdb from Redis data directory
   
   # On R530
   systemctl stop redis
   # Copy dump.rdb to Redis data directory
   systemctl start redis
   redis-cli DBSIZE  # verify key count
   ```

2. **Qdrant snapshot:**
   ```bash
   # On staging
   curl http://localhost:6333/collections -o collections.json
   # For each collection, create snapshot:
   curl -X POST http://localhost:6333/collections/{name}/snapshots
   
   # On R530
   # Restore snapshots via Qdrant API
   curl http://localhost:6333/collections  # verify
   ```

3. **File data:**
   ```bash
   # Copy these directories from staging to R530:
   # - data/ (commercial_requests.jsonl, usage_events.jsonl)
   # - wa-auth-state/ (WhatsApp session)
   # - ops/ (operational documents)
   # - scripts/ (test and verification scripts)
   ```

4. **Environment config:**
   ```bash
   # Copy .env and .env.local to R530
   # Update:
   #   - HOST/IP if changed
   #   - COLONY_INTERNAL_SECRET (keep same or regenerate)
   #   - COOKIE_SIGNING_SECRET (keep same)
   #   - WA_* variables if WhatsApp re-pairing needed
   #   - OLLAMA_REMOTE_ENABLED (may change)
   ```

**Verification:**
```bash
redis-cli DBSIZE                    # match staging count
curl localhost:6333/collections     # all 14+ collections present
ls -la /opt/jagat/data/             # data files present
```

**Rollback:** Staging still running — no impact.

---

### Phase M3: Application Stack (Day 3-4)

**Goal:** Express BFF and Next.js UI running on R530.

**Steps:**
1. Start Express BFF:
   ```bash
   cd /opt/jagat
   npx tsx src/index.ts  # or npm run dev for testing
   ```

2. Verify health:
   ```bash
   curl http://localhost:5000/health    # 200 OK
   curl http://localhost:5000/colony/stats  # JSON response
   ```

3. Start Next.js UI:
   ```bash
   cd /opt/jagat/jagat-ui
   npm run build
   npm run start  # production mode on port 50012
   ```

4. Verify UI:
   ```bash
   curl http://localhost:50012  # 200 OK
   ```

5. Test Colony auth:
   ```bash
   curl -H "X-Colony-Token: <SOVEREIGN_TOKEN>" \
        http://localhost:5000/colony/stats  # 200 with data
   curl http://localhost:5000/colony/stats  # 401 (no auth)
   ```

6. Run full verification suite:
   ```bash
   npm run typecheck
   npm run build
   npm run ops:health
   npm run test:auth-headers
   # + all existing test scripts
   ```

**Verification:** All tests pass on R530.

**Rollback:** Shut down R530 services, staging continues serving.

---

### Phase M4: Process Management (Day 4-5)

**Goal:** Services auto-start on boot and restart on crash.

**Steps:**
1. Create systemd service files:

   `/etc/systemd/system/jagat-bff.service`:
   ```ini
   [Unit]
   Description=JAGAT G7 Express BFF
   After=network.target redis.service
   
   [Service]
   Type=simple
   User=jagat
   WorkingDirectory=/opt/jagat
   ExecStart=/usr/bin/node /opt/jagat/node_modules/.bin/tsx src/index.ts
   Restart=always
   RestartSec=5
   EnvironmentFile=/opt/jagat/.env
   
   [Install]
   WantedBy=multi-user.target
   ```

   `/etc/systemd/system/jagat-ui.service`:
   ```ini
   [Unit]
   Description=JAGAT G7 Next.js UI
   After=network.target jagat-bff.service
   
   [Service]
   Type=simple
   User=jagat
   WorkingDirectory=/opt/jagat/jagat-ui
   ExecStart=/usr/bin/node /opt/jagat/jagat-ui/node_modules/.bin/next start -p 50012
   Restart=always
   RestartSec=5
   EnvironmentFile=/opt/jagat/jagat-ui/.env.local
   
   [Install]
   WantedBy=multi-user.target
   ```

2. Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable jagat-bff jagat-ui
   sudo systemctl start jagat-bff jagat-ui
   ```

3. Verify auto-restart:
   ```bash
   sudo systemctl kill jagat-bff
   sleep 10
   sudo systemctl status jagat-bff  # should be active (restarted)
   ```

**Verification:** Services restart automatically after kill or reboot.

---

### Phase M5: DNS/Switchover (Day 5)

**Goal:** Public traffic routes to R530 instead of staging.

**Steps:**
1. **Option A — Same IP:** If R530 gets the same public IP (103.190.0.113), simply shut down staging services and start R530 services. Downtime: ~15-30 min.

2. **Option B — New IP:** If R530 has a different IP:
   - Update DNS A record to point to R530 IP
   - Update Next.js `JAGAT_BACKEND_URL` if needed
   - Update `.env` with new IP
   - TTL propagation: up to 4 hours

3. **Option C — Tailscale-only (internal):** If R530 is behind NAT:
   - Access via Tailscale IP only
   - No public IP change needed
   - Founder access via Tailscale client

4. **WhatsApp Bot re-pairing:**
   - WhatsApp session may not transfer (device-specific)
   - May need to re-scan QR code on R530
   - `wa-auth-state/` directory copy may work — test first

**Verification:**
```bash
# From external network
curl https://<PUBLIC_IP>:5000/health  # 200 OK
curl https://<PUBLIC_IP>:50012        # 200 OK
```

---

### Phase M6: Staging Decommission (Day 7+)

**Goal:** Staging server freed or repurposed.

**Steps:**
1. Keep staging running in read-only mode for 7 days as fallback
2. After 7 days of stable R530 operation:
   - Stop staging Express BFF and Next.js
   - Archive staging data (final Redis dump + Qdrant snapshot)
   - Repurpose staging server or keep as cold standby

**Decision:** Founder decides whether to keep staging as backup environment.

---

## 6. Rollback Strategy

| Phase | Rollback Action | Downtime |
|-------|----------------|----------|
| M1 | None needed (no traffic) | 0 |
| M2 | None needed (staging still running) | 0 |
| M3 | Shut down R530, staging continues | 0 |
| M4 | Disable systemd services | 0 |
| M5 | Revert DNS/IP to staging | 0-4 hours |
| M6 | Restart staging services | ~15 min |

**Golden rule:** Staging stays running until R530 has been stable for 7 days.

---

## 7. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Data loss during migration | High | Staging backup before copy; verify counts after restore |
| Redis/Qdrant version mismatch | Medium | Install same versions on R530; test restore first |
| WhatsApp session lost | Low | Re-pair is quick; not critical path |
| Network/firewall misconfig | Medium | Test internal access before DNS switchover |
| R530 hardware failure | Low | R530 enterprise hardware; UPS protects against power |
| Ollama model re-download | Low | Pull models in advance; remote Server B still available |
| Windows → Linux path differences | Medium | Use `/opt/jagat` paths; update any hardcoded Windows paths |

---

## 8. Post-Migration Verification Checklist

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — success
- [ ] `npm run ops:health` — PASS 3/3
- [ ] Colony auth gate — 401 without token, 200 with SOVEREIGN token
- [ ] Redis data — DBSIZE matches staging
- [ ] Qdrant data — all collections present with correct point counts
- [ ] Public routes — verify-public-routes.mjs PASS
- [ ] Engine hardening tests — all PASS
- [ ] WhatsApp Bot — connect + send test message
- [ ] Auto-restart — kill service, verify restart within 10s
- [ ] Latency check — Express BFF <200ms (should be faster on R530)
- [ ] Founder login — full session flow via browser

---

## 9. Timeline Summary

| Day | Phase | Effort | Founder Action |
|-----|-------|--------|----------------|
| 1-2 | M1 Foundation Setup | AI Builder | R530 OS + network ready |
| 2-3 | M2 Data Migration | AI Builder | Verify data integrity |
| 3-4 | M3 Application Stack | AI Builder | Test UI access |
| 4-5 | M4 Process Management | AI Builder | Verify auto-restart |
| 5 | M5 DNS/Switchover | AI Builder + Faturachman | Approve switchover |
| 7+ | M6 Decommission | AI Builder + Faturachman | Approve decommission |

**Total estimated effort:** 5-7 days (mostly AI Builder work, minimal founder time).

---

## 10. Open Questions (Founder Decision Required)

1. **OS choice:** Ubuntu 22.04 LTS or Proxmox VE? (Proxmox adds VM capability but more complexity)
2. **IP strategy:** Same public IP, new public IP, or Tailscale-only?
3. **GPU:** Install GPU during migration or defer to separate phase?
4. **Staging fate:** Keep as cold standby or repurpose?
5. **Backup strategy:** External drive, cloud, or both?
6. **R530 current state:** Is Linux already installed? What's the current state of the server?

---

## 11. Acceptance Criteria (per T-045)

- [x] Migration plan document created with phases, steps, verification, rollback
- [ ] Founder reviews and approves plan
- [ ] Open questions resolved
- [ ] Migration executed per approved plan
- [ ] Post-migration verification checklist 100% pass

---

_This document is a living plan. Update as founder provides R530 status and answers open questions._
