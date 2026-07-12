export const firmRoleOptions = [
  "Partner",
  "Senior Associate",
  "Junior Associate",
  "Intern",
  "Paralegal",
  "Project Manager",
] as const;

export type FirmRole = (typeof firmRoleOptions)[number];

export const defaultFirmCountry = "Cameroon";
