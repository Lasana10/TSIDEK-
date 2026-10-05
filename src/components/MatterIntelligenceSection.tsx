import type { RequestScope } from "@/lib/request-scope";
import { getMatterOperatingSystem } from "@/lib/matter-operating-system.server";
import MatterIntelligencePanel from "@/components/MatterIntelligencePanel";

export default async function MatterIntelligenceSection({matterId,scope}:{matterId:string;scope:RequestScope}){
 const operating=await getMatterOperatingSystem({matterId,scope});
 return <MatterIntelligencePanel matterId={matterId} claims={operating.intelligence.claims} communications={operating.intelligence.communications} jurisdictionPacks={operating.intelligence.jurisdictionPacks} knowledge={operating.intelligence.knowledge} outcomes={operating.outcomes}/>;
}
