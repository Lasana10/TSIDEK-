import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Context={params:Promise<{caseId:string}>};
const patterns:Record<string,string>={
"0":"000110100","1":"100100001","2":"001100001","3":"101100000","4":"000110001","5":"100110000","6":"001110000","7":"000100101","8":"100100100","9":"001100100",
"A":"100001001","B":"001001001","C":"101001000","D":"000011001","E":"100011000","F":"001011000","G":"000001101","H":"100001100","I":"001001100","J":"000011100",
"K":"100000011","L":"001000011","M":"101000010","N":"000010011","O":"100010010","P":"001010010","Q":"000000111","R":"100000110","S":"001000110","T":"000010110",
"U":"110000001","V":"011000001","W":"111000000","X":"010010001","Y":"110010000","Z":"011010000","-":"010000101",".":"110000100"," ":"011000100","/":"010100010","*":"010010100"
};
function esc(value:string){return value.replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[ch]||ch))}
function svgFor(value:string){
  const data=value.toUpperCase().replace(/[^0-9A-Z .\/-]/g,"-").slice(0,64);
  const encoded="*"+data+"*";const narrow=2,wide=5,gap=2,quiet=20,height=78;let x=quiet;const bars:string[]=[];
  for(const char of encoded){
    const pattern=patterns[char]||patterns["-"];
    for(let i=0;i<9;i++){
      const w=pattern[i]==="1"?wide:narrow;
      if(i%2===0) bars.push(`<rect x="${x}" y="8" width="${w}" height="${height}" fill="#071f19"/>`);
      x+=w;
    }
    x+=gap;
  }
  const width=x+quiet;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="112" viewBox="0 0 ${width} 112" role="img" aria-label="Case barcode ${esc(data)}"><rect width="100%" height="100%" fill="white"/>${bars.join("")}<text x="${width/2}" y="104" text-anchor="middle" font-family="ui-monospace,monospace" font-size="12" fill="#071f19">${esc(data)}</text></svg>`;
}
export async function GET(request:Request,context:Context){
  try{
    const scope=await resolveRequestScope(request);await assertFirmPermission({scope,permission:"openMatters"});
    if(!scope.firmId) throw new Error("Authenticated firm context is required.");
    const {caseId}=await context.params;const supabase=createServerSupabaseClient();if(!supabase) throw new Error("Supabase server configuration is required.");
    const result=await supabase.from("matters").select("id,case_reference").eq("id",caseId).eq("firm_id",scope.firmId).maybeSingle();
    if(result.error) throw new Error(result.error.message);if(!result.data) return new NextResponse("Case not found",{status:404});
    return new NextResponse(svgFor(result.data.case_reference),{headers:{"Content-Type":"image/svg+xml; charset=utf-8","Cache-Control":"private, max-age=300","X-Content-Type-Options":"nosniff"}});
  }catch(error){return new NextResponse(error instanceof Error?error.message:"Unable to render case barcode.",{status:403})}
}
