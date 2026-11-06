# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

.NET 10 (Clean Architecture) + Next.js (App Router, TypeScript) + PostgreSQL, with Tailwind CSS and shadcn/ui component primitives on the frontend.

## Users

- **Client (`client` — Guests & Monthly Tenants):** Prospective guests searching and booking hourly, daily, or monthly stays online (with 15-minute Booking Hold TTL while transferring deposits), and current monthly tenants checking their room details, monthly invoices (rent + water/electric meter readings), uploading payment slips, tracking parcels at the front desk, and submitting maintenance requests.
- **Admin (`admin` — Front Desk, Cashier, Housekeeping, Maintenance, Property Managers):** Receptionists and property staff managing multi-property/multi-building room availability across hourly, daily, and monthly stay modes, executing quick walk-in check-ins/check-outs, managing cashier shifts and cash drawers, recording bulk water/electricity meter readings, verifying payment slips, and coordinating housekeeping and repair work orders.

## Product Purpose

**`tan-pms`** is an enterprise Property Management System for a single organization operating multiple properties/buildings that unifies **Hourly (short-stay), Daily (hotel/nightly), and Monthly (apartment lease)** operations in one platform without double-booking or billing conflicts. Success means zero overlapping reservations across stay modes, transparent and friendly self-service for guests/tenants, and fast, error-free front-desk, meter-reading, and cashier shift operations for staff.

## Positioning

Unlike cold, spreadsheet-only property systems or single-mode hotel/dormitory tools, `tan-pms` combines a **Unified Multi-Mode Availability & Billing Engine** (handling hourly timers + turnaround buffers, nightly stays + folios, and long-term leases + utility meters) with an **interactive Visual Isometric Room Experience** where both guests (`client`) and staff (`admin`) can visually inspect room layouts, furniture/assets, condition status, and live stay details.

## Operating Context

- Used daily at property front desks (24/7 shifts with cash drawer handovers), on staff tablets/phones along building corridors (housekeeping status updates and monthly water/electric meter readings), and on guests'/tenants' mobile and desktop browsers (`client`).
- Governed by Thai property and hospitality practices: separate VAT/VAT-exempt invoice lines, Withholding Tax (WHT), TM.30 and ร.ร.4 guest registry exports, PDPA masking of national ID/passport numbers, and deferred file uploads (`useDeferredFileUpload`) for payment slips, ID documents, and meter photos.
- Follows the enterprise core pillars defined in `scaffold-enterprise-core` and strict form/table UX standards adapted from `tan-erp`.

## Capabilities and Constraints

- **10 Enterprise Vertical Slices (`PM-01` – `PM-10`):**
  - `PM-01`: Foundation, Identity, Multi-Property RBAC (`admin` vs `client` scopes) & Notification Core (In-App + LINE OA Ready)
  - `PM-02`: Property, Building, Floor, UnitType & Unit Master (with per-unit asset/furniture inventory)
  - `PM-03`: Rate Plans, Hourly Packages (with grace period, auto-cap to daily rate, and cleaning buffer), Utility Tariffs & Tax Rules
  - `PM-04`: Unified Availability Engine (`PostgreSQL tstzrange`), UnitType Quota vs Specific Unit booking, and Booking Hold TTL (15 minutes)
  - `PM-05`: Front Desk Hourly & Daily Stay, Live Timer, Guest Folio & Regulatory Export (ร.ร.4 / ตม.30)
  - `PM-06`: Monthly Lease Lifecycle, Deposit Ledger, Move-in Inspection, Co-occupants & Vehicle Registry
  - `PM-07`: Bulk Utility Meter Reading (zero-layout-shift live calculation + anomaly alerts) & Batch Monthly Billing
  - `PM-08`: Cashier Shift (Open/Close/Reconcile), Payment Slip Verification Queue (Maker-Checker) & Deposit Ledger
  - `PM-09`: Housekeeping (`Clean`/`Dirty`/`Cleaning`/`Inspecting`/`OutOfOrder`), Maintenance Work Orders & Parcel Management
  - `PM-10`: Client Self-Service Experience (Visual Isometric Room Explorer, Booking Hold, Bills, Parcels, Repairs) & Executive Analytics
- **Bilingual UI (`th` default + `en`):** Every user-facing string is served via i18n keys.

## Brand Commitments

- **Ollama Minimal Documentation-First Design System (`#000000` on `#ffffff`, Pill Geometry, SF Pro Rounded):** Across both `client` and `admin` surfaces, the user committed to the **Ollama Design System**:
  - **Two-color chrome:** Pure black (`#000000`, pressed `#090909`) on a continuous paper-white canvas (`#ffffff`) with soft neutral grays (`#fafafa` surface-soft, `#e5e5e5` hairline, `#d4d4d4` hairline-strong, `#737373` body, `#525252` charcoal, `#a3a3a3` mute) and terminal traffic-light dots (`#ff5f56`, `#ffbd2e`, `#27c93f`).
  - **Pill geometry everywhere (`9999px`):** Every interactive element — primary/secondary buttons, search pills, text inputs, select controls, filter pills, and command/booking snippets — uses `9999px` (`rounded-full`). Cards use `12px` (`rounded-lg`) with `1px solid #e5e5e5` hairlines and zero drop shadows.
  - **One inverted surface per page (`#171717`):** A single dark `#171717` card (`pricing-card-dark` / `cta-strip-dark`) per view breaks the flat-white rhythm to highlight the most critical action or tier (e.g., Monthly Lease / Active Booking Hold in `client`, or Active Cashier Shift / Urgent Overtime Folio in `admin`).
  - **Stock Apple / System Typography:** `SF Pro Rounded` (with `Nunito` fallback) at 36px/30px/24px (weights 500–600) for headings, `ui-sans-serif` for body/controls, and `ui-monospace` for room codes, meter numbers, timestamps, and live terminal/ledger output.

## Evidence on Hand

- Enterprise architecture and feature specification: `docs/superpowers/specs/2026-11-06-tan-pms-enterprise-foundation-and-features-design.md`
- User-provided visual reference: `.impeccable/reference/acornnest-ref.webp`
- Synthetic demonstration data is used for properties, units (`A-102`, `A-305`, etc.), rates, meter readings, and occupant records in prototypes and must be labeled or replaced with live database records in production.

## Product Principles

1. **Rooms Feel Like Real Places, Not Just Row IDs:** Pair structured operational data (rates, meters, folios, lease terms) with a tactile visual representation of the room and its amenities.
2. **Three Stay Modes, One Truth:** Hourly timers, daily check-ins, and monthly leases share one availability timeline and never double-book a unit.
3. **Calm Precision Under Front-Desk Pressure:** Even with a warm, welcoming palette, operational controls (inputs, selects, tables, shift balances, meter entry) maintain strict height harmony, clear status badges, and zero layout shift.
4. **Trust Through Transparency:** Tenants see exact meter photos, tax-separated invoice lines, deposit ledgers, and live countdowns when holding a room online.
