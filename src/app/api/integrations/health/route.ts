import { NextResponse } from "next/server";
import { integrationRegistry } from "@/lib/integrations";

export async function GET() {
  const providers = integrationRegistry();
  return NextResponse.json({
    configured: providers.filter((item) => item.configured).map((item) => item.provider),
    providers,
  });
}
