# Case Delight Phase

Implemented in this slice:

- governed case record states: active, archived, deleted
- reversible archive/restore lifecycle
- safe mistaken-case removal blocked when legal or financial history exists
- automatic physical-file registration for newly created cases
- canonical QR destination `/matters/{matterId}` stored with the physical file
- existing human-readable barcode value retained as a secondary registry identifier
- active case portfolio excludes archived/removed records
- case detail exposes governed record actions under Control & closure

Next slices remain focused on usability rather than new top-level modules: visual QR label generation/printing, universal capture, partner review, case-home attention summaries, and observational workflow intelligence.
