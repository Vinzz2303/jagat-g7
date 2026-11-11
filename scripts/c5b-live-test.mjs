import {
  taskEngine,
  approvalEngine,
  agentRegistry,
  chatEngine,
  agentSimulator,
  commandEngine,
} from "../dist/colony/index.js";
import {
  readFile,
  searchInFiles,
  getTaskBytesUsed,
  resetTaskBytes,
  getWorkerActions,
} from "../dist/colony/worker-sandbox.js";
import { disconnectRedis } from "../dist/services/redis.service.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

try {
  await agentRegistry.seedDefaultAgents();
  const rooms = await chatEngine.seedDefaultRooms();
  const room = rooms.find((r) => r.name === "Colony HQ") ?? rooms[0];
  assert(room, "No colony chat room available");

  const task = await taskEngine.createTask({
    title: "C5B reject gate live verification",
    objective: "Verify rejected founder approval does not continue worker execution",
    phase: "C5",
    sourceOfTruth: "codex-live-c5b-test",
    assignedAgent: "builder",
    priority: "high",
    acceptanceCriteria: [
      "Rejected approval must leave task in planning and must not run worker",
    ],
    founderApprovalRequired: true,
    createdBy: "codex-live-test",
  });

  agentSimulator.simulateAgentResponse(task, room.roomId, "Faturachman Al Kahfi");
  await sleep(6500);

  const pending = await approvalEngine.listPendingApprovals();
  const approval = pending.find((a) => a.taskId === task.taskId);
  assert(approval, `No pending approval created for ${task.taskId}`);

  await approvalEngine.respondToApproval(
    approval.approvalId,
    "rejected",
    "Faturachman Al Kahfi",
    "Live reject gate test",
  );
  await sleep(6500);

  const rejectedTask = await taskEngine.getTask(task.taskId);
  assert(
    rejectedTask?.status === "planning",
    `Rejected task advanced unexpectedly: ${rejectedTask?.status}`,
  );

  const rejectedActions = await getWorkerActions(task.taskId);
  assert(
    rejectedActions.length === 0,
    `Rejected task produced worker actions: ${rejectedActions.length}`,
  );

  let boundaryCode = "";
  try {
    await readFile("c:/JAGAT/src-backup/fake.ts", task.taskId, "builder");
  } catch (err) {
    boundaryCode = err?.code ?? err?.name ?? String(err);
  }
  assert(boundaryCode === "PATH_OUTSIDE_SANDBOX", `Sandbox boundary returned ${boundaryCode}`);

  resetTaskBytes(task.taskId);
  await searchInFiles("export", "c:/JAGAT/src/colony", task.taskId, "builder", {
    maxResults: 1,
  });
  const bytesUsed = getTaskBytesUsed(task.taskId);
  assert(bytesUsed > 0, `Search did not consume byte budget: ${bytesUsed}`);
  const finalActions = await getWorkerActions(task.taskId);
  assert(
    finalActions.some((action) => action.type === "file_read" && action.status === "denied"),
    "Boundary denial was not recorded as a worker action",
  );
  assert(
    finalActions.some((action) => action.type === "search" && action.status === "completed"),
    "Search was not recorded as a completed worker action",
  );

  const workerLog = await commandEngine.executeCommand(
    { command: "worker-log", args: [task.taskId], raw: `/worker-log ${task.taskId}` },
    "Faturachman Al Kahfi",
    "founder",
    room.roomId,
  );
  assert(workerLog.success === true, "Worker log command failed");

  const sandbox = await commandEngine.executeCommand(
    { command: "sandbox", args: [], raw: "/sandbox" },
    "Faturachman Al Kahfi",
    "founder",
    room.roomId,
  );
  assert(sandbox.success === true && sandbox.message.includes("Allowed Roots"), "Sandbox command failed");

  const approvedTask = await taskEngine.createTask({
    title: "C5B approved worker file read verification",
    objective: "Verify approved founder approval runs real worker and records filesystem evidence",
    phase: "C5",
    sourceOfTruth: "codex-live-c5b-test",
    assignedAgent: "builder",
    priority: "high",
    acceptanceCriteria: [
      "Approved approval must move task through real worker execution into review",
      "Real worker must record filesystem actions and attach evidence",
    ],
    founderApprovalRequired: true,
    createdBy: "codex-live-test",
  });

  agentSimulator.simulateAgentResponse(approvedTask, room.roomId, "Faturachman Al Kahfi");
  await sleep(6500);

  const pendingApproved = await approvalEngine.listPendingApprovals();
  const approvalToApprove = pendingApproved.find((a) => a.taskId === approvedTask.taskId);
  assert(approvalToApprove, `No pending approval created for ${approvedTask.taskId}`);

  await approvalEngine.respondToApproval(
    approvalToApprove.approvalId,
    "approved",
    "Faturachman Al Kahfi",
    "Live approved path test",
  );

  let approvedFinalTask = await taskEngine.getTask(approvedTask.taskId);
  for (let i = 0; i < 30 && approvedFinalTask?.status !== "review"; i++) {
    await sleep(2000);
    approvedFinalTask = await taskEngine.getTask(approvedTask.taskId);
  }

  assert(
    approvedFinalTask?.status === "review",
    `Approved task did not reach review: ${approvedFinalTask?.status}`,
  );
  assert(
    (approvedFinalTask.evidence?.length ?? 0) > 0,
    "Approved worker did not attach evidence",
  );

  const approvedActions = await getWorkerActions(approvedTask.taskId);
  assert(
    approvedActions.some((action) => action.type === "search" && action.status === "completed"),
    "Approved worker did not record a completed search action",
  );
  assert(
    approvedActions.some((action) => action.type === "file_read" && action.status === "completed"),
    "Approved worker did not record a completed file_read action",
  );

  console.log(JSON.stringify({
    ok: true,
    rejectedTaskId: task.taskId,
    rejectedApprovalId: approval.approvalId,
    rejectedFinalStatus: rejectedTask.status,
    rejectedWorkerActions: rejectedActions.length,
    sandboxBoundaryCode: boundaryCode,
    searchBytesUsed: bytesUsed,
    finalWorkerActions: finalActions.length,
    workerLogCommand: workerLog.success,
    sandboxCommand: sandbox.success,
    approvedTaskId: approvedTask.taskId,
    approvedApprovalId: approvalToApprove.approvalId,
    approvedFinalStatus: approvedFinalTask.status,
    approvedEvidenceCount: approvedFinalTask.evidence.length,
    approvedWorkerActions: approvedActions.length,
  }, null, 2));
} finally {
  await disconnectRedis();
}
