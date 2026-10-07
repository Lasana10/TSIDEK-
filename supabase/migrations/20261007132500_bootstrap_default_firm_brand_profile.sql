create or replace function tsidek_private.default_brand_profile_for_firm()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_country text := lower(coalesce(new.country,''));
  v_language text := 'en';
  v_locale text := 'en-GB';
  v_timezone text := 'UTC';
  v_currency text := 'USD';
begin
  if v_country like '%cameroon%' or v_country like '%cameroun%' then
    v_language := 'en'; v_locale := 'en-CM'; v_timezone := 'Africa/Douala'; v_currency := 'XAF';
  elsif v_country like '%nigeria%' then
    v_language := 'en'; v_locale := 'en-NG'; v_timezone := 'Africa/Lagos'; v_currency := 'NGN';
  elsif v_country like '%ivoire%' or v_country like '%ivory coast%' then
    v_language := 'fr'; v_locale := 'fr-CI'; v_timezone := 'Africa/Abidjan'; v_currency := 'XOF';
  elsif v_country like '%ghana%' then
    v_language := 'en'; v_locale := 'en-GH'; v_timezone := 'Africa/Accra'; v_currency := 'GHS';
  elsif v_country like '%kenya%' then
    v_language := 'en'; v_locale := 'en-KE'; v_timezone := 'Africa/Nairobi'; v_currency := 'KES';
  elsif v_country like '%south africa%' then
    v_language := 'en'; v_locale := 'en-ZA'; v_timezone := 'Africa/Johannesburg'; v_currency := 'ZAR';
  elsif v_country like '%france%' then
    v_language := 'fr'; v_locale := 'fr-FR'; v_timezone := 'Europe/Paris'; v_currency := 'EUR';
  elsif v_country like '%united kingdom%' or v_country = 'uk' or v_country like '%britain%' then
    v_language := 'en'; v_locale := 'en-GB'; v_timezone := 'Europe/London'; v_currency := 'GBP';
  elsif v_country like '%united arab emirates%' or v_country = 'uae' then
    v_language := 'en'; v_locale := 'en-AE'; v_timezone := 'Asia/Dubai'; v_currency := 'AED';
  elsif v_country like '%united states%' or v_country = 'usa' or v_country = 'us' then
    v_language := 'en'; v_locale := 'en-US'; v_timezone := 'America/New_York'; v_currency := 'USD';
  end if;

  insert into public.firm_brand_profiles(
    firm_id,display_name,legal_name,short_name,
    primary_color,secondary_color,accent_color,background_color,surface_color,text_color,
    font_heading,font_body,default_language,locale,timezone,date_format,currency,
    configuration,document_identity,ui_theme
  )
  values(
    new.id,new.name,new.name,new.name,
    '#07372D','#145242','#D5B16A','#F4F6F3','#FFFFFF','#0F172A',
    'Inter','Inter',v_language,v_locale,v_timezone,
    case when v_locale='en-US' then 'MM/dd/yyyy' else 'dd/MM/yyyy' end,
    v_currency,
    '{}'::jsonb,'{}'::jsonb,'{}'::jsonb
  )
  on conflict (firm_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_default_firm_brand_profile on public.firms;
create trigger create_default_firm_brand_profile
after insert on public.firms
for each row execute function tsidek_private.default_brand_profile_for_firm();

insert into public.firm_brand_profiles(
  firm_id,display_name,legal_name,short_name,
  primary_color,secondary_color,accent_color,background_color,surface_color,text_color,
  font_heading,font_body,default_language,locale,timezone,date_format,currency,
  configuration,document_identity,ui_theme
)
select
  f.id,f.name,f.name,f.name,
  '#07372D','#145242','#D5B16A','#F4F6F3','#FFFFFF','#0F172A',
  'Inter','Inter',
  case when lower(coalesce(f.country,'')) like '%ivoire%' or lower(coalesce(f.country,'')) like '%ivory coast%' or lower(coalesce(f.country,'')) like '%france%' then 'fr' else 'en' end,
  case
    when lower(coalesce(f.country,'')) like '%cameroon%' or lower(coalesce(f.country,'')) like '%cameroun%' then 'en-CM'
    when lower(coalesce(f.country,'')) like '%nigeria%' then 'en-NG'
    when lower(coalesce(f.country,'')) like '%ivoire%' or lower(coalesce(f.country,'')) like '%ivory coast%' then 'fr-CI'
    when lower(coalesce(f.country,'')) like '%ghana%' then 'en-GH'
    when lower(coalesce(f.country,'')) like '%kenya%' then 'en-KE'
    when lower(coalesce(f.country,'')) like '%south africa%' then 'en-ZA'
    when lower(coalesce(f.country,'')) like '%france%' then 'fr-FR'
    when lower(coalesce(f.country,'')) like '%united kingdom%' or lower(coalesce(f.country,'')) in ('uk','britain') then 'en-GB'
    when lower(coalesce(f.country,'')) like '%united arab emirates%' or lower(coalesce(f.country,''))='uae' then 'en-AE'
    when lower(coalesce(f.country,'')) like '%united states%' or lower(coalesce(f.country,'')) in ('usa','us') then 'en-US'
    else 'en-GB' end,
  case
    when lower(coalesce(f.country,'')) like '%cameroon%' or lower(coalesce(f.country,'')) like '%cameroun%' then 'Africa/Douala'
    when lower(coalesce(f.country,'')) like '%nigeria%' then 'Africa/Lagos'
    when lower(coalesce(f.country,'')) like '%ivoire%' or lower(coalesce(f.country,'')) like '%ivory coast%' then 'Africa/Abidjan'
    when lower(coalesce(f.country,'')) like '%ghana%' then 'Africa/Accra'
    when lower(coalesce(f.country,'')) like '%kenya%' then 'Africa/Nairobi'
    when lower(coalesce(f.country,'')) like '%south africa%' then 'Africa/Johannesburg'
    when lower(coalesce(f.country,'')) like '%france%' then 'Europe/Paris'
    when lower(coalesce(f.country,'')) like '%united kingdom%' or lower(coalesce(f.country,'')) in ('uk','britain') then 'Europe/London'
    when lower(coalesce(f.country,'')) like '%united arab emirates%' or lower(coalesce(f.country,''))='uae' then 'Asia/Dubai'
    when lower(coalesce(f.country,'')) like '%united states%' or lower(coalesce(f.country,'')) in ('usa','us') then 'America/New_York'
    else 'UTC' end,
  case when lower(coalesce(f.country,'')) like '%united states%' or lower(coalesce(f.country,'')) in ('usa','us') then 'MM/dd/yyyy' else 'dd/MM/yyyy' end,
  case
    when lower(coalesce(f.country,'')) like '%cameroon%' or lower(coalesce(f.country,'')) like '%cameroun%' then 'XAF'
    when lower(coalesce(f.country,'')) like '%nigeria%' then 'NGN'
    when lower(coalesce(f.country,'')) like '%ivoire%' or lower(coalesce(f.country,'')) like '%ivory coast%' then 'XOF'
    when lower(coalesce(f.country,'')) like '%ghana%' then 'GHS'
    when lower(coalesce(f.country,'')) like '%kenya%' then 'KES'
    when lower(coalesce(f.country,'')) like '%south africa%' then 'ZAR'
    when lower(coalesce(f.country,'')) like '%france%' then 'EUR'
    when lower(coalesce(f.country,'')) like '%united kingdom%' or lower(coalesce(f.country,'')) in ('uk','britain') then 'GBP'
    when lower(coalesce(f.country,'')) like '%united arab emirates%' or lower(coalesce(f.country,''))='uae' then 'AED'
    else 'USD' end,
  '{}'::jsonb,'{}'::jsonb,'{}'::jsonb
from public.firms f
where not exists(select 1 from public.firm_brand_profiles b where b.firm_id=f.id);
