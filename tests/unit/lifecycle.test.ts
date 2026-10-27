import { describe,expect,it } from 'vitest';
import { assertPaidPermit,assertReadyInput,assertTransition,type PaidPermit,type PreloadReceipt } from '../../src/shared/lifecycle.js';
import { calculateQuote } from '../../src/shared/pricing.js';

const hash='a'.repeat(64);
const receipt:PreloadReceipt={skill_manifest_sha256:hash,loaded_file_count:7,context_sha256:hash,
  host_composition_verified:true,bootstrap_completed:true};
describe('seven-step phase admission',()=>{
  it('refuses input before actual preload and refuses resurrecting CLOSED',()=>{
    expect(()=>assertReadyInput('INITIALIZING',null,hash)).toThrow();
    expect(()=>assertReadyInput('READY_FOR_INPUT',null,hash)).toThrow();
    expect(()=>assertReadyInput('READY_FOR_INPUT',receipt,'b'.repeat(64))).toThrow();
    expect(()=>assertReadyInput('READY_FOR_INPUT',receipt,hash)).not.toThrow();
    expect(()=>assertTransition('CLOSED','READY_FOR_INPUT')).toThrow();
    expect(()=>assertTransition('ANALYZING','BATCH_RUNNING')).toThrow();
  });
  it('requires exact confirmed original payment, rejects a client success or FREE grant',()=>{
    const paid:PaidPermit={kind:'PAID',payment_status:'CONFIRMED',order_id:'order',contract_id:'contract',
      plan_sha256:hash,amount_minor:100,amount_unit:'CNY_CENT',revoked:false};
    expect(()=>assertPaidPermit(paid,'contract',hash)).not.toThrow();
    for(const change of [{kind:'FREE'},{payment_status:'UNKNOWN'},{payment_status:'success'},
      {revoked:true},{amount_minor:0},{plan_sha256:'b'.repeat(64)}]) {
      expect(()=>assertPaidPermit({...paid,...change} as PaidPermit,'contract',hash)).toThrow();
    }
  });
  it('prices trusted measured scope with a fixed ceiling and no retrospective analysis fee',()=>{
    const policy={id:'flat-v1',baseMinor:100,unitMinor:10,maxMinor:600};
    expect(calculateQuote(policy,3)).toEqual({amount_minor:120,cap_minor:120,measured_units:3});
    expect(()=>calculateQuote(policy,0)).toThrow();
    expect(()=>calculateQuote(policy,51)).toThrow();
    expect(()=>calculateQuote({...policy,maxMinor:105},3)).toThrow();
  });
});
