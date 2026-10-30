// Live, credential-free negative-path acceptance; never uses or invents a privileged account.
const base=(process.env.TSIDEK_E2E_BASE_URL || "https://tsidek-os.onrender.com").replace(/\/$/,"");
const endpoints=[
 {path:"/api/session",expected:401},
 {path:"/api/personal-workspace",expected:401},
 {path:"/api/workspace",expected:401},
 {path:"/api/legal-sources",expected:403},
];
let failures=0;
for(const item of endpoints) {
 try {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),25000);
  let response;
  try { response=await fetch(base+item.path,{redirect:"manual",signal:controller.signal,headers:{Accept:"application/json"}}); }
  finally { clearTimeout(timeout); }
  const text=await response.text();
  const payload=JSON.parse(text);
  const acceptable=response.status===item.expected && payload && typeof payload==="object";
  console.log(JSON.stringify({path:item.path,status:response.status,expected:item.expected,result:acceptable?"PASS":"FAIL"}));
  if(!acceptable)failures++;
 }catch(error){
  console.error(JSON.stringify({path:item.path,result:"FAIL",error:error instanceof Error?error.message:String(error)}));
  failures++;
 }
}
if(failures){console.error("Anonymous negative-path smoke: "+failures+" failure(s)");process.exit(1);}
console.log("Anonymous negative-path smoke passed; signed-in journeys remain separately gated.");
