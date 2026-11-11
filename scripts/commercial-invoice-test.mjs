// Smoke test for manual commercial invoice draft generation (T-033)

const {
  createCommercialRequest,
  generateCommercialInvoiceDraft,
  updateCommercialRequestStatus,
} = await import("../jagat-ui/src/lib/commercial-requests.ts");

let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`  PASS  ${label}`);
}

function notOk(label, reason) {
  fail += 1;
  console.log(`  FAIL  ${label}: ${reason}`);
}

function expect(condition, label, reason = "condition failed") {
  if (condition) ok(label);
  else notOk(label, reason);
}

const request = await createCommercialRequest({
  packageId: "AI_ADMIN_BOT_UMKM",
  clientName: "Invoice Test Client",
  contact: "invoice-test@example.com",
  channel: "email",
  notes: "Butuh FAQ bisnis, katalog layanan, dan laporan mingguan manual.",
  source: "commercial_invoice_test",
});

try {
  await generateCommercialInvoiceDraft(request.id);
  notOk("new request cannot generate invoice draft", "expected rejection");
} catch (error) {
  expect(
    error instanceof Error && error.message.includes("Qualify"),
    "new request must be qualified before invoice draft",
    error instanceof Error ? error.message : String(error),
  );
}

await updateCommercialRequestStatus(request.id, "qualified");
const draft = await generateCommercialInvoiceDraft(request.id, { dueDays: 10, dpPercent: 30 });

expect(draft.requestId === request.id, "draft keeps request id");
expect(draft.invoiceCode === request.invoiceCode, "draft keeps invoice code");
expect(draft.billingMode === "manual_invoice", "draft stays manual invoice mode");
expect(draft.paymentStatus === "not_requested", "draft does not request payment automatically");
expect(draft.markdown.includes(request.clientName), "draft includes client name");
expect(draft.markdown.includes(request.packageName), "draft includes package name");
expect(draft.markdown.includes(request.quotedPrice), "draft includes quoted price");
expect(draft.markdown.includes("30%"), "draft includes configured DP percent");
expect(draft.markdown.includes("tidak mengaktifkan token otomatis"), "draft states no automatic token activation");
expect(draft.markdown.includes("tidak memproses payment gateway"), "draft states no payment gateway processing");
expect(!draft.markdown.includes("5411301142"), "draft does not include bank account number");
expect(!draft.markdown.toLowerCase().includes("rekening"), "draft does not include bank account instructions");
expect(!draft.markdown.toLowerCase().includes("password"), "draft does not include credential text");

const lost = await createCommercialRequest({
  packageId: "WEBSITE_CEPAT",
  clientName: "Invoice Lost Test Client",
  contact: "lost-invoice-test@example.com",
  channel: "email",
  notes: "Tidak jadi lanjut setelah diskusi scope.",
  source: "commercial_invoice_test",
});
await updateCommercialRequestStatus(lost.id, "qualified");
await updateCommercialRequestStatus(lost.id, "closed_lost");

try {
  await generateCommercialInvoiceDraft(lost.id);
  notOk("closed_lost request cannot generate invoice draft", "expected rejection");
} catch (error) {
  expect(
    error instanceof Error && error.message.includes("closed_lost"),
    "closed_lost request is blocked from invoice draft",
    error instanceof Error ? error.message : String(error),
  );
}

console.log("\n===============================================================");
console.log(`  Results: ${pass} PASS / ${fail} FAIL`);
console.log("===============================================================");
console.log("  Note: test records remain in data/commercial_requests.jsonl.");
process.exit(fail > 0 ? 1 : 0);
