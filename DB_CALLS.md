# Supabase `from(...)` Call Catalog

Scope: every `supabase.from(...)` call site in `App.jsx`.
Generated: 2026-05-28.

**Distinct tables used: 5** — `orders`, `order_status_history`, `pet_designs`, `sticker_packs`, `admins`.
**Total call sites: 24.**

---

## `orders` (14 calls)

- **L2315 — SELECT** — TrackPage: fetch all orders belonging to the logged-in user (matches by `user_id` OR by email, to catch guest orders placed with the same address).
- **L2329 — UPDATE** — TrackPage: customer saves/updates a message on their own order (`customer_message`, `customer_message_at`).
- **L2577 — SELECT** — AdminPage `fetchOrders`: loads all orders for the admin dashboard on mount and on realtime Postgres-change events.
- **L2770 — DELETE** — AdminPage `deleteOrder`: deletes the order row after its history has been cleared (paired with L2769 history-delete).
- **L2780 — UPDATE** — AdminPage `updateStatus`: sets `status` (and `completed_at` when delivered).
- **L4170 — INSERT + SELECT** — OrderPage checkout submit: inserts a sticker-pack order row for a logged-in user and reads back the new `id`.
- **L4174 — INSERT** — OrderPage checkout submit: inserts a sticker-pack order row for a guest (no read-back; RLS blocks SELECT for anon).
- **L4247 — INSERT + SELECT** — OrderPage checkout submit: inserts a regular cart-item order row for a logged-in user and reads back the `id`.
- **L4252 — INSERT** — OrderPage checkout submit: inserts a regular cart-item order row for a guest.
- **L5084 — UPDATE** — OrderPage payment step "Cancel order" button: sets `status = cancelled`, `payment_status = cancelled`, `cancelled_at` on all pending order IDs in the current order group.

---

## `order_status_history` (2 calls)

- **L2769 — DELETE** — AdminPage `deleteOrder`: clears all history rows for each order being deleted (runs before the order row delete at L2770).
- **L2781 — INSERT** — AdminPage `updateStatus`: appends a new history row whenever an admin changes an order's status.

---

## `pet_designs` (6 calls)

- **L2584 — SELECT** — AdminPage `fetchPetDesigns`: loads all designs (including inactive) for the catalog-manager panel.
- **L2603 — UPDATE** — AdminPage `togglePetFlag`: optimistically toggles `is_bestseller` or `is_new` on a single design row.
- **L2669 — UPDATE** — AdminPage `savePetDesign`: saves edits to an existing BLOOM design (full row update).
- **L2677 — INSERT** — AdminPage `savePetDesign`: creates a new BLOOM design row.
- **L2697 — DELETE** — AdminPage `deletePetDesign`: permanently removes a BLOOM design from the catalog.
- **L7514 — SELECT** — PetsPage initial load: fetches all `is_active = true` designs sorted by `sort_order` to populate the collection grid.

---

## `sticker_packs` (5 calls)

- **L2593 — SELECT** — AdminPage `fetchStickerPacks`: loads all sticker packs (including inactive) for the catalog-manager panel.
- **L2726 — UPDATE** — AdminPage `saveStickerPack`: saves edits to an existing sticker pack row.
- **L2734 — INSERT** — AdminPage `saveStickerPack`: creates a new sticker pack row.
- **L2754 — DELETE** — AdminPage `deleteStickerPack`: permanently removes a sticker pack.
- **L7519 — SELECT** — PetsPage initial load: fetches all `is_active = true` packs sorted by `sort_order`, shown alongside the BLOOM grid.

---

## `admins` (1 call)

- **L7136 — SELECT** — App root `checkAdmin`: after every auth state change, checks whether the signed-in user's `id` exists in the `admins` table; sets the `isAdmin` flag which gates AdminPage access and bypasses `MAINTENANCE_MODE`.
