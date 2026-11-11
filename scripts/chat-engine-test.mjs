#!/usr/bin/env node
/**
 * JAGAT Colony — Chat Engine Test
 * Covers: createRoom, getRoom, listRooms, sendMessage, getRoomMessages
 * Focus: orphan message prevention, invalid role rejection, pagination
 */

import {
  chatEngine,
} from "../dist/colony/index.js";
import { disconnectRedis, getRedisClient } from "../dist/services/redis.service.js";

let passCount = 0;
let failCount = 0;

function pass(message) {
  passCount += 1;
  console.log(`  ✅ PASS  ${message}`);
}

function fail(message, detail = "") {
  failCount += 1;
  console.error(`  ❌ FAIL  ${message}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("===============================================================");
  console.log("  JAGAT Colony — Chat Engine Test");
  console.log("===============================================================\n");

  const redis = getRedisClient();
  const createdRoomIds = [];
  const ts = Date.now();

  try {
    // ── Suite 1: Room creation and retrieval ──────────────────────
    console.log("💬 Suite 1: Room creation and retrieval");

    const room = await chatEngine.createRoom({
      name: `chat-test-${ts}`,
      type: "general",
      participants: ["founder", "builder"],
    });
    createdRoomIds.push(room.roomId);

    if (room.roomId && room.roomId.startsWith("room-")) {
      pass("createRoom returns valid roomId");
    } else {
      fail("createRoom returns valid roomId", `got: ${room.roomId}`);
    }

    if (room.name === `chat-test-${ts}`) {
      pass("createRoom preserves name");
    } else {
      fail("createRoom preserves name", `got: ${room.name}`);
    }

    if (room.type === "general") {
      pass("createRoom preserves type");
    } else {
      fail("createRoom preserves type", `got: ${room.type}`);
    }

    if (Array.isArray(room.participants) && room.participants.includes("founder")) {
      pass("createRoom preserves participants");
    } else {
      fail("createRoom preserves participants");
    }

    const retrieved = await chatEngine.getRoom(room.roomId);
    if (retrieved && retrieved.roomId === room.roomId) {
      pass("getRoom retrieves stored room");
    } else {
      fail("getRoom retrieves stored room");
    }

    const notFound = await chatEngine.getRoom("room-nonexistent");
    if (notFound === null) {
      pass("getRoom returns null for missing room");
    } else {
      fail("getRoom returns null for missing room");
    }

    // ── Suite 2: listRooms ────────────────────────────────────────
    console.log("\n📋 Suite 2: listRooms");

    const rooms = await chatEngine.listRooms();
    if (Array.isArray(rooms) && rooms.length > 0) {
      pass("listRooms returns array of rooms");
    } else {
      fail("listRooms returns array of rooms", `got length: ${rooms.length}`);
    }

    // All rooms should be non-archived
    const hasArchived = rooms.some((r) => r.isArchived);
    if (!hasArchived) {
      pass("listRooms excludes archived rooms");
    } else {
      fail("listRooms excludes archived rooms");
    }

    // Rooms should be sorted by lastActivity descending
    if (rooms.length >= 2) {
      const sorted = rooms.every((r, i) =>
        i === 0 || new Date(rooms[i - 1].lastActivity).getTime() >= new Date(r.lastActivity).getTime(),
      );
      if (sorted) {
        pass("listRooms sorted by lastActivity descending");
      } else {
        fail("listRooms sorted by lastActivity descending");
      }
    } else {
      pass("listRooms sorted check (skip, < 2 rooms)");
    }

    // ── Suite 3: sendMessage — validation ─────────────────────────
    console.log("\n📨 Suite 3: sendMessage — validation");

    // Valid message
    const msg = await chatEngine.sendMessage({
      roomId: room.roomId,
      senderId: "founder",
      senderRole: "founder",
      senderName: "Mas Fatur",
      content: `Test message ${ts}`,
    });
    if (msg.messageId && msg.messageId.startsWith("MSG-")) {
      pass("sendMessage returns valid messageId");
    } else {
      fail("sendMessage returns valid messageId", `got: ${msg.messageId}`);
    }

    if (msg.content === `Test message ${ts}`) {
      pass("sendMessage preserves content");
    } else {
      fail("sendMessage preserves content");
    }

    // Invalid senderRole — should throw
    try {
      await chatEngine.sendMessage({
        roomId: room.roomId,
        senderId: "hacker",
        senderRole: "invalid_role_xyz",
        senderName: "Hacker",
        content: "Should fail",
      });
      fail("sendMessage rejects invalid senderRole");
    } catch (err) {
      if (err.message.includes("Invalid senderRole")) {
        pass("sendMessage rejects invalid senderRole");
      } else {
        fail("sendMessage rejects invalid senderRole", err.message);
      }
    }

    // Non-existent room — should throw (orphan message prevention)
    try {
      await chatEngine.sendMessage({
        roomId: "room-does-not-exist",
        senderId: "founder",
        senderRole: "founder",
        senderName: "Mas Fatur",
        content: "Should fail — orphan",
      });
      fail("sendMessage rejects non-existent room (orphan prevention)");
    } catch (err) {
      if (err.message.includes("not found")) {
        pass("sendMessage rejects non-existent room (orphan prevention)");
      } else {
        fail("sendMessage rejects non-existent room (orphan prevention)", err.message);
      }
    }

    // ── Suite 4: getRoomMessages — retrieval + pagination ─────────
    console.log("\n📜 Suite 4: getRoomMessages — retrieval + pagination");

    // Send a few more messages
    for (let i = 0; i < 3; i++) {
      await chatEngine.sendMessage({
        roomId: room.roomId,
        senderId: "builder",
        senderRole: "builder",
        senderName: "Builder",
        content: `Pagination test ${i}`,
      });
    }

    const result = await chatEngine.getRoomMessages(room.roomId);
    if (result.total >= 4) {
      pass("getRoomMessages returns correct total (≥ 4)");
    } else {
      fail("getRoomMessages returns correct total", `got: ${result.total}`);
    }

    if (Array.isArray(result.messages) && result.messages.length >= 4) {
      pass("getRoomMessages returns messages array");
    } else {
      fail("getRoomMessages returns messages array", `got: ${result.messages.length}`);
    }

    // Pagination: limit=2
    const limited = await chatEngine.getRoomMessages(room.roomId, 2);
    if (limited.messages.length === 2) {
      pass("getRoomMessages respects limit=2");
    } else {
      fail("getRoomMessages respects limit=2", `got: ${limited.messages.length}`);
    }

    // Pagination: offset
    const offsetResult = await chatEngine.getRoomMessages(room.roomId, 2, 2);
    if (offsetResult.messages.length <= 2 && offsetResult.total === result.total) {
      pass("getRoomMessages offset preserves total");
    } else {
      fail("getRoomMessages offset preserves total");
    }

    // ── Suite 5: Room activity update ─────────────────────────────
    console.log("\n⏱️ Suite 5: Room activity update");

    const roomBefore = await chatEngine.getRoom(room.roomId);
    const lastActivityBefore = roomBefore?.lastActivity;

    // Small delay to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 50));

    await chatEngine.sendMessage({
      roomId: room.roomId,
      senderId: "founder",
      senderRole: "founder",
      senderName: "Mas Fatur",
      content: "Activity update check",
    });

    const roomAfter = await chatEngine.getRoom(room.roomId);
    if (roomAfter && roomAfter.lastActivity !== lastActivityBefore) {
      pass("sendMessage updates room lastActivity");
    } else {
      fail("sendMessage updates room lastActivity");
    }

    // ── Suite 6: Seed default rooms ───────────────────────────────
    console.log("\n🌱 Suite 6: seedDefaultRooms");

    // seedDefaultRooms should be a function
    if (typeof chatEngine.seedDefaultRooms === "function") {
      pass("seedDefaultRooms is callable");
    } else {
      fail("seedDefaultRooms is callable");
    }

  } catch (err) {
    console.error("\n💥 Unexpected error:", err.message);
    failCount += 1;
  } finally {
    // Cleanup: delete test rooms from Redis
    for (const roomId of createdRoomIds) {
      try {
        await redis.del(`colony:chatroom:${roomId}`);
        await redis.srem("colony:chatroom:index", roomId);
        await redis.del(`colony:chatroom:${roomId}:messages`);
      } catch { /* best-effort cleanup */ }
    }
    await disconnectRedis();
  }

  console.log("\n===============================================================");
  console.log(`  Results: ${passCount} PASS / ${failCount} FAIL`);
  console.log("===============================================================\n");
  process.exit(failCount > 0 ? 1 : 0);
}

main();
