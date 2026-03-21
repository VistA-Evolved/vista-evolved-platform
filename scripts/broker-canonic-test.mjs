#!/usr/bin/env node
/**
 * Broker Canonicalization Test — Task 4
 *
 * Proves the XWB broker client can:
 *   1. Connect + authenticate against the live VistA distro UTF-8 lane
 *   2. Execute 3+ read-only RPCs that return real VistA data
 *   3. Disconnect cleanly
 *
 * Usage:
 *   VISTA_HOST=127.0.0.1 VISTA_PORT=9434 \
 *   VISTA_ACCESS_CODE=PRO1234 VISTA_VERIFY_CODE=PRO1234!! \
 *   node scripts/broker-canonic-test.mjs
 *
 * Returns JSON evidence to stdout.
 */

import { XwbBroker } from '../apps/tenant-admin/lib/xwb-client.mjs';

const HOST = process.env.VISTA_HOST || '127.0.0.1';
const PORT = parseInt(process.env.VISTA_PORT || '9434', 10);
const ACCESS = process.env.VISTA_ACCESS_CODE || 'PRO1234';
const VERIFY = process.env.VISTA_VERIFY_CODE || 'PRO1234!!';
// Post-restart can be slow — first connection bootstraps YottaDB shared memory.
process.env.VISTA_TIMEOUT_MS = process.env.VISTA_TIMEOUT_MS || '30000';

const evidence = {
  testName: 'broker-canonicalization',
  timestamp: new Date().toISOString(),
  host: HOST,
  port: PORT,
  steps: [],
};

function step(name, pass, detail) {
  evidence.steps.push({ name, pass, detail, at: new Date().toISOString() });
  const tag = pass ? 'PASS' : 'FAIL';
  process.stderr.write(`[${tag}] ${name}\n`);
}

async function main() {
  const broker = new XwbBroker();

  // Step 1: Connect + Authenticate
  try {
    await broker.connect({ host: HOST, port: PORT, accessCode: ACCESS, verifyCode: VERIFY });
    step('connect-authenticate', true, {
      duz: broker.duz,
      userName: broker.userName,
      connected: broker.connected,
    });
  } catch (err) {
    step('connect-authenticate', false, { error: err.message });
    console.log(JSON.stringify(evidence, null, 2));
    process.exit(1);
  }

  // Step 2: ORWU NEWPERS — list users matching a search string
  try {
    const lines = await broker.callRpc('ORWU NEWPERS', ['PRO', '1']);
    step('rpc-ORWU-NEWPERS', lines.length > 0, {
      rpc: 'ORWU NEWPERS',
      params: ['PRO', '1'],
      lineCount: lines.length,
      sample: lines.slice(0, 5),
    });
  } catch (err) {
    step('rpc-ORWU-NEWPERS', false, { error: err.message });
  }

  // Step 3: XUS DIVISION GET — list divisions for current user
  try {
    const lines = await broker.callRpc('XUS DIVISION GET');
    step('rpc-XUS-DIVISION-GET', true, {
      rpc: 'XUS DIVISION GET',
      lineCount: lines.length,
      sample: lines.slice(0, 5),
    });
  } catch (err) {
    step('rpc-XUS-DIVISION-GET', false, { error: err.message });
  }

  // Step 4: ORWU CLINLOC — list clinics matching a search string
  // CLINLOC^ORWU expects (ORWLC,FROM,DIR) — 3 params max. Extra params cause ACTLSTTOOLONG.
  try {
    const lines = await broker.callRpc('ORWU CLINLOC', ['A', '1']);
    const hasData = lines.length > 0 && !lines[0].includes('ERROR');
    step('rpc-ORWU-CLINLOC', hasData, {
      rpc: 'ORWU CLINLOC',
      params: ['A', '1'],
      lineCount: lines.length,
      sample: lines.slice(0, 5),
    });
  } catch (err) {
    step('rpc-ORWU-CLINLOC', false, { error: err.message });
  }

  // Step 5: ORQPT WARDS — list wards
  try {
    const lines = await broker.callRpc('ORQPT WARDS');
    step('rpc-ORQPT-WARDS', true, {
      rpc: 'ORQPT WARDS',
      lineCount: lines.length,
      sample: lines.slice(0, 5),
    });
  } catch (err) {
    step('rpc-ORQPT-WARDS', false, { error: err.message });
  }

  // Step 6: XUS GET USER INFO — current user info
  try {
    const lines = await broker.callRpc('XUS GET USER INFO');
    step('rpc-XUS-GET-USER-INFO', true, {
      rpc: 'XUS GET USER INFO',
      lineCount: lines.length,
      sample: lines.slice(0, 10),
    });
  } catch (err) {
    step('rpc-XUS-GET-USER-INFO', false, { error: err.message });
  }

  // Step 7: ORWU HASKEY — check for security key
  try {
    const lines = await broker.callRpc('ORWU HASKEY', ['PROVIDER']);
    const has = lines[0]?.trim();
    step('rpc-ORWU-HASKEY', true, {
      rpc: 'ORWU HASKEY',
      params: ['PROVIDER'],
      result: has,
      lineCount: lines.length,
    });
  } catch (err) {
    step('rpc-ORWU-HASKEY', false, { error: err.message });
  }

  // Step 8: Disconnect
  try {
    broker.disconnect();
    step('disconnect', true, { connected: broker.connected });
  } catch (err) {
    step('disconnect', false, { error: err.message });
  }

  // Summary
  const passed = evidence.steps.filter(s => s.pass).length;
  const total = evidence.steps.length;
  evidence.summary = { passed, total, allPass: passed === total };

  console.log(JSON.stringify(evidence, null, 2));
  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  step('unhandled', false, { error: err.message });
  console.log(JSON.stringify(evidence, null, 2));
  process.exit(1);
});
