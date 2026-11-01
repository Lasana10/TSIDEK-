/**
 * A portable professional identity has no firm authority of its own.
 * Only the chosen organization's active membership can grant permissions.
 */
export function permissionsForActiveFirm<P extends string>(
  membership: {role_key?:string|null;governance_role_key?:string|null;status?:string|null}|null,
  professional:Record<string,readonly P[]>,
  governance:Record<string,readonly P[]>,
): Set<P>{
  if(!membership || membership.status!=="active") return new Set<P>();
  return new Set<P>([
    ...(professional[membership.role_key??""]??[]),
    ...(governance[membership.governance_role_key??"member"]??[]),
  ]);
}
