# Verifier Gate v0 — Design Document

_Created: 2026-06-08_

---

## Tujuan

Memberi mekanisme verifikasi teknis untuk patch proposal sebelum dianggap "ready for apply".
Gate ini bersifat **rekaman** (record evidence), bukan eksekusi otomatis.

---

## Current State

Patch lifecycle saat ini:
1. `submitProposal()` → status "pending"
2. `approveProposal()` → status "approved" (founder)
3. `applyPatch()` → writes to filesystem (founder-only, NOT exported)

**Tidak ada verifikasi teknis** antara "approved" dan "apply". Founder apply tanpa tahu apakah patch akan pass typecheck.

## Design

### Approach: Evidence-Based Verification Record

Bukan auto-runner. Bukan shell executor. Sebuah **verification record** yang:
1. Mencatat apakah sebuah patch sudah "diverifikasi" secara teknis
2. Menyimpan evidence: command yang dijalankan, exit code, stdout/stderr
3. Memberi status: `verified` / `failed` / `pending`
4. Failed verification = patch tidak boleh dianggap ready

### Data Model (di types.ts)

```typescript
interface PatchVerification {
  proposalId: string;
  status: "pending" | "verified" | "failed";
  checks: VerificationCheck[];
  verifiedAt: string | null;       // ISO 8601, set when all checks pass
  createdAt: string;               // ISO 8601
}

interface VerificationCheck {
  name: string;                    // e.g. "typecheck", "test:colony-lesson"
  command: string;                 // command yang dijalankan
  exitCode: number | null;         // null = belum dijalankan
  stdout: string;                  // truncated to 2000 chars
  stderr: string;                  // truncated to 2000 chars
  passed: boolean | null;          // null = belum dijalankan
  executedAt: string | null;       // ISO 8601
}
```

### Allowed Commands (whitelist)

HANYA command yang aman:

```typescript
const VERIFIER_ALLOWED_COMMANDS = [
  "npm run typecheck",     // tsc --noEmit
  "npm run build",         // tsc (full compile)
  "npm test",              // if test script exists
];
```

TIDAK ADA:
- ❌ Shell access bebas
- ❌ `rm`, `del`, `format`
- ❌ `curl`, `wget`, network calls
- ❌ `npm install`, `npm publish`
- ❌ Arbitrary file writes
- ❌ `node -e` or inline script execution

### API Surface

| Function | Description |
|----------|-------------|
| `createVerification(proposalId)` | Buat verification record untuk proposal (status: pending) |
| `recordCheck(proposalId, check)` | Record hasil satu check (name, command, exitCode, stdout, stderr) |
| `getVerification(proposalId)` | Ambil verification record |
| `isProposalVerified(proposalId)` | Boolean: apakah semua checks passed |
| `suggestVerificationCommands(proposalId)` | Sarankan command yang relevan (berdasarkan files changed) |

### How It Integrates

1. Founder runs `npm run typecheck` manually (or via Colony command engine)
2. Founder (or command engine) calls `recordCheck()` with the result
3. Verification record updated
4. `isProposalVerified()` = true only if all recorded checks passed
5. Failed verification → evidence disimpan, patch TIDAK dihapus, tapi diberi status "failed"

### Yang TIDAK Dilakukan

- ❌ Tidak auto-run shell commands
- ❌ Tidak auto-approve patches
- ❌ Tidak mengubah approval gate (patch tetap perlu founder approval)
- ❌ Tidak menghapus patch yang gagal verifikasi
- ❌ Tidak memberi worker shell execution bebas
- ❌ Tidak ada dependency baru

### Storage

- Redis key: `colony:verification:{proposalId}` (JSON string)
- Index: `colony:verifications:index` (Redis SET)

---

_Ready for implementation._
