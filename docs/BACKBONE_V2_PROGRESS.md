# TSIDEK Backbone V2

This patch connects the existing matter-room and intake workflows to the new
matter event ledger from Firm Backbone Slice 1.

It intentionally preserves the existing:
- Supabase auth and request scope
- matter membership and ethical-wall authorization
- matter room
- intake workflow
- documents/tasks/finance tables
- existing audit logs

The new event ledger becomes the cross-module institutional timeline used later
for notifications, command-center intelligence, closure memory, and governed AI
context.

Next: obligations/deadline authority, document authority/version control,
communication approval/evidence, and finance reconciliation.
