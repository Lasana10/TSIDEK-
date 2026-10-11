import {createHmac} from "node:crypto";
import "server-only";

export type SharedAiClassification = "public" | "internal" | "confidential" | "restricted";

export async function callSharedAiCoreForFirm(input: {
 firmId: string;
 task: "legal" | "general";
 sensitivity: SharedAiClassification;
 prompt: string;
 approvedExternalProcessing?: boolean;
}): Promise<{output:string;model:string;provider:string;requestId:string;requiresHumanReview:boolean}> {
 const base=process.env.AI_CORE_URL;
 const key=process.env.AI_CORE_KEY_TSIDKENU;
 if(!base||!key)throw new Error("SHARED_AI_CORE_NOT_CONFIGURED");
 const origin=new URL(base);
 if(origin.protocol!=="https:")throw new Error("SHARED_AI_CORE_HTTPS_REQUIRED");
 const timestamp=String(Date.now());
 const tenant=input.firmId;
 if(!/^[a-zA-Z0-9_-]{2,64}$/.test(tenant))throw new Error("SHARED_AI_CORE_INVALID_FIRM");
 const signature=createHmac("sha256",key).update(JSON.stringify(["TSIDKENU",tenant,timestamp])).digest("hex");
 const response=await fetch(new URL("/v1/infer",origin),{
  method:"POST",cache:"no-store",signal:AbortSignal.timeout(35000),
  headers:{"content-type":"application/json","x-ai-product":"TSIDKENU","x-ai-key":key,"x-ai-tenant":tenant,
   "x-ai-timestamp":timestamp,"x-ai-tenant-signature":signature},
  body:JSON.stringify({task:input.task,sensitivity:input.sensitivity,prompt:input.prompt,
   approvedExternalProcessing:input.approvedExternalProcessing===true})
 });
 const body=await response.json() as {output?:unknown;model?:unknown;provider?:unknown;requestId?:unknown;requiresHumanReview?:unknown;error?:unknown};
 if(!response.ok)throw new Error(typeof body.error==="string"?body.error:"SHARED_AI_CORE_FAILURE");
 if(typeof body.output!=="string"||typeof body.model!=="string"||typeof body.provider!=="string"||typeof body.requestId!=="string")throw new Error("SHARED_AI_CORE_INVALID_RESPONSE");
 return {output:body.output,model:body.model,provider:body.provider,requestId:body.requestId,requiresHumanReview:body.requiresHumanReview===true};
}
