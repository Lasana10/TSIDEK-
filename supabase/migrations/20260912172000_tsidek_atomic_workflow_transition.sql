create or replace function public.transition_matter_workflow_atomic(
  p_instance_id uuid,
  p_transition_id uuid,
  p_expected_stage text,
  p_reason text,
  p_guard_snapshot jsonb,
  p_actor_lawyer_id uuid,
  p_actor_role text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_instance public.matter_workflow_instances%rowtype;
  v_transition public.firm_workflow_transitions%rowtype;
  v_stage public.firm_workflow_stages%rowtype;
  v_event public.matter_workflow_events%rowtype;
  v_now timestamptz := now();
begin
  select * into v_instance from public.matter_workflow_instances where id = p_instance_id for update;
  if not found then raise exception 'Workflow instance not found'; end if;
  if v_instance.current_stage_key is distinct from p_expected_stage then raise exception 'Workflow stage changed; reload before retrying'; end if;

  select * into v_transition from public.firm_workflow_transitions
    where id = p_transition_id and workflow_id = v_instance.workflow_id and active = true;
  if not found then raise exception 'Workflow transition not found'; end if;
  if v_transition.from_stage_key is distinct from v_instance.current_stage_key then raise exception 'Transition is not valid from current stage'; end if;

  select * into v_stage from public.firm_workflow_stages
    where workflow_id = v_instance.workflow_id and stage_key = v_transition.to_stage_key;
  if not found then raise exception 'Target workflow stage not found'; end if;

  update public.matter_workflow_instances
    set current_stage_key = v_transition.to_stage_key,
        stage_entered_at = v_now,
        status = case when v_stage.is_terminal then 'completed' else 'active' end,
        completed_at = case when v_stage.is_terminal then v_now else null end,
        updated_at = v_now
    where id = v_instance.id;

  insert into public.matter_workflow_events(
    firm_id,matter_id,instance_id,transition_id,from_stage_key,to_stage_key,action,reason,guard_snapshot,actor_lawyer_id,actor_role
  ) values (
    v_instance.firm_id,v_instance.matter_id,v_instance.id,v_transition.id,v_instance.current_stage_key,v_transition.to_stage_key,'transition',nullif(trim(p_reason),''),coalesce(p_guard_snapshot,'{}'::jsonb),p_actor_lawyer_id,p_actor_role
  ) returning * into v_event;

  if v_stage.is_terminal then
    update public.matters set status='Closed', closed_at=v_now, procedural_stage=v_stage.name, updated_at=v_now where id=v_instance.matter_id and firm_id=v_instance.firm_id;
  else
    update public.matters set procedural_stage=v_stage.name, updated_at=v_now where id=v_instance.matter_id and firm_id=v_instance.firm_id;
  end if;

  return jsonb_build_object(
    'instance', (select to_jsonb(i) from public.matter_workflow_instances i where i.id=v_instance.id),
    'event', to_jsonb(v_event),
    'target_stage', to_jsonb(v_stage)
  );
end;
$$;
revoke all on function public.transition_matter_workflow_atomic(uuid,uuid,text,text,jsonb,uuid,text) from public, anon, authenticated;
grant execute on function public.transition_matter_workflow_atomic(uuid,uuid,text,text,jsonb,uuid,text) to service_role;
