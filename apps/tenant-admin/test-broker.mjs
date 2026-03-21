#!/usr/bin/env node
/**
 * Test XWB broker connectivity — full login + RPC calls.
 * Usage: VISTA_HOST=127.0.0.1 VISTA_PORT=9434 VISTA_ACCESS_CODE=PRO1234 VISTA_VERIFY_CODE=PRO1234!! VISTA_DEBUG=true node test-broker.mjs
 */

import { getBroker, disconnectBroker } from './lib/xwb-client.mjs';

async function main() {
  console.log('=== XWB Broker Full Test ===\n');

  try {
    // 1. Connect + authenticate + set context
    console.log('1. Connecting to broker...');
    const broker = await getBroker({
      host: process.env.VISTA_HOST || '127.0.0.1',
      port: parseInt(process.env.VISTA_PORT || '9434'),
      accessCode: process.env.VISTA_ACCESS_CODE || 'PRO1234',
      verifyCode: process.env.VISTA_VERIFY_CODE || 'PRO1234!!',
      context: process.env.VISTA_CONTEXT || 'OR CPRS GUI CHART',
    });
    console.log(`   PASS: Connected, DUZ=${broker.duz}, userName=${broker.userName}`);

    // 2. XUS GET USER INFO
    console.log('\n2. Calling XUS GET USER INFO...');
    const userInfo = await broker.callRpc('XUS GET USER INFO');
    console.log('   Result:', userInfo.join(' | '));
    console.log('   PASS');

    // 3. ORWU NEWPERS (user search)
    console.log('\n3. Calling ORWU NEWPERS (search for "PRO")...');
    const users = await broker.callRpc('ORWU NEWPERS', ['PRO', '1']);
    console.log('   Result:', users.slice(0, 5).join(' | '));
    console.log('   PASS');

    // 4. ORWU CLINLOC (clinics)
    console.log('\n4. Calling ORWU CLINLOC (search clinics)...');
    const clinics = await broker.callRpc('ORWU CLINLOC', ['', '1']);
    console.log('   Result:', clinics.slice(0, 5).join(' | '));
    console.log('   PASS');

    // 5. XUS DIVISION GET
    console.log('\n5. Calling XUS DIVISION GET...');
    const divs = await broker.callRpc('XUS DIVISION GET');
    console.log('   Result:', divs.join(' | '));
    console.log('   PASS');

    // 6. Disconnect
    console.log('\n6. Disconnecting...');
    await disconnectBroker();
    console.log('   PASS');

    console.log('\n=== ALL TESTS PASSED ===');
  } catch (err) {
    console.error('\nFAIL:', err.message);
    try { await disconnectBroker(); } catch (_) {}
    process.exit(1);
  }
}

main();
