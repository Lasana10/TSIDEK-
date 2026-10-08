"use client";

import Link from "next/link";
import { ArrowRight, Building2, FileBadge2, GitBranch, Palette, Scale, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { LanguageSwitcher, useLocale } from "@/components/LocaleProvider";

type Item = { href: string; en: string; fr: string; descriptionEn: string; descriptionFr: string; icon: typeof ShieldCheck };
const governance: Item[] = [
  { href: "/firm-control/ways-of-working", en: "Ways of Working", fr: "Modes de fonctionnement", descriptionEn: "Review the firm's recommended operating model and adopted rules.", descriptionFr: "Réviser le modèle opérationnel recommandé et les règles adoptées du cabinet.", icon: Settings2 },
  { href: "/firm-control/governance", en: "Governance & approvals", fr: "Gouvernance et approbations", descriptionEn: "Control protected decisions, approvals and escalation authority.", descriptionFr: "Contrôler les décisions protégées, les approbations et les pouvoirs d'escalade.", icon: ShieldCheck },
  { href: "/studio/access", en: "People & authority", fr: "Équipe et habilitations", descriptionEn: "Manage invitations, roles and firm-level access.", descriptionFr: "Gérer les invitations, les rôles et les accès au cabinet.", icon: UsersRound },
];
const design: Item[] = [
  { href: "/studio#identity-brand", en: "Brand identity", fr: "Identité visuelle", descriptionEn: "Design the firm identity and client-facing appearance.", descriptionFr: "Concevoir l'identité du cabinet et sa présentation aux clients.", icon: Palette },
  { href: "/firm-control/document-identity", en: "Document identity", fr: "Identité documentaire", descriptionEn: "Control letterheads, signatures and document presentation.", descriptionFr: "Configurer les en-têtes, les signatures et la présentation des documents.", icon: FileBadge2 },
  { href: "/studio/legal-parameters", en: "Legal parameters", fr: "Paramètres juridiques", descriptionEn: "Configure jurisdictions, matter types, courts and legal defaults.", descriptionFr: "Configurer les juridictions, les types de dossiers, les tribunaux et les règles juridiques.", icon: Scale },
  { href: "/studio/workflows", en: "Workflow design", fr: "Conception des processus", descriptionEn: "Design reusable stages and approval pathways without changing a live matter.", descriptionFr: "Concevoir les étapes réutilisables et les circuits d'approbation sans modifier un dossier actif.", icon: GitBranch },
  { href: "/studio", en: "Open Firm Studio", fr: "Ouvrir le Studio du cabinet", descriptionEn: "Advanced system design, forms, interaction and AI controls.", descriptionFr: "Conception avancée du système, formulaires, interactions et contrôle de l'IA.", icon: Building2 },
];

export default function FirmControlPage() {
  const { locale } = useLocale();
  const french = locale === "fr";
  const phrase = (en: string, fr: string) => french ? fr : en;
  function section(titleEn: string, titleFr: string, descriptionEn: string, descriptionFr: string, items: Item[]) {
    return <section aria-label={phrase(titleEn, titleFr)} className="space-y-4">
      <div><h2 className="text-xl font-semibold tracking-tight text-slate-950">{phrase(titleEn, titleFr)}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{phrase(descriptionEn, descriptionFr)}</p></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map(({href,en,fr,descriptionEn,descriptionFr,icon:Icon})=><Link key={href} href={href} className="group flex min-h-44 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-700/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><div className="flex items-start justify-between"><span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-900"><Icon className="h-5 w-5" aria-hidden="true"/></span><ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5" aria-hidden="true"/></div><h3 className="mt-4 text-base font-semibold text-slate-950">{phrase(en,fr)}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{phrase(descriptionEn,descriptionFr)}</p></Link>)}</div>
    </section>;
  }
  return <main className="min-h-screen bg-[#f3f5f2] px-4 py-6 md:px-7 xl:px-10"><div className="mx-auto max-w-7xl space-y-9">
    <section className="rounded-[2rem] bg-[#082b22] p-6 text-white md:p-9"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">{phrase("Firm Control","Pilotage du cabinet")}</p><h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">{phrase("Govern the firm. Design the system.","Pilotez le cabinet. Concevez le système.")}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">{phrase("Firm Control holds the decisions and authority that govern daily practice. Firm Studio designs reusable identity, forms, legal parameters and workflows. Neither replaces the live Matter Workspace.","Le pilotage du cabinet regroupe les décisions et habilitations qui régissent la pratique quotidienne. Le Studio conçoit les éléments réutilisables : identité, formulaires, paramètres juridiques et processus. Aucun ne remplace l'espace de travail des dossiers.")}</p></div><LanguageSwitcher surface="dark" compact/></div></section>
    {section("Run & govern","Piloter et gouverner","Manage the firm's adopted rules, responsibilities and protected decisions.","Gérer les règles adoptées, les responsabilités et les décisions protégées du cabinet.",governance)}
    {section("Design & configure","Concevoir et configurer","Change templates and defaults here; execute active legal work inside each matter.","Modifier ici les modèles et paramètres par défaut ; exécuter le travail juridique dans chaque dossier.",design)}
    <p className="border-t border-slate-200 pt-5 text-sm text-slate-500">{phrase("One responsibility, one authoritative destination. Design changes must not silently alter live matter records or approvals.","Une responsabilité, une destination de référence. Les changements de conception ne doivent pas modifier silencieusement les dossiers actifs ni leurs approbations.")}</p>
  </div></main>;
}
