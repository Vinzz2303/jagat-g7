#!/usr/bin/env node
import net from "node:net";

const BACKEND_HOST = process.env.JAGAT_TEST_HOST || "127.0.0.1";
const BACKEND_PORT = Number(process.env.JAGAT_BACKEND_PORT || 5000);
const COLONY_INTERNAL_SECRET = process.env.COLONY_INTERNAL_SECRET || "jagat-colony-internal-2026";

let passCount = 0;
let failCount = 0;

function pass(message) {
  passCount += 1;
  console.log(`  PASS  ${message}`);
}

function fail(message, detail = "") {
  failCount += 1;
  console.error(`  FAIL  ${message}${detail ? ` - ${detail}` : ""}`);
}

function assert(message, condition, detail = "") {
  if (condition) pass(message);
  else fail(message, detail);
}

function rawRequest(headerLines) {
  const raw = [
    "GET /colony/stats HTTP/1.1",
    `Host: ${BACKEND_HOST}:${BACKEND_PORT}`,
    ...headerLines,
    "Connection: close",
    "",
    "",
  ].join("\r\n");

  return new Promise((resolve, reject) => {
    const socket = net.createConnection(BACKEND_PORT, BACKEND_HOST, () => socket.write(raw));
    let data = "";

    socket.on("data", (chunk) => {
      data += chunk.toString("utf8");
    });
    socket.on("end", () => {
      const statusLine = data.split("\r\n")[0] || "";
      const status = Number(statusLine.split(" ")[1] || 0);
      resolve({ status, body: data });
    });
    socket.on("error", reject);
  });
}

function validHeaders(overrides = []) {
  return [
    `X-Colony-Secret: ${COLONY_INTERNAL_SECRET}`,
    "X-Colony-Caller: Auth Hardening Test",
    "X-Colony-Tier: SOVEREIGN",
    "X-Colony-Token: auth-header-hardening-test",
    ...overrides,
  ];
}

async function main() {
  console.log("===============================================================");
  console.log("  JAGAT Colony - Auth Header Hardening Test");
  console.log("===============================================================");

  const valid = await rawRequest(validHeaders());
  assert("Valid single identity headers are accepted", valid.status === 200, `got ${valid.status}`);

  const duplicateCaller = await rawRequest(validHeaders(["X-Colony-Caller: Duplicate Caller"]));
  assert("Duplicate X-Colony-Caller is rejected", duplicateCaller.status === 400, `got ${duplicateCaller.status}`);

  const duplicateTier = await rawRequest(validHeaders(["X-Colony-Tier: SOVEREIGN"]));
  assert("Duplicate X-Colony-Tier is rejected", duplicateTier.status === 400, `got ${duplicateTier.status}`);

  const duplicateToken = await rawRequest(validHeaders(["X-Colony-Token: duplicate-token"]));
  assert("Duplicate X-Colony-Token is rejected", duplicateToken.status === 400, `got ${duplicateToken.status}`);

  const duplicateSecret = await rawRequest(validHeaders([`X-Colony-Secret: ${COLONY_INTERNAL_SECRET}`]));
  assert("Duplicate X-Colony-Secret is rejected", duplicateSecret.status === 400, `got ${duplicateSecret.status}`);

  console.log("===============================================================");
  console.log(`  Results: ${passCount} PASS / ${failCount} FAIL`);
  console.log("===============================================================");

  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
