import JoinFirmClient from "./JoinFirmClient";

export default async function JoinFirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = String(params.token ?? "").trim();

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-16">
        <section className="w-full rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-black/50">TSIDKENU Firm Access</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Invitation link required</h1>
          <p className="mt-4 text-sm leading-6 text-black/65">Open the complete invitation link provided by your firm administrator.</p>
        </section>
      </main>
    );
  }

  return <JoinFirmClient token={token} />;
}
