import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sendEmailViaSmtp } from "@/lib/communications";
import { saveTenantCredentials } from "@/lib/tenant-credentials.server";
import { getFirmIntegrationConnection } from "@/lib/tenant-integrations.server";

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.authenticated || !scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");

    const [interactions, parties, matters, smtp, whatsapp] = await Promise.all([
      supabase.from("legal_interactions")
        .select("id,matter_id,primary_party_id,interaction_type,direction,occurred_at,subject,raw_note,verification_status,client_cycle_stage,created_at")
        .eq("firm_id", scope.firmId)
        .in("interaction_type", ["email","whatsapp","phone_call","office_meeting"])
        .order("occurred_at", { ascending:false }).limit(150),
      supabase.from("parties")
        .select("id,display_name,phone,email,client_status,preferred_language")
        .eq("firm_id", scope.firmId).order("display_name").limit(500),
      supabase.from("matters")
        .select("id,title,client_name,status,case_reference")
        .eq("firm_id", scope.firmId).order("updated_at", { ascending:false }).limit(400),
      getFirmIntegrationConnection(scope.firmId, "smtp"),
      getFirmIntegrationConnection(scope.firmId, "meta_whatsapp"),
    ]);
    if (interactions.error) throw new Error(interactions.error.message);
    if (parties.error) throw new Error(parties.error.message);
    if (matters.error) throw new Error(matters.error.message);

    return NextResponse.json({
      success:true,
      interactions:interactions.data ?? [],
      parties:parties.data ?? [],
      matters:matters.data ?? [],
      providers:{
        email:smtp ? { status:smtp.status, displayName:smtp.display_name, lastVerifiedAt:smtp.last_verified_at, lastError:smtp.last_error, configured:true } : { status:"not_configured", configured:false },
        whatsapp:whatsapp ? { status:whatsapp.status, displayName:whatsapp.display_name, lastVerifiedAt:whatsapp.last_verified_at, lastError:whatsapp.last_error, configured:true } : { status:"not_configured", configured:false }
      }
    });
  } catch (error) {
    return NextResponse.json({ success:false, error:error instanceof Error ? error.message : "Unable to load communications." }, { status:403 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.authenticated || !scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "configure_email") {
      await assertFirmPermission({ scope, permission:"manageFirm" });
      const host = String(body.host ?? "").trim();
      const username = String(body.username ?? "").trim();
      const password = String(body.password ?? "");
      const from = String(body.from ?? "").trim();
      const port = String(body.port ?? "587").trim();
      if (!host || !username || !password || !from) {
        return NextResponse.json({ success:false, error:"SMTP host, username, password and From address are required." }, { status:400 });
      }
      await saveTenantCredentials({
        firmId:scope.firmId,
        provider:"smtp",
        actorLawyerId:scope.actorLawyerId,
        credentials:{
          host,username,password,from,port,
          secure:String(Boolean(body.secure)),
          starttls:String(body.starttls !== false),
        }
      });
      const now = new Date().toISOString();
      const connection = await supabase.from("firm_integration_connections").upsert({
        firm_id:scope.firmId,
        provider:"smtp",
        display_name:String(body.displayName ?? from),
        status:"configured",
        credential_mode:"firm_secret_ref",
        credential_ref:"encrypted",
        configuration:{ from, host, port:Number(port), inbound_mode:"not_configured" },
        last_verified_at:null,
        last_error:null,
        created_by:scope.actorLawyerId,
        updated_by:scope.actorLawyerId,
        updated_at:now
      }, { onConflict:"firm_id,provider" }).select("id,status,display_name,configuration").single();
      if (connection.error) throw new Error(connection.error.message);
      return NextResponse.json({ success:true, connection:connection.data });
    }

    if (action === "send_email") {
      const to = String(body.to ?? "").trim().toLowerCase();
      const subject = String(body.subject ?? "").trim();
      const text = String(body.text ?? "").trim();
      if (!to || !subject || !text) return NextResponse.json({ success:false, error:"Recipient, subject and message are required." }, { status:400 });
      const result = await sendEmailViaSmtp({ to, subject, text, firmId:scope.firmId });
      if (!result.delivered) return NextResponse.json({ success:false, error:result.note, delivery:result }, { status:502 });

      const interaction = await supabase.from("legal_interactions").insert({
        firm_id:scope.firmId,
        matter_id:body.matterId || null,
        primary_party_id:body.partyId || null,
        interaction_type:"email",
        direction:"outbound",
        occurred_at:new Date().toISOString(),
        subject,
        raw_note:text,
        confidentiality_level:"firm",
        transcript_status:"not_requested",
        ai_analysis_status:"not_requested",
        verification_status:"confirmed",
        assigned_to:scope.actorLawyerId,
        created_by:scope.actorLawyerId,
        client_cycle_stage:body.matterId ? "matter" : "enquiry",
        metadata:{ delivery:"smtp", recipient:to }
      }).select("id,occurred_at").single();
      if (interaction.error) throw new Error(interaction.error.message);

      await supabase.from("firm_integration_connections").update({
        status:"verified",
        last_verified_at:new Date().toISOString(),
        last_error:null,
        updated_by:scope.actorLawyerId,
        updated_at:new Date().toISOString()
      }).eq("firm_id",scope.firmId).eq("provider","smtp");

      return NextResponse.json({ success:true, delivery:result, interaction:interaction.data });
    }

    if (action === "log_call") {
      const note = String(body.note ?? "").trim();
      if (!note) return NextResponse.json({ success:false, error:"Call note is required." }, { status:400 });
      const created = await supabase.from("legal_interactions").insert({
        firm_id:scope.firmId,
        matter_id:body.matterId || null,
        primary_party_id:body.partyId || null,
        interaction_type:"phone_call",
        direction:["inbound","outbound"].includes(String(body.direction)) ? String(body.direction) : "outbound",
        occurred_at:body.occurredAt || new Date().toISOString(),
        subject:String(body.subject ?? "Phone call").trim(),
        raw_note:note,
        confidentiality_level:"firm",
        consent_recording:null,
        transcript_status:"not_requested",
        ai_analysis_status:"not_requested",
        verification_status:"unreviewed",
        assigned_to:scope.actorLawyerId,
        created_by:scope.actorLawyerId,
        client_cycle_stage:body.matterId ? "matter" : "enquiry",
        metadata:{ duration_minutes:Number(body.durationMinutes ?? 0), source:"communications_hub" }
      }).select("*").single();
      if (created.error) throw new Error(created.error.message);
      return NextResponse.json({ success:true, interaction:created.data }, { status:201 });
    }

    return NextResponse.json({ success:false, error:"Unsupported communications action." }, { status:400 });
  } catch (error) {
    return NextResponse.json({ success:false, error:error instanceof Error ? error.message : "Communication action failed." }, { status:400 });
  }
}
