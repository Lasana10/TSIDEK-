import test from "node:test";
import assert from "node:assert/strict";
import {permissionsForActiveFirm} from "../src/lib/firm-role-boundary.ts";

const professional={
 partner:["manageFirm","approveFilings","viewBilling"],
 finance:["viewBilling"],
 intern:["manageEvidence"],
};
const governance={
 member:[],
 firm_head:["manageFirm"],
};
test("a legacy Partner working as Finance in another firm has only Finance permissions",()=>{
 const granted=permissionsForActiveFirm({role_key:"finance",governance_role_key:"member",status:"active"},professional,governance);
 assert.deepEqual([...granted],["viewBilling"]);
 assert.equal(granted.has("manageFirm"),false);
 assert.equal(granted.has("approveFilings"),false);
});
test("no membership, or a revoked one, grants zero authority",()=>{
 for(const membership of [null,{role_key:"partner",governance_role_key:"firm_head",status:"revoked"},{role_key:"partner",status:"suspended"}]){
  assert.equal(permissionsForActiveFirm(membership,professional,governance).size,0);
 }
});
test("professional and governance powers are separate and scoped to the actual membership",()=>{
 const granted=permissionsForActiveFirm({role_key:"intern",governance_role_key:"firm_head",status:"active"},professional,governance);
 assert.deepEqual(new Set(granted),new Set(["manageEvidence","manageFirm"]));
});
