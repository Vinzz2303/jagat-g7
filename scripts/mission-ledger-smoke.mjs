/** Run AFTER npm run build and npm install. No external services touched. */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const temp = mkdtempSync(path.join(tmpdir(), 'jagat-ledger-test-'));
process.env.JAGAT_MISSION_LEDGER_ENABLED = 'true';
process.env.JAGAT_MISSION_LEDGER_PATH = path.join(temp, 'state.sqlite');
const ledger = await import('../dist/colony/mission-ledger.js');
try {
  const timestamp = new Date().toISOString();
  const mission = { id: 'MISSION-test', title: 'Test', objective: 'Durable task', phase: 'C4', status: 'active', priority: 'medium', createdBy: 'test', createdAt: timestamp, updatedAt: timestamp, workstreamIds: [] };
  ledger.saveMission(mission);
  assert.equal(ledger.loadMission(mission.id)?.title, 'Test');
  const task = { taskId: 'TASK-test', title: 'Test task', objective: 'Check state', phase: 'C4', sourceOfTruth: 'test', assignedAgent: 'researcher', status: 'queued', priority: 'medium', acceptanceCriteria: ['has result'], dependencies: [], evidence: [], lastUpdate: timestamp, founderApprovalRequired: false, missionId: mission.id, createdAt: timestamp, createdBy: 'test' };
  const first = ledger.saveNewTask(task, 'test');
  const second = ledger.saveTaskUpdate({ ...first, status: 'planning' }, first, { type: 'status', actor: 'test', reason: 'Plan task' });
  assert.equal(second.ledgerVersion, 2);
  assert.throws(() => ledger.saveTaskUpdate({ ...first, status: 'planning' }, first, { type: 'status', actor: 'test', reason: 'Stale attempt' }), /Concurrent task modification/);
  assert.equal(ledger.loadTask(task.taskId)?.status, 'planning');
  assert.equal(ledger.loadTaskTransitions(task.taskId).length, 2);
  ledger.closeMissionLedger();
  assert.equal(ledger.loadTask(task.taskId)?.status, 'planning', 'State must survive closing and reopening database');
  assert.deepEqual(ledger.getLedgerCounts(), { missions: 1, tasks: 1, events: 2 });
  console.log('PASS: durable mission/task state, events, CAS, restart');
} finally {
  ledger.closeMissionLedger();
  rmSync(temp, { recursive: true, force: true });
}
