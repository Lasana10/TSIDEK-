import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { listMatterWorkspacesServer } from "@/lib/matters.server";

function includes(value:unknown,needle:string){return typeof value==="string"&&value.toLowerCase().includes(needle)}

export async function GET(request:Request){
  try{
    const scope=await resolveRequestScope(request);
    await assertFirmPermission({scope,permission:"openMatters"});
    if(!scope.firmId) throw new Error("Authenticated firm context is required.");
    const url=new URL(request.url); const raw=(url.searchParams.get("q")||"").trim();
    if(raw.length<2) return NextResponse.json({success:true,query:raw,cases:[],clients:[],documents:[],files:[],knowledge:[]});
    const needle=raw.toLowerCase();
    const allCases=await listMatterWorkspacesServer(scope);
    const cases=allCases.filter(item=>[
      item.title,item.clientName,item.matterType,item.jurisdiction,item.physicalFileId,item.leadLawyer
    ].some(value=>includes(value,needle))).slice(0,30);
    const matterIds=new Set(allCases.map(x=>x.id));
    const supabase=createServerSupabaseClient(); if(!supabase) throw new Error("Supabase server configuration is required.");

    const safe=raw.replace(/[%_,]/g,"").slice(0,120);
    const [parties,documents,physicalFiles,digitalFiles,knowledge]=await Promise.all([
      supabase.from("parties").select("id,display_name,phone,email,client_status").eq("firm_id",scope.firmId)
        .or(`display_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`).limit(30),
      matterIds.size?supabase.from("documents").select("id,matter_id,title,document_type,version_label,status").in("matter_id",[...matterIds])
        .or(`title.ilike.%${safe}%,document_type.ilike.%${safe}%,version_label.ilike.%${safe}%`).limit(40):Promise.resolve({data:[],error:null}),
      matterIds.size?supabase.from("physical_files").select("id,matter_id,file_code,label,location,custody_status,barcode_value").in("matter_id",[...matterIds])
        .or(`file_code.ilike.%${safe}%,label.ilike.%${safe}%,barcode_value.ilike.%${safe}%`).limit(30):Promise.resolve({data:[],error:null}),
      matterIds.size?supabase.from("digital_case_files").select("id,matter_id,file_label,file_category,reference_code,version_label,status").eq("firm_id",scope.firmId).in("matter_id",[...matterIds])
        .or(`file_label.ilike.%${safe}%,reference_code.ilike.%${safe}%,file_category.ilike.%${safe}%`).limit(30):Promise.resolve({data:[],error:null}),
      supabase.from("firm_knowledge_entries").select("id,source_matter_id,knowledge_type,title,summary,practice_area,jurisdiction,confidentiality,status").eq("firm_id",scope.firmId).eq("status","approved")
        .or(`title.ilike.%${safe}%,summary.ilike.%${safe}%,practice_area.ilike.%${safe}%,jurisdiction.ilike.%${safe}%`).limit(30)
    ]);
    for(const result of [parties,documents,physicalFiles,digitalFiles,knowledge]) if(result.error) throw new Error(result.error.message);
    const byMatter=new Map(allCases.map(x=>[x.id,x]));
    return NextResponse.json({
      success:true,query:raw,cases,
      clients:parties.data??[],
      documents:(documents.data??[]).map(x=>({...x,case:byMatter.get(x.matter_id)||null})),
      files:[
        ...(physicalFiles.data??[]).map(x=>({...x,kind:"physical",case:byMatter.get(x.matter_id)||null})),
        ...(digitalFiles.data??[]).map(x=>({...x,kind:"digital",case:byMatter.get(x.matter_id)||null}))
      ],
      knowledge:(knowledge.data??[]).map(x=>({...x,case:x.source_matter_id?byMatter.get(x.source_matter_id)||null:null}))
    });
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Search failed."},{status:403})}
}
