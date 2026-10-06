-- Backfill pre-adaptive reputation/defamation matters without hard-coding matter IDs.
-- Existing records are preserved; this only classifies them and creates missing plan rows.

with target as (
  select id, firm_id, coalesce(nullif(trim(matter_type),''),'Defamation') as service_type
  from public.matters
  where engagement_nature='custom'
    and lower(coalesce(matter_type,'') || ' ' || coalesce(title,'')) ~ '(defamation|defarmation|libel|slander|reputation|reputational)'
)
update public.matters m
set engagement_nature='contentious',
    practice_area='Media / reputation',
    service_type=t.service_type,
    client_objective=coalesce(nullif(trim(m.client_objective),''), 'Resolve the reputation dispute on a verified factual, evidential and procedural record.'),
    plan_label='Case strategy',
    updated_at=now()
from target t
where m.id=t.id;

with target as (
  select id, firm_id
  from public.matters
  where engagement_nature='contentious' and practice_area='Media / reputation'
), plan(name,workstream_type,sequence_no,objective) as (
  values
    ('Publication & chronology','facts',1,'Establish the exact publication, timing, content, medium and chronology.'),
    ('Parties / audience / reach','facts',2,'Establish publisher, target, audience, circulation and material reach.'),
    ('Claims, defences & harm','analysis',3,'Frame the pleaded or threatened claims, available defences, harm and remedies.'),
    ('Evidence & authorities','evidence',4,'Verify source material, witnesses, loss evidence and governing authorities.'),
    ('Procedure / remedy / enforcement','execution',5,'Choose and execute the appropriate procedural, settlement, remedy and enforcement route.')
)
insert into public.matter_workstreams(firm_id,matter_id,name,workstream_type,status,sequence_no,objective)
select t.firm_id,t.id,p.name,p.workstream_type,'active',p.sequence_no,p.objective
from target t cross join plan p
where not exists (
  select 1 from public.matter_workstreams w where w.matter_id=t.id and w.sequence_no=p.sequence_no
);

with target as (
  select id, firm_id
  from public.matters
  where engagement_nature='contentious' and practice_area='Media / reputation'
), plan(title,sequence_no) as (
  values
    ('Publication record verified',1),
    ('Claims and defences reviewed',2),
    ('Evidence gaps resolved',3),
    ('Procedural / settlement route confirmed',4),
    ('Outcome / remedy implemented',5)
)
insert into public.matter_milestones(firm_id,matter_id,title,status,source_kind,source_detail,sequence_no)
select t.firm_id,t.id,p.title,'pending','matter_plan','Backfilled from TSID adaptive reputation-dispute model',p.sequence_no
from target t cross join plan p
where not exists (
  select 1 from public.matter_milestones m where m.matter_id=t.id and m.sequence_no=p.sequence_no
);
