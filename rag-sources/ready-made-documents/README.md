# TSIDEK RAG Source Inbox

Place already prepared legal materials here when you want TSIDEK to use them later for private retrieval and drafting.
For multi-machine office usage, place the same kind of sources in the shared OneDrive folder configured by `ONEDRIVE_RAG_FOLDER_PATH`.

Recommended inputs:
- Scanned jurisprudence or court decisions.
- OHADA Uniform Act extracts and local procedural notes.
- Bar council or regulatory guidance.
- Firm templates and precedent pleadings.
- Annotated book excerpts that the firm is allowed to digitize.
- Matter-neutral strategy notes and checklists.

Naming convention:
- `country-jurisdiction-topic-year-short-title.ext`
- Example: `cameroon-ohada-debt-recovery-2024-commercial-chamber-note.pdf`

Important:
- Do not place confidential client data here unless the deployment storage and access controls are ready.
- For now, this is an intake shelf, not a completed vector database.
- OneDrive is the preferred shared office shelf; this local folder is for fallback, offline preparation, or demos.
- After the OCR and embedding worker is added, files from this folder should be processed into searchable chunks with source citations.
