#!/usr/bin/env node
import { parseFounderOptedBacklog, isLowRiskBacklogItem } from "../dist/colony/backlog-intake.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

let failures = 0;
function check(name, condition) {
  if (condition) console.log(`PASS ${name}`);
  else { failures++; console.error(`FAIL ${name}`); }
}

const header = "| ID | Phase | Task | Owner | Risk | Acceptance Criteria | Status |";
const separator = "| --- | --- | --- | --- | --- | --- | --- |";
const rows = [
  "| T-901 | C6 | Review dashboard labels | Builder | Low | Labels match source fields | Auto-Propose |",
  "| T-902 | C6 | Planned review | Builder | Low | No action until opted in | Planned |",
].join("\n");
const parsed = parseFounderOptedBacklog(`${header}\n${separator}\n${rows}`, "fixture.md");
check("parses opted-in row only", parsed.length === 1 && parsed[0]?.id === "T-901");
check("retains source of truth", parsed[0]?.sourceOfTruth === "fixture.md");
check("rejects high-risk intake terms", parsed[0] !== undefined && !isLowRiskBacklogItem({ ...parsed[0], title: "Review auth config" }));
check("rejects prose containing header labels", parseFounderOptedBacklog(`| ID | appears in prose | Status |\n${separator}\n${rows}`, "fixture.md").length === 0);
check("fails closed on duplicate status column", parseFounderOptedBacklog(`${header.slice(0, -1)} Status |\n${separator}\n${rows}`, "fixture.md").length === 0);
check("fails closed on duplicate required column", parseFounderOptedBacklog(`${header.replace("| Task |", "| Task | Task |")}\n${separator}\n${rows}`, "fixture.md").length === 0);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const file of ["ops/TECHNICAL_BACKLOG.md", "ops/PRODUCT_BACKLOG.md"]) {
  const actual = parseFounderOptedBacklog(await readFile(path.join(root, file), "utf8"), file).filter(isLowRiskBacklogItem);
  check(`${file} has no low-risk Auto-Propose rows`, actual.length === 0);
}

console.log(`Backlog intake parser: ${failures === 0 ? "PASS" : "FAIL"} (${failures} failures)`);
if (failures) process.exitCode = 1;
