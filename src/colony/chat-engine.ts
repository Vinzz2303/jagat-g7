// ============================================================================
// JAGAT Colony — Chat Engine
// Internal chat room colony untuk founder & agent communication
// ============================================================================

import { getRedisClient } from "../services/redis.service.js";
import {
  type ChatMessage,
  type ChatRoom,
  type AgentRole,
  type HumanRole,
  AGENT_ROLES,
  HUMAN_ROLES,
  REDIS_KEYS,
} from "./types.js";

// ── Valid Room Types ─────────────────────────────────────────────────────────
// Defense-in-depth: explicit whitelist prevents invalid room types in Redis.
const VALID_ROOM_TYPES: ReadonlySet<ChatRoom["type"]> = new Set<ChatRoom["type"]>([
  "general",
  "mission",
  "meeting",
  "direct",
]);

// ── ID Generators ───────────────────────────────────────────────────────────

async function nextMessageId(): Promise<string> {
  const redis = getRedisClient();
  const seq = await redis.incr(REDIS_KEYS.messageSequence());
  return `MSG-${Date.now().toString(36)}-${seq}`;
}

function generateRoomId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `room-${slug}-${Date.now().toString(36)}`;
}

// ── Room Management ─────────────────────────────────────────────────────────

export async function createRoom(params: {
  name: string;
  type: ChatRoom["type"];
  participants: string[];
  linkedMissionId?: string;
}): Promise<ChatRoom> {
  // Defense-in-depth: validate room type against whitelist
  if (!VALID_ROOM_TYPES.has(params.type)) {
    throw new Error(
      `Invalid room type "${params.type}". Must be one of: ${[...VALID_ROOM_TYPES].join(", ")}`,
    );
  }

  const redis = getRedisClient();
  const now = new Date().toISOString();
  const roomId = generateRoomId(params.name);

  const room: ChatRoom = {
    roomId,
    name: params.name,
    type: params.type,
    participants: params.participants,
    createdAt: now,
    lastActivity: now,
    linkedMissionId: params.linkedMissionId,
    isArchived: false,
  };

  await redis.set(REDIS_KEYS.chatRoom(roomId), JSON.stringify(room));
  await redis.sadd(REDIS_KEYS.chatRoomIndex(), roomId);

  return room;
}

export async function getRoom(roomId: string): Promise<ChatRoom | null> {
  const redis = getRedisClient();
  const data = await redis.get(REDIS_KEYS.chatRoom(roomId));
  return data ? (JSON.parse(data) as ChatRoom) : null;
}

export async function listRooms(): Promise<ChatRoom[]> {
  const redis = getRedisClient();
  const ids = await redis.smembers(REDIS_KEYS.chatRoomIndex());

  const rooms: ChatRoom[] = [];
  for (const id of ids) {
    const room = await getRoom(id);
    if (room && !room.isArchived) rooms.push(room);
  }

  return rooms.sort((a, b) =>
    new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
  );
}

// ── Message Management ──────────────────────────────────────────────────────

export async function sendMessage(params: {
  roomId: string;
  senderId: string;
  senderRole: AgentRole | HumanRole;
  senderName: string;
  content: string;
  messageType?: ChatMessage["messageType"];
  replyToId?: string;
  linkedTaskId?: string;
  linkedMissionId?: string;
}): Promise<ChatMessage> {
  // Defensive validation: senderRole must be a valid role enum value
  const validRoles: readonly string[] = [...AGENT_ROLES, ...HUMAN_ROLES];
  if (!validRoles.includes(params.senderRole)) {
    throw new Error(
      `Invalid senderRole "${params.senderRole}". Must be one of: ${validRoles.join(", ")}`,
    );
  }

  // Validate room exists before writing message
  const room = await getRoom(params.roomId);
  if (!room) throw new Error(`Room ${params.roomId} not found`);

  const redis = getRedisClient();
  const messageId = await nextMessageId();
  const now = new Date().toISOString();

  const message: ChatMessage = {
    messageId,
    roomId: params.roomId,
    senderId: params.senderId,
    senderRole: params.senderRole,
    senderName: params.senderName,
    content: params.content,
    timestamp: now,
    replyToId: params.replyToId,
    linkedTaskId: params.linkedTaskId,
    linkedMissionId: params.linkedMissionId,
    messageType: params.messageType ?? "text",
  };

  // Store message in room's message list
  await redis.rpush(REDIS_KEYS.chatMessages(params.roomId), JSON.stringify(message));

  // Update room's last activity
  room.lastActivity = now;
  await redis.set(REDIS_KEYS.chatRoom(params.roomId), JSON.stringify(room));

  return message;
}

export async function getRoomMessages(
  roomId: string,
  limit = 50,
  offset = 0,
): Promise<{ messages: ChatMessage[]; total: number }> {
  const redis = getRedisClient();
  const total = await redis.llen(REDIS_KEYS.chatMessages(roomId));

  // Get messages from newest to oldest
  const start = Math.max(0, total - offset - limit);
  const end = total - offset - 1;

  const raw = await redis.lrange(REDIS_KEYS.chatMessages(roomId), start, end);
  const messages = raw.map((r) => JSON.parse(r) as ChatMessage);

  return { messages, total };
}

// ── Seed Default Room ───────────────────────────────────────────────────────

export async function seedDefaultRooms(): Promise<ChatRoom[]> {
  const redis = getRedisClient();
  const existingIds = await redis.smembers(REDIS_KEYS.chatRoomIndex());

  if (existingIds.length > 0) {
    const rooms: ChatRoom[] = [];
    for (const id of existingIds) {
      const r = await getRoom(id);
      if (r) rooms.push(r);
    }
    return rooms;
  }

  const defaultRooms = [
    {
      name: "Colony HQ",
      type: "general" as const,
      participants: ["founder", "director", "planner", "researcher", "builder", "reviewer", "reporter"],
    },
    {
      name: "Mission Briefing",
      type: "meeting" as const,
      participants: ["founder", "director", "planner"],
    },
    {
      name: "Build & Review",
      type: "general" as const,
      participants: ["builder", "reviewer", "planner"],
    },
  ];

  const rooms: ChatRoom[] = [];
  for (const seed of defaultRooms) {
    const room = await createRoom(seed);
    rooms.push(room);
  }

  // Send welcome message to HQ
  if (rooms[0]) {
    await sendMessage({
      roomId: rooms[0].roomId,
      senderId: "system",
      senderRole: "founder",
      senderName: "JAGAT Colony System",
      content: "Colony HQ initialized. Semua unit colony siap menerima arahan founder.",
      messageType: "system",
    });
  }

  console.log(`[Colony] Seeded ${rooms.length} default chat rooms.`);
  return rooms;
}
