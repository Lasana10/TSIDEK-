import { selectAiRoute, parseStructuredOutput, type RouteRequest } from "./routing";
export type AiCoreTransport = (input: {provider:string;model:string;prompt:string;maxTokens:number}) => Promise<string>;
export type AiCoreInput<T> = RouteRequest & {prompt:string;maxTokens?:number;validate:(value:unknown)=>value is T};
export async function executeAiCore<T>(input:AiCoreInput<T>, transport:AiCoreTransport):Promise<{result:T;provider:string;model:string;requiresHumanReview:boolean}> {
  if (!input.prompt.trim()) throw new Error("AI_EMPTY_PROMPT");
  const route=selectAiRoute(input);
  const maxTokens=Math.max(64,Math.min(input.maxTokens??800,4096));
  const raw=await transport({provider:route.provider,model:route.model,prompt:input.prompt,maxTokens});
  return {result:parseStructuredOutput(raw,input.validate),provider:route.provider,model:route.model,requiresHumanReview:route.requiresHumanReview};
}
