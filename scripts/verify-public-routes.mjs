#!/usr/bin/env node
/**
 * JAGAT G7 - Public Routes & UI Navigation Smoke Test Script
 *
 * Purpose:
 *   - Verify public pages return 200 OK
 *   - Verify protected UI pages redirect to /login when unauthenticated
 *   - Verify /console and /memory are reachable with a valid session cookie
 *   - Verify protected API routes reject unauthenticated access
 *
 * Usage:
 *   node scripts/verify-public-routes.mjs
 */

const NEXTJS_PORT = process.env.NEXTJS_PORT || "50012";
const NEXTJS_URL = `http://127.0.0.1:${NEXTJS_PORT}`;
const COOKIE_NAME = "jagat_g7_session";

let passed = 0;
let failed = 0;

async function getCookieSigningSecret() {
  if (process.env.COOKIE_SIGNING_SECRET) return process.env.COOKIE_SIGNING_SECRET;
  const { readFile } = await import("node:fs/promises");
  const envText = await readFile("jagat-ui/.env.local", "utf8").catch(() => "");
  const match = envText.match(/^COOKIE_SIGNING_SECRET=["']?([^"'\r\n]+)["']?/m);
  return match?.[1] ?? "jagat-dev-cookie-signing-secret-2026-local-only";
}

function toBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

async function signSessionCookie(payload) {
  const { createHmac } = await import("node:crypto");
  const secret = await getCookieSigningSecret();
  const body = toBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  return `${body}.${signature}`;
}

async function getSessionCookieForToken(token) {
  try {
    const res = await fetch(`${NEXTJS_URL}/api/auth/validate-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) throw new Error(`validate-token failed: ${res.status}`);

    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) throw new Error("missing set-cookie");

    const match = setCookie.match(/jagat_g7_session=([^;]+)/);
    if (!match) throw new Error("missing jagat_g7_session");

    return decodeURIComponent(match[1]);
  } catch (err) {
    console.log(`  FAIL  Session bootstrap for authenticated console check - ${err.message}`);
    failed++;
    return null;
  }
}

async function testRoute(path, expectedStatus, checkRedirectTo = null, cookieValue = null) {
  const url = `${NEXTJS_URL}${path}`;

  try {
    const headers = {};
    if (cookieValue) {
      headers.Cookie = `${COOKIE_NAME}=${encodeURIComponent(cookieValue)}`;
    }

    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers,
    });

    const isStatusOk = res.status === expectedStatus;
    let redirectOk = true;
    let redirectLocation = "";

    if (checkRedirectTo) {
      redirectLocation = res.headers.get("location") || "";
      redirectOk = redirectLocation.includes(checkRedirectTo);
    }

    if (isStatusOk && redirectOk) {
      console.log(
        `  PASS  Route: ${path} (status: ${res.status}${redirectLocation ? `, redirects to: ${redirectLocation}` : ""})`,
      );
      passed++;
    } else {
      console.log(`  FAIL  Route: ${path}`);
      if (!isStatusOk) console.log(`      Expected status: ${expectedStatus}, got: ${res.status}`);
      if (checkRedirectTo && !redirectOk) {
        console.log(`      Expected redirect to contain: "${checkRedirectTo}", got location: "${redirectLocation}"`);
      }
      failed++;
    }
  } catch (err) {
    console.log(`  FAIL  Route: ${path} - Connection Error: ${err.message}`);
    failed++;
  }
}

async function main() {
  console.log("===============================================================");
  console.log("  JAGAT G7 - Public Routes & UI Navigation Smoke Test");
  console.log(`  Next.js Target: ${NEXTJS_URL}`);
  console.log("===============================================================");

  console.log("\nSuite 1: Public Core & Platform Routes (200 OK expected)");
  await testRoute("/", 200);
  await testRoute("/about", 200);
  await testRoute("/contact-analyst", 200);
  await testRoute("/pricing", 200);
  await testRoute("/login", 200);
  await testRoute("/platform/multi-agent-orchestration", 200);
  await testRoute("/platform/rag-pipeline", 200);
  await testRoute("/platform/vector-memory", 200);

  console.log("\nSuite 2: Public Marketing & Resource Sections (200 OK expected)");
  await testRoute("/meet-g7/leadership", 200);
  await testRoute("/meet-g7/research-papers", 200);
  await testRoute("/resources/community", 200);
  await testRoute("/resources/documentation", 200);
  await testRoute("/resources/status-dashboard", 200);
  await testRoute("/solutions/cyber-defense", 200);
  await testRoute("/solutions/data-sovereignty", 200);
  await testRoute("/solutions/maritime-security", 200);

  console.log("\nSuite 3: Protected UI Routes (307 Redirect to /login expected)");
  await testRoute("/colony", 307, "/login");
  await testRoute("/g7-admin", 307, "/login");
  await testRoute("/console", 307, "/login");
  await testRoute("/memory", 307, "/login");

  console.log("\nSuite 4: Authenticated Workspace Route (200 OK expected)");
  const sovereignCookie = await getSessionCookieForToken("JAGAT-J7-SECURE-2026");
  if (sovereignCookie) {
    await testRoute("/console", 200, null, sovereignCookie);
    await testRoute("/memory", 200, null, sovereignCookie);
  }

  console.log("\nSuite 5: Sovereign-only UI/API reject non-SOVEREIGN session");
  const liteCookie = await signSessionCookie({
    ownerName: "Tier Guard Test",
    tier: "LITE",
    token: "lite-tier-test-token",
  });
  await testRoute("/colony", 307, "/login", liteCookie);
  await testRoute("/api/colony/bootstrap", 403, null, liteCookie);

  console.log("\nSuite 6: Protected API Routes without Credentials (401 expected)");
  await testRoute("/api/colony/bootstrap", 401);
  await testRoute("/api/admin/tokens", 401);
  await testRoute("/api/admin/commercial-requests", 401);
  await testRoute("/api/admin/commercial-requests/invoice", 401);
  await testRoute("/api/admin/usage", 401);

  console.log("\n===============================================================");
  console.log(`  Results: ${passed} PASS / ${failed} FAIL`);
  console.log(`  Status: ${failed === 0 ? "ALL PASS - Public routes and redirects verified!" : "FAILURES DETECTED"}`);
  console.log("===============================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

main();
