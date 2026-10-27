import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { nativePostgres } from '../helpers/native-postgres.js';
import { newId,sha256 } from '../../src/shared/crypto.js';
import { insertRow } from '../../src/db/database.js';
import { migrate } from '../../src/db/migrate.js';
import { join } from 'node:path';
import { PROJECT_ROOT } from '../../src/shared/config.js';

let db:Awaited<ReturnType<typeof nativePostgres>>;
const ownerA=newId();const ownerB=newId();
beforeAll(async()=>{db=await nativePostgres();
  await db.admin.query("INSERT INTO p07.accounts(id,status) VALUES($1,'ACTIVE'),($2,'ACTIVE')",[ownerA,ownerB]);
});
afterAll(async()=>{await db?.close();});
describe('real PostgreSQL schema and isolation',()=>{
  it('runs against PostgreSQL 18 and applies migration exactly once',async()=>{
    const version=(await db.admin.query('SHOW server_version')).rows[0].server_version;
    expect(version).toMatch(/^18\./);
    expect((await db.admin.query('SHOW server_encoding')).rows[0].server_encoding).toBe('UTF8');
    expect((await db.admin.query("SELECT '资料成表😀'::text AS sample")).rows[0].sample).toBe('资料成表😀');
    expect(await migrate(db.adminUrl,join(PROJECT_ROOT,'migrations'))).toEqual([]);
    expect(Number((await db.admin.query("SELECT count(*) FROM pg_tables WHERE schemaname='p07'")).rows[0].count)).toBe(66);
  });
  it('application and worker roles cannot bypass RLS, and owner context does not leak between requests',async()=>{
    await db.app.assertApplicationRole();await db.worker.assertApplicationRole();
    expect((await db.app.pool.query('SELECT id FROM p07.accounts')).rowCount).toBe(0);
    expect(await db.app.withOwner(ownerA,async tx=>(await tx.query('SELECT id FROM p07.accounts')).rows)).toEqual([{id:ownerA}]);
    expect(await db.app.withOwner(ownerB,async tx=>(await tx.query('SELECT id FROM p07.accounts WHERE id=$1',[ownerA])).rowCount)).toBe(0);
    expect((await db.app.pool.query('SELECT id FROM p07.accounts')).rowCount).toBe(0);
  });
  it('authenticates opaque session hashes through a narrowly scoped function',async()=>{
    const identity=newId();const token='synthetic-auth-token';
    await db.admin.query(`INSERT INTO p07.platform_identities(id,owner_id,provider,app_alias,subject_cipher_ref,subject_hash,verified_at)
      VALUES($1,$2,'ALIPAY','test','encrypted-test',$3,now())`,[identity,ownerA,sha256('synthetic-subject')]);
    await db.admin.query(`INSERT INTO p07.sessions(id,owner_id,identity_id,token_hash,expires_at)
      VALUES($1,$2,$3,$4,now()+interval '1 hour')`,[newId(),ownerA,identity,sha256(token)]);
    expect((await db.app.pool.query('SELECT * FROM p07.auth_session($1)',[sha256(token)])).rows[0].owner_id).toBe(ownerA);
    expect((await db.app.pool.query('SELECT * FROM p07.auth_session($1)',[sha256('wrong-token')])).rowCount).toBe(0);
    await expect(db.app.pool.query("SELECT * FROM p07.claim_job('api',60)")).rejects.toMatchObject({code:'42501'});
  });
  it('enforces complete preload before Task insertion at the DB boundary',async()=>{
    const operation=newId();const workspace=newId();const session=newId();
    await db.app.withOwner(ownerA,async tx=>{
      await insertRow(tx,'operations',{id:operation,owner_id:ownerA,kind:'BOOTSTRAP',status:'PENDING'});
      await insertRow(tx,'agent_workspaces',{id:workspace,owner_id:ownerA,operation_id:operation,
        workspace_ref:'sessions/'+session,permission_profile_ref:'test',status:'PREPARING'});
      await insertRow(tx,'agent_sessions',{id:session,owner_id:ownerA,operation_id:operation,workspace_id:workspace,
        runtime_profile_id:'test',versions:{},status:'INITIALIZING',skill_manifest_sha256:'a'.repeat(64)});
    });
    await expect(db.app.withOwner(ownerA,tx=>insertRow(tx,'tasks',{id:newId(),owner_id:ownerA,mode:'DISCOVER',agent_session_id:session})))
      .rejects.toMatchObject({message:'SESSION_NOT_READY'});
    await db.app.withOwner(ownerA,tx=>tx.query(`UPDATE p07.agent_sessions SET status='READY_FOR_INPUT',preload_receipt=$2 WHERE id=$1`,
      [session,{bootstrap_completed:true,host_composition_verified:true,skill_manifest_sha256:'a'.repeat(64),loaded_file_count:7,context_sha256:'b'.repeat(64)}]));
    await db.app.withOwner(ownerA,tx=>insertRow(tx,'tasks',{id:newId(),owner_id:ownerA,mode:'DISCOVER',agent_session_id:session}));
    await expect(db.app.withOwner(ownerB,tx=>insertRow(tx,'tasks',{id:newId(),owner_id:ownerB,mode:'DISCOVER',agent_session_id:session})))
      .rejects.toMatchObject({message:'SESSION_NOT_READY'});
  });
  it('denies a consumer FREE grant even if a future service mistakenly tries to insert one',async()=>{
    await expect(db.app.withOwner(ownerA,tx=>insertRow(tx,'entitlement_grants',{id:newId(),owner_id:ownerA,
      contract_id:newId(),kind:'FREE',revision_limit:0}))).rejects.toMatchObject({message:'FREE_GRANT_FORBIDDEN'});
  });
});
