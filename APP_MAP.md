# App.jsx — Structural Map

File: `App.jsx` at the repo root.
Total length: **9,100 lines**.
Generated: 2026-05-28.

End-lines are approximate (= one line before the next top-level definition; last entry ends at EOF).

---

## Pages (10)

Full-screen route components rendered by the App router.

| Name | Lines | Description |
|---|---|---|
| AuthPage | 1883–2100 | Sign-in / sign-up screen with email+password and password-reset flow. |
| ResetPasswordPage | 2101–2194 | Recovery-link landing page where the user sets a new password. |
| AccountSettings | 2195–2295 | Logged-in account screen for editing profile details and address. |
| TrackPage | 2296–2525 | "My orders" page — lists the user's orders and lets them add a customer message. |
| AdminPage | 2526–3251 | Admin dashboard: order list, status updates, BLOOM catalog manager, sticker-pack manager. |
| OrderPage | 3631–5216 | Multi-step checkout wizard with cart, customizer, shipping selector, and payment step. |
| AboutPage | 6204–6356 | Brand story / about-us page. |
| PetsPage | 7484–8137 | BLOOM collection grid (dogs/cats tabs, breed search) + sticker packs. |
| MaintenancePage | 8903–8967 | Coming-soon page shown when MAINTENANCE_MODE blocks normal visitors. |
| PoliciesPage | 8968–9044 | Legal / shipping / returns policies page (kept reachable even in maintenance). |

---

## Components (34)

Reusable JSX components that are not full pages.

| Name | Lines | Description |
|---|---|---|
| FloatingProductCardComponent | 479–716 | 3D tilt/hover product card used in the floating BLOOM carousel. |
| FloatingProductCard | 717–723 | `React.memo` wrapper around FloatingProductCardComponent. |
| HomeFloatingBloomCarousel | 724–1061 | Home-page rotating BLOOM showcase carousel with arrows. |
| SmartImage | 1690–1756 | Image element with onError/onLoad fallback handling. |
| ProductMockupBase | 1757–1805 | Shared mockup renderer that overlays a design onto a product image. |
| TShirtMockup | 1806–1808 | T-shirt mockup wrapper around ProductMockupBase. |
| OversizedMockup | 1809–1811 | Oversized-tee mockup wrapper. |
| DryfitMockup | 1812–1814 | Dryfit-shirt mockup wrapper. |
| MugMockup | 1815–1817 | Mug mockup wrapper. |
| StickerMockup | 1818–1820 | Rectangular sticker mockup wrapper. |
| StickerSqMockup | 1821–1828 | Square sticker mockup wrapper. |
| AdminFieldLabel | 3252–3255 | Small label used in admin forms. |
| AdminInput | 3256–3269 | Styled text input used in admin forms. |
| AdminImageRow | 3270–3310 | Row in the admin editor for uploading a single image to a Supabase bucket. |
| DesignEditor | 3311–3414 | Admin form for creating/editing a BLOOM pet_design row. |
| PackEditor | 3415–3467 | Admin form for creating/editing a sticker_pack row. |
| OrderSummary | 3468–3630 | Cart-summary panel shown alongside the checkout wizard. |
| CookieConsent | 5217–5309 | Cookie consent banner. |
| MagneticButton | 5310–5375 | Button that magnetically pulls toward the cursor on hover. |
| ParticlesBackground | 5376–5549 | Animated particle backdrop for the home page. |
| CursorGlow | 5550–5602 | Cursor-following radial glow overlay. |
| TrustRow | 5644–5699 | Trust badges row (secure checkout, free shipping, etc.). |
| ReviewStars | 5700–5713 | 5-star rating display. |
| Reviews | 5714–5833 | Customer reviews / testimonials section. |
| ProductBadges | 5834–5861 | Inline badges (new / bestseller / sale) on product cards. |
| Hero | 5862–5923 | Home-page hero section with slogan and product showcase. |
| Nav | 5924–6082 | Top navigation bar with language switcher, cart, account menu. |
| AccessibilityMenu | 6083–6203 | Floating accessibility-options menu (motion, contrast, etc.). |
| CartToast | 6357–6426 | Slide-in toast confirming an item was added to the cart. |
| CartDrawer | 6427–6639 | Slide-out cart drawer with line items and checkout CTA. |
| PawPrintsBackground | 7378–7483 | Decorative paw-print background used on the PetsPage. |
| PetBadges | 8138–8206 | Animal-specific badges shown on PetCard. |
| PetCard | 8207–8317 | BLOOM design tile in the PetsPage grid. |
| PetModal | 8318–8874 | Full-screen modal opened from a PetCard with product options + share. |
| ProductOption | 8875–8902 | Single product-choice button inside PetModal (mug / sticker / shirt). |
| Footer | 9045–9100 | Site footer with links and business info. |

---

## Hooks (2)

| Name | Lines | Description |
|---|---|---|
| useScrollReveal | 5603–5616 | IntersectionObserver hook that toggles an `.is-visible` class on scroll-in. |
| useParallax | 5617–5643 | Scroll-based parallax offset hook. |

---

## Constants (32)

Top-level data/config objects, arrays, and primitives.

| Name | Lines | Description |
|---|---|---|
| FLOATING_CARD_STYLE_ID | 30 | DOM id used to inject the floating-card stylesheet once. |
| FLOATING_CARD_CSS | 32–451 | Big multi-line CSS string for the FloatingProductCard component. |
| DEFAULT_BEHIND_GRADIENT | 452 | Default radial+conic gradient behind the floating card. |
| DEFAULT_INNER_GRADIENT | 453 | Default inner gradient for the floating card. |
| ANIMATION_CONFIG | 455–462 | Easing/duration constants for floating-card animations. |
| COLORS | 1062–1070 | Brand color palette (bg, card, border, accent, etc.). |
| SHIPPING_PRICE | 1071 | Legacy default shipping price (₪30). |
| SHIPPING_LOCKER | 1075 | Locker-shipping price (₪20). |
| SHIPPING_HOME | 1076 | Home-delivery shipping price (₪35). |
| SHIPPING_RATES | 1077 | Map of shipping method → price. |
| ADMIN_EMAIL | 1078 | Hard-coded admin email (gleb2009@gmail.com). |
| BLOOM_SHIRT_COLORS | 1081–1090 | The 6 shirt colors offered inside the BLOOM modal. |
| ANALYTICS | 1100–1107 | Analytics-tracking IDs/config. |
| **MAINTENANCE_MODE** | 1108 | Master switch — when true, blocks the site except for admin/staff. |
| **MUG_STUDIO_ENABLED** | 1115 | Feature flag for the mug-studio route. |
| **CUSTOM_STICKERS_ENABLED** | 1126 | Feature flag for custom (non-BLOOM) sticker products. |
| **PAYMENTS_ENABLED** | 1136 | Feature flag for real Tranzila payments. |
| CART_STORAGE_KEY | 1141 | localStorage key for cart persistence (`sxp_cart_v1`). |
| IL_PREFIXES | 1143–1147 | Israeli phone prefix list for validation. |
| ORDER_STAGES | 1148–1158 | Ordered list of order-status stages with labels. |
| LANGS | 1178–1301 | Trilingual string dictionary (he/en/ru) — the i18n source. |
| BUSINESS_INFO | 1302–1311 | Business metadata (name, address, phone, etc.) for footer & legal. |
| POLICY_SECTIONS | 1312–1319 | Policy table-of-contents anchors. |
| POLICIES | 1320–1542 | Full policy text bodies (privacy / returns / shipping / terms). |
| PRODUCT_IDS | 1543 | Allowed product slugs. |
| VARIANT_IDS | 1556 | Allowed variant slugs. |
| SHIRT_COLOR_PALETTE | 1571 | Hex array derived from BLOOM_SHIRT_COLORS. |
| PRODUCTS | 1573–1586 | Trilingual product catalog factory (called with `t`). |
| CUSTOM_STICKER_IDS | 1587 | Sticker product slugs gated by CUSTOM_STICKERS_ENABLED. |
| PLACEMENTS | 1603–1636 | Print-area placement coordinates per product. |
| SIZE_OPTIONS | 1637–1671 | Size variants per shirt product. |
| MOCKUP_URLS | 1672–1689 | Per-product Supabase image URL used on product cards. |

---

## Utilities (15)

Plain non-component functions.

| Name | Lines | Description |
|---|---|---|
| fpcClamp | 463 | Floating-card helper — clamp a number between min and max. |
| fpcRound | 464 | Floating-card helper — round to N decimals. |
| fpcAdjust | 465–466 | Floating-card helper — remap a value between two ranges. |
| fpcEaseInOutCubic | 467–469 | Floating-card helper — cubic ease in/out. |
| ensureFloatingCardStyles | 470–478 | Injects the floating-card CSS into the document once. |
| colorName | 1091–1099 | Returns a human-readable color name from a hex value in the current language. |
| timeAgo | 1159–1169 | "5 minutes ago" formatter, trilingual. |
| timeBetween | 1170–1177 | Human-readable duration between two dates, trilingual. |
| localizeProduct | 1544–1555 | Translates a saved product name into the current language. |
| localizeVariant | 1557–1570 | Translates a saved variant label into the current language. |
| getCustomProducts | 1588–1594 | Returns the product list, filtered by CUSTOM_STICKERS_ENABLED. |
| formatPriceRange | 1595–1602 | Builds a "from–to ₪" string from a variants array. |
| loadImageEl | 1829–1838 | Promise wrapper around `new Image()` for canvas drawing. |
| drawContain | 1839–1846 | Canvas helper — `object-fit: contain` blit. |
| generateOrderMockup | 1847–1882 | Renders a final mockup PNG (product + uploaded design) to data URL. |

---

## App (root)

| Name | Lines | Description |
|---|---|---|
| App (default export) | 6640–7377 | Root component — owns cart, auth, page-routing, admin check, maintenance gate. |
