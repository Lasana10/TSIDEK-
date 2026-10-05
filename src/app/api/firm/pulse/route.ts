import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { getFirmPulse } from "@/lib/firm-pulse.server";
import { statusForApiError } from "@/lib/api-errors";

export async function GET(request:Request){
 try{
  const scope=await resolveRequestScope(request);
  const pulse=await getFirmPulse(scope);
  return NextResponse.json({success:true,pulse});
 }catch(error){
  return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load Firm Pulse."},{status:statusForApiError(error)});
 }
}
