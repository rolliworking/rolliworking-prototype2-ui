# Module — Labels · Reports · Accounting

## Labels `/labels` (+ `/intake/labels` queue)
- Label kinds: bag tag (PDF417 payload `E#|SUB#|ref|serial|W,B`), ref/serial label, shipping label (from Ship Station), evidence/photo labels. Queue rows `{kind, payload, relatedRef, status pending|printed, printerId?}`; printers list (name, type, location) in Setup; "Print" marks printed (mock). Audit `labels`.
- Scanners: `/rt` and `/rw/evidence` accept the PDF417 payload, a job number, or `ref/serial` (`findJobByLabel`).
- Seam: real ZPL/Zebra output (`06-SEAMS.md`).

## Reports `/reports` (manager) — each reconciles with dashboard cards
| tab | rows | note |
|---|---|---|
| Estimate funnel | created / sent / approved / converted / open (count + value) | "awaiting approval" card = status sent |
| Job throughput | workflow × creation month, closed in parentheses, in-progress row | dashboard "in progress" = approved+in_service+testing |
| Aging | 0–7d / 8–30d / 31–90d / 90d+ for open jobs, held jobs, open estimates (+ value) | age from createdAt |
| Department P&L (labor only) | W/B/P/PM labor revenue of jobs closed this month; goods = `no_dept_product`; total = dashboard revenue | provisional rule |
| **Tech completions** | tech × month (last 6) = count (W/B/P/PM breakdown), total row | credit at component `completedAt`, regardless of invoicing (ruling 2026-09-26) |
CSV export = the table (client-side). Weekly watchmaker numbers = Supervisor board "N component completions this month" per tech.

## Accounting `/accounting` (manager)
Invoice register (non-draft SOs), payment register, **QBO queue** (`syncState not_queued | queued | pushed_stub | error_stub`, fake `QBO-STUB-…` ids assigned at fulfil). Export CSV stub. **Hard-stop stub**: nothing external (`06-SEAMS.md` → QBO). Audit `accounting`.

## Behaviours discovered during build
- Reports gained "Tech completions" with the component ruling; P&L stays invoicing-based by design (credit ≠ revenue).
