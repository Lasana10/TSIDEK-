# TSIDEK RAG Sources

This directory is the controlled local intake shelf for documents that should later feed the private firm brain.

Use `ready-made-documents/` for offline or temporary prepared sources. For the office-wide source library, use the shared OneDrive folder configured by `ONEDRIVE_DRIVE_ID` and `ONEDRIVE_RAG_FOLDER_PATH`.

Recommended operating model:
- OneDrive is the shared source shelf across office machines.
- Supabase remains the system of record for users, matters, metadata, permissions, and future embeddings.
- The local folder is a safe fallback for testing, offline preparation, or one-machine demos.
- Keep client-confidential material out of Git until secure storage, OCR, embeddings, and access policies are fully deployed.
