# TSIDKENU → independent AI-CORE integration

The existing governed AI runtime remains authoritative. Set `AI_CORE_URL` (the HTTPS Render AI-CORE service URL), `AI_CORE_KEY_TSIDKENU` (the same secret configured on AI-CORE) and `TSIDEK_AI_CORE_ENABLED=true` **only after** the shared service passes authenticated production smoke tests and the firm's cloud processing policy has been reviewed.

The bridge currently activates only for the `public_legal_research` task, where the firm explicitly permits cloud AI, there is no matter context and there are no source document IDs. All other requests continue through TSIDKENU's existing governed runtime. This prevents accidentally sending private matters to an unverified shared provider. The law firm retains its own provider activity audit; AI-CORE adds a separate execution log.

This is a staged integration; the flag defaults off. The core service needs configured keys, connected Postgres, and live provider inference before activation.
