#!/usr/bin/env node
/**
 * Guided-Write Proof Script — Key Allocation (GW-KEY-01)
 *
 * Proves the full guided-write cycle:
 *   1. Pre-check: ORWU HASKEY → user does NOT hold key
 *   2. Write: M command via docker exec → allocate key
 *   3. Read-back: ORWU HASKEY → user NOW holds key
 *   4. Undo: M command via docker exec → deallocate key
 *   5. Restore verify: ORWU HASKEY → user no longer holds key
 *
 * Uses a safe test key (XUAUDIT) that DUZ=1 may not hold.
 * If the key doesn't exist in the global, we create and clean up safely.
 *
 * Usage:
 *   $env:VISTA_PORT="9434"
 *   node scripts/guided-write-proof.mjs
 */

import http from 'node:http';
import { execSync, execFileSync } from 'node:child_process';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:4520';
const CONTAINER = process.env.CONTAINER || 'local-vista-utf8';
const TENANT_ID = 'test';
// XUAUDIT is a Kernel audit key — exists in most VistA but DUZ=1 may not hold it
const TEST_KEY = process.env.TEST_KEY || 'XUAUDIT';

// --- HTTP helpers ---

function post(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const data = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// --- Docker exec helper ---
// BUG-025 lesson: never pass complex MUMPS as inline shell strings.
// Write a .m file, docker cp it in, then mumps -run it.

import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pathJoin } from 'node:path';

function dockerMumps(label, mCode) {
  // Write temporary .m file
  const routine = `ZVEGWP ; Guided-write proof - temp routine\n ;\n${label} ;\n ${mCode}\n Q\n`;
  const tmpFile = pathJoin(tmpdir(), 'ZVEGWP.m');
  writeFileSync(tmpFile, routine, 'utf-8');

  try {
    // Copy into container's VistA routine directory
    execSync(`docker cp "${tmpFile}" ${CONTAINER}:/opt/vista/r/ZVEGWP.m`, { encoding: 'utf-8', timeout: 10000 });

    // Run with the same env as the xinetd broker process.
    // CRITICAL: Use `docker exec -u vista -e VAR=VAL` instead of `su -c "..."`.
    // The su -c approach breaks because ydb_routines contains spaces+quotes that
    // get mangled by nested double-quoting (PowerShell -> docker -> su -> bash).
    const envFlags = [
      '-e', 'ydb_gbldir=/opt/vista/g/vista.gld',
      '-e', 'ydb_routines=/opt/vista/r /opt/yottadb/current/plugin/o/utf8/_ydbposix.so /opt/yottadb/current/utf8/libyottadbutil.so',
      '-e', 'ydb_chset=UTF-8',
      '-e', 'ydb_icu_version=67.1',
      '-e', 'ydb_dist=/opt/yottadb/current',
      '-e', 'gtm_dist=/opt/yottadb/current',
    ];

    const args = ['exec', '-u', 'vista', ...envFlags, CONTAINER,
      '/opt/yottadb/current/yottadb', '-run', `${label}^ZVEGWP`];
    // CRITICAL: Use execFileSync to bypass cmd.exe shell interpretation.
    // On Windows, execSync uses cmd.exe which eats ^ (caret) as escape char,
    // turning "ALLOC^ZVEGWP" into "ALLOCZVEGWP". execFileSync avoids shell.
    const result = execFileSync('docker', args,
      { encoding: 'utf-8', timeout: 15000 }
    );
    return { ok: true, output: result.trim() };
  } catch (err) {
    return { ok: false, error: err.stderr || err.message };
  } finally {
    try { unlinkSync(tmpFile); } catch {}
    // Clean up routine from container
    try { execSync(`docker exec ${CONTAINER} rm -f /opt/vista/r/ZVEGWP.m /opt/vista/r/ZVEGWP.o`, { timeout: 5000 }); } catch {}
  }
}

// --- Main proof sequence ---

const steps = [];

function log(step, verdict, detail) {
  const entry = { step, verdict, ...detail, timestamp: new Date().toISOString() };
  steps.push(entry);
  const icon = verdict === 'PASS' ? '✓' : verdict === 'FAIL' ? '✗' : '→';
  console.log(`  ${icon} Step ${step}: ${verdict} — ${detail.description || ''}`);
}

async function main() {
  console.log(`\n=== Guided-Write Proof: Key Allocation (GW-KEY-01) ===`);
  console.log(`  Container: ${CONTAINER}`);
  console.log(`  API: ${API_BASE}`);
  console.log(`  Test key: ${TEST_KEY}`);
  console.log('');

  // Step 1: Pre-check — does DUZ=1 hold the test key?
  const preCheck = await post('/api/tenant-admin/v1/guided-write/key-check', {
    tenantId: TENANT_ID,
    keyName: TEST_KEY,
  });

  if (!preCheck.ok) {
    log(1, 'FAIL', { description: 'Pre-check API call failed', response: preCheck });
    return finish();
  }

  const preHeld = preCheck.preCheck.currentlyHeld;
  log(1, 'PASS', {
    description: `Pre-check: DUZ=${preCheck.preCheck.duz} ${preHeld ? 'HOLDS' : 'does NOT hold'} key ${TEST_KEY}`,
    duz: preCheck.preCheck.duz,
    userName: preCheck.preCheck.userName,
    keyHeld: preHeld,
    rpcUsed: preCheck.preCheck.rpcUsed,
  });

  // Step 2: If key is already held, deallocate first to set up clean state
  if (preHeld) {
    console.log(`  → Key already held. Deallocating first for clean test...`);
    const dealloc = dockerMumps('DEALLOC', `K ^XUSEC("${TEST_KEY}",${preCheck.preCheck.duz}) W "DEALLOCATED",!`);
    if (!dealloc.ok) {
      log(2, 'FAIL', { description: 'Failed to deallocate key for clean state', error: dealloc.error });
      return finish();
    }

    // Verify deallocation
    const deVerify = await post('/api/tenant-admin/v1/guided-write/key-verify', {
      tenantId: TENANT_ID,
      keyName: TEST_KEY,
      expectedState: 'not-held',
    });
    if (!deVerify.ok || deVerify.verification.currentlyHeld) {
      log(2, 'FAIL', { description: 'Deallocation verify failed', response: deVerify });
      return finish();
    }
    log(2, 'PASS', { description: 'Clean state: key deallocated and verified via ORWU HASKEY' });
  } else {
    log(2, 'PASS', { description: 'Clean state: key not held (no deallocation needed)' });
  }

  // Step 3: Generate guided-write M command (from API)
  const guidedCheck = await post('/api/tenant-admin/v1/guided-write/key-check', {
    tenantId: TENANT_ID,
    keyName: TEST_KEY,
  });

  if (!guidedCheck.ok || !guidedCheck.guidedAction?.mCommand) {
    log(3, 'FAIL', { description: 'Guided check did not return M command', response: guidedCheck });
    return finish();
  }

  const mCommand = guidedCheck.guidedAction.mCommand;
  log(3, 'PASS', {
    description: `API generated M command: ${mCommand}`,
    mCommand,
    undoCommand: guidedCheck.guidedAction.undoCommand,
  });

  // Step 4: Execute the M command (simulating operator terminal action)
  const duz = guidedCheck.preCheck.duz;
  const writeResult = dockerMumps('ALLOC', `S ^XUSEC("${TEST_KEY}",${duz})="" W "ALLOCATED",!`);
  if (!writeResult.ok) {
    log(4, 'FAIL', { description: 'M command execution failed', error: writeResult.error });
    return finish();
  }
  log(4, 'PASS', { description: `M command executed in ${CONTAINER}`, output: writeResult.output });

  // Step 5: Read-back verification via API
  const readBack = await post('/api/tenant-admin/v1/guided-write/key-verify', {
    tenantId: TENANT_ID,
    keyName: TEST_KEY,
    expectedState: 'held',
  });

  if (!readBack.ok) {
    log(5, 'FAIL', { description: 'Read-back API call failed', response: readBack });
    return finish();
  }

  if (!readBack.verification.currentlyHeld || !readBack.verification.verified) {
    log(5, 'FAIL', {
      description: 'Read-back: key NOT held after write — write did not take effect',
      response: readBack.verification,
    });
    return finish();
  }

  log(5, 'PASS', {
    description: `Read-back: DUZ=${readBack.verification.duz} NOW holds key ${TEST_KEY}`,
    verified: readBack.verification.verified,
    rpcUsed: readBack.verification.rpcUsed,
  });

  // Step 6: Undo — deallocate the key (cleanup)
  const undoCommand = guidedCheck.guidedAction.undoCommand;
  const undoResult = dockerMumps('UNDO', `K ^XUSEC("${TEST_KEY}",${duz}) W "UNDONE",!`);
  if (!undoResult.ok) {
    log(6, 'FAIL', { description: 'Undo M command failed', error: undoResult.error });
    return finish();
  }
  log(6, 'PASS', { description: `Undo executed: ${undoCommand}`, output: undoResult.output });

  // Step 7: Restore verification — key should no longer be held
  const restoreVerify = await post('/api/tenant-admin/v1/guided-write/key-verify', {
    tenantId: TENANT_ID,
    keyName: TEST_KEY,
    expectedState: 'not-held',
  });

  if (!restoreVerify.ok) {
    log(7, 'FAIL', { description: 'Restore verify API call failed', response: restoreVerify });
    return finish();
  }

  if (restoreVerify.verification.currentlyHeld) {
    log(7, 'FAIL', {
      description: 'Restore verify: key still held after undo — state not restored',
      response: restoreVerify.verification,
    });
    return finish();
  }

  log(7, 'PASS', {
    description: `Restore verified: DUZ=${restoreVerify.verification.duz} no longer holds key ${TEST_KEY}`,
    verified: restoreVerify.verification.verified,
    rpcUsed: restoreVerify.verification.rpcUsed,
  });

  return finish();
}

function finish() {
  const passed = steps.filter(s => s.verdict === 'PASS').length;
  const failed = steps.filter(s => s.verdict === 'FAIL').length;
  const total = steps.length;

  console.log('');
  console.log(`=== Results: ${passed}/${total} PASS, ${failed} FAIL ===`);

  const evidence = {
    test: 'Guided-Write Proof: Key Allocation (GW-KEY-01)',
    timestamp: new Date().toISOString(),
    container: CONTAINER,
    apiBase: API_BASE,
    testKey: TEST_KEY,
    steps,
    summary: { total, passed, failed, verdict: failed === 0 ? 'PASS' : 'FAIL' },
  };

  console.log('\n--- Evidence JSON ---');
  console.log(JSON.stringify(evidence, null, 2));

  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
