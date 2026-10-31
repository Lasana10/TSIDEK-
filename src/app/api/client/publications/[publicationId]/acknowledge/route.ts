import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/supabase-auth";
type Context={params:Promise<{publicationId:string}>};
export async function POST(_request:Request,{params}:Context){
 try{
  const identity=await getAuthenticatedUser();
  if(!identity?.user?.id||!identity.user.email)return NextResponse.json({success:false,error:"Sign in to acknowledge your update."},{status:401});
  const {publicationId}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(publicationId))return NextResponse.json({success:false,error:"Invalid publication."},{status:400});
  const db=createServerSupabaseClient();if(!db)throw new Error("Client portal database unavailable.");
  const result=await db.rpc("tsidek_acknowledge_client_publication",{
   p_publication_id:publicationId,p_client_user_id:identity.user.id
  });
  if(result.error)throw new Error(result.error.message);
  return NextResponse.json({success:true,acknowledgement:result.data},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to acknowledge update."},{status:403});}
}
