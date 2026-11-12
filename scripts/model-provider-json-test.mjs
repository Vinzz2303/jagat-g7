#!/usr/bin/env node
// Offline tests: real TypeScript source, stubbed imports and fetch. No bots start.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { test, after } from 'node:test';

const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source = (name) => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8');
const js = (text) => stripTypeScriptTypes(text, { mode: 'strip' });
const configUrl = url(`export const env = { OLLAMA_HOST:'http://local.invalid', REMOTE_OLLAMA_HOST:'http://remote.invalid', OLLAMA_REMOTE_ENABLED:'false', REMOTE_INFERENCE_MODEL:'remote-model' };`);
const identityUrl = url('export const composeSovereignSystemPrompt = text => text;');
const normalizerUrl = url(js(await source('services/model-response.ts')));
const ollamaUrl = url(js((await source('services/ollama.ts')).replace('../config/index.js', configUrl).replace('../prompts/identity.js', identityUrl)));
const hybridUrl = url(js((await source('services/hybrid-router.ts')).replace('./ollama.js', ollamaUrl).replace('./model-response.js', normalizerUrl).replace("import * as dotenv from 'dotenv';", 'const dotenv = { config() {} };')));
const { normalizeModelResponse } = await import(normalizerUrl);
const { OllamaService } = await import(ollamaUrl);
const { env } = await import(configUrl);
const { HybridRouter } = await import(hybridUrl);
const originalFetch = globalThis.fetch;
const originalGroqKey = process.env.GROQ_API_KEY;
const originalGeminiKey = process.env.GEMINI_API_KEY;
// A test that forgets to install a stub must fail, never reach a real endpoint.
globalThis.fetch = async () => { throw new Error('Unexpected fetch in offline test'); };
after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of [['GROQ_API_KEY', originalGroqKey], ['GEMINI_API_KEY', originalGeminiKey]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
const groq = (content) => response({ choices: [{ message: { content } }] });
const local = (text) => response({ response: text });

test('normalizer accepts object and complete JSON fence only', () => {
  assert.equal(normalizeModelResponse(' {"intent":"CASUAL_CHAT"} ', true), '{"intent":"CASUAL_CHAT"}');
  assert.equal(normalizeModelResponse('```json\n{"ok":true}\n```', true), '{"ok":true}');
});
test('normalizer rejects malformed, partial, prose, primitive, and array JSON', () => {
  for (const item of ['', undefined, 'Berikut adalah {"intent":"START_SWARM"}', '{"intent":"START_SWARM"', '[]', 'null', '42', '"text"', '{} {}']) {
    assert.throws(() => normalizeModelResponse(item, true));
  }
});
test('plain-text path remains plain text', () => assert.equal(normalizeModelResponse(' Halo ', false), 'Halo'));
test('Groq uses supported model, JSON mode, and bounded request', async () => {
  process.env.GROQ_API_KEY = 'synthetic';
  globalThis.fetch = async (target, init) => {
    assert.equal(target, 'https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'llama-3.1-8b-instant');
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.ok(init.signal instanceof AbortSignal);
    return groq('{"intent":"CASUAL_CHAT"}');
  };
  assert.equal(await HybridRouter.callGroqFast('synthetic', 'JSON', true), '{"intent":"CASUAL_CHAT"}');
});
test('Groq missing key uses Ollama with top-level format, not options.format', async () => {
  delete process.env.GROQ_API_KEY;
  globalThis.fetch = async (target, init) => {
    assert.equal(target, 'http://local.invalid/api/generate');
    const body = JSON.parse(init.body);
    assert.equal(body.format, 'json');
    assert.equal(body.options.format, undefined);
    return local('{"ok":true}');
  };
  assert.equal(await HybridRouter.callGroqFast('synthetic', 'JSON', true), '{"ok":true}');
});
test('invalid Groq response falls back once and validates local JSON', async () => {
  process.env.GROQ_API_KEY = 'synthetic'; let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? groq('not JSON') : local('{"ok":true}');
  assert.equal(await HybridRouter.callGroqFast('synthetic', 'JSON', true), '{"ok":true}');
  assert.equal(calls, 2);
});
test('provider failure plus malformed local JSON fails closed', async () => {
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? response({}, 400) : local('{"intent":"START_SWARM"');
  await assert.rejects(HybridRouter.callGroqFast('synthetic', 'JSON', true), /invalid JSON/);
  assert.equal(calls, 2);
});
test('Gemini agentic requests JSON MIME and a bounded request', async () => {
  process.env.GEMINI_API_KEY = 'synthetic';
  globalThis.fetch = async (_target, init) => {
    assert.equal(JSON.parse(init.body).generationConfig.responseMimeType, 'application/json');
    assert.ok(init.signal instanceof AbortSignal);
    return response({ candidates: [{ content: { parts: [{ text: '{"action":"reply","replyText":"ok"}' }] } }] });
  };
  assert.equal(JSON.parse(await HybridRouter.callGeminiAgentic('synthetic', 'JSON')).action, 'reply');
});
test('Gemini quota failure uses validated local JSON fallback', async () => {
  let calls = 0;
  globalThis.fetch = async (_target, init) => {
    if (++calls === 1) return response({}, 402);
    assert.equal(JSON.parse(init.body).format, 'json');
    return local('{"action":"reply","replyText":"local"}');
  };
  assert.equal(JSON.parse(await HybridRouter.callGeminiAgentic('synthetic', 'JSON')).replyText, 'local');
  assert.equal(calls, 2);
});
test('empty Gemini smart response uses text fallback', async () => {
  let calls = 0;
  globalThis.fetch = async (_target, init) => {
    if (++calls === 1) { assert.ok(init.signal); return response({ candidates: [] }); }
    assert.equal(JSON.parse(init.body).format, undefined);
    return local('local response');
  };
  assert.equal(await HybridRouter.callGeminiSmart('synthetic'), 'local response');
});
test('Ollama remote fallback preserves JSON format and existing opt-in route', async () => {
  env.OLLAMA_REMOTE_ENABLED = 'true'; const service = new OllamaService();
  const targets = [];
  globalThis.fetch = async (target, init) => {
    targets.push(target); assert.equal(JSON.parse(init.body).format, 'json');
    if (targets.length === 1) throw new Error('synthetic remote failure');
    return local('{}');
  };
  await service.generateCompletion('synthetic', 'JSON', 'test-model', {}, undefined, 'json');
  assert.deepEqual(targets, ['http://remote.invalid/api/generate', 'http://local.invalid/api/generate']);
  env.OLLAMA_REMOTE_ENABLED = 'false';
});
test('Ollama cancellation still prevents local fallback', async () => {
  env.OLLAMA_REMOTE_ENABLED = 'true'; const service = new OllamaService();
  const controller = new AbortController(); let calls = 0;
  globalThis.fetch = async () => { calls++; controller.abort(); throw new Error('aborted'); };
  await assert.rejects(service.generateCompletion('synthetic', 'JSON', 'model', {}, controller.signal, 'json'));
  assert.equal(calls, 1); env.OLLAMA_REMOTE_ENABLED = 'false';
});
const bot = await source('colony/telegram-bot.ts');
const intentSource = bot.slice(bot.indexOf('async function evaluateJagatIntent'), bot.indexOf("botJagat.on('text'"));
let intentOutput;
const evaluate = new Function('HybridRouter', 'JAGAT_ROUTER_PROMPT', `${js(intentSource)}; return evaluateJagatIntent;`)({
  async callGroqFast(_prompt, _system, jsonMode) { assert.equal(jsonMode, true); return intentOutput; }
}, 'synthetic');
test('intent classifier accepts only whitelisted valid object output', async () => {
  for (const intent of ['CASUAL_CHAT', 'FIND_PROSPECT', 'START_SWARM', 'IT_COMMAND', 'FIND_VENTURE', 'JARVIS_MODE']) {
    intentOutput = JSON.stringify({ intent }); assert.equal(await evaluate('synthetic', []), intent);
  }
  for (const value of ['{"intent":"UNKNOWN"}', '{"intent":"START_SWARM"', 'text {"intent":"START_SWARM"}', '[]', 'null']) {
    intentOutput = value; assert.equal(await evaluate('synthetic', []), 'CASUAL_CHAT');
  }
});
test('model-generated shell execution denial remains present', () => {
  assert.match(bot, /if \(aiResponse.action === 'run_command'\) \{\s*finalReply = "Eksekusi shell dari keluaran model dinonaktifkan\./);
});
