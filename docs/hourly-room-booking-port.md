# Hourly Room Booking → Booking Suite: what to port

Everything built in **Hourly Room Booking System** on **21–22 September 2026**, releases **v1.12.0 → v1.19.0**, written up so it can be rebuilt here.

This is not a changelog. It is a spec: each section gives the **rule**, **why it exists**, the **traps** that cost time the first time round, and the **reference implementation** in HRB you can read if the prose is ambiguous. Port the rules, not the file layout — the two plugins are structured differently.

Read §2 (roles) and §8 (cross-midnight) first. Those two account for most of the work and almost all of the bugs.

---

## 1. Scope at a glance

| Area | Releases | Port priority |
|---|---|---|
| Roles and capabilities | 1.13.0, 1.15.0, 1.16.1, 1.17.0, 1.18.0 | **High** — everything else references it |
| Past-booking boundary | 1.17.0, 1.19.0 | **High** |
| No-show automation + `nil` payment status | 1.18.0 | High |
| Bank transfer (method + note + settings) | 1.18.0, 1.19.0 | Medium |
| Booking-window semantics | 1.12.0, 1.13.1, 1.14.0, 1.16.0 | **High** — settled only at 1.16.0, read the whole story |
| Cross-midnight correctness | 1.12.0, 1.17.0, 1.18.1, 1.19.0 | **High** |
| Update delivery / GitHub updater | 1.13.0, 1.15.0, 1.18.0 | Only if Booking Suite self-updates |
| CSV exports | 1.13.0 | Medium |

---

## 2. Roles and capabilities

### 2.1 The three roles

HRB shipped one role holding everything. It now has three.

| Role | Slug | Who it is |
|---|---|---|
| Room Booking Super Admin | `hrb_super_admin` | Us — the people who build and support the plugin |
| Room Booking Admin | `hrb_admin` | The client who runs the business |
| Room Booking Employee | `hrb_staff` | The desk |

`hrb_staff` is the **original slug**, kept deliberately so existing users keep their role through the upgrade. Only the label changed. Do the same if Booking Suite already ships a staff role — renaming a slug silently orphans every user who holds it.

### 2.2 Capability map

```
employee_caps():
  read
  hrb_view_bookings
  hrb_manage_bookings      // includes marking a booking paid
  hrb_view_booking_amounts // what THIS booking costs
  hrb_view_payments        // the payment list
  hrb_manage_payments      // and working it: view, complete, cancel, refund
  hrb_view_calendar
  hrb_view_customers
  hrb_manage_customers
  hrb_manage_rooms         // room diary and maintenance locks
  hrb_view_extras
  hrb_manage_extras        // extras stock and availability

admin_caps() = employee_caps() + :
  hrb_view_financials      // the books
  hrb_view_past_bookings   // finished bookings
  hrb_view_reports
  hrb_manage_settings
  hrb_export_data

super_admin_caps() = admin_caps() + :
  hrb_view_stats           // the summary cards above a screen
```

WordPress administrators get `admin_caps()` minus `read` — see §2.5.

### 2.3 The three money lines — the part worth copying exactly

This is the design decision that took three releases to get right. Money is **not one line**. It is three questions, and conflating any two of them produces a role that is either useless or leaky.

**`hrb_view_booking_amounts` — "what does this customer owe?"**
Desk work. The Employee has it. Covers: the Amount column in booking lists and on the dashboard, a booking's own total and pricing breakdown, its payment records, the running total while taking a booking, the Amount column in a customer's history.

**`hrb_view_financials` — "the books"**
The client's business. Admin and up. Covers: revenue cards, totals *across* bookings, the reports screen, price configuration, exports.

**`hrb_view_stats` — "how is this installation doing?"**
Ours, not the client's. Super Admin only. Covers only the row of summary cards that sits above a working table — "Total Revenue", "This Month", "Total Transactions", "Pending".

The distinction between the last two is subtle and intentional: an Admin still **sees and works every payment row** in the list. They are simply not given the headline totalled across the top of it. Splitting that out is what let us give the client full operational access without handing over the installation-level read.

> **Trap.** v1.13.0 drew a single line through all money and took the Amount column away from the desk along with the revenue cards, which made the Employee role unusable — you cannot run a booking desk without knowing what to charge. v1.15.0 split it. Start with the split; do not repeat the merge.

### 2.4 Hide it in the response, not in the markup

Every figure a role may not see must be **left out of the AJAX/REST payload**, not hidden with CSS or an `if` in the template. Otherwise it is one network response away from anyone who opens devtools.

Applies to: dashboard stats, chart series, calendar events and stats, booking and customer detail modals, room and extra detail endpoints, the calendar feed's per-booking price.

### 2.5 Implementation traps

- **User-level capabilities outrank the role.** HRB's old role wrote every capability onto each *user record* as well as onto the role. Removing it from the role therefore changed nothing. The upgrade has to revoke from the users too.
- **Rebuild roles on every admin load**, not on activation only. Otherwise a capability added in a later release never reaches sites that do not reactivate.
- **Do not grant `read` to the WordPress administrator role.** `read` belongs to WordPress. Granting it means deactivation (which removes only what your own `all_caps()` names) leaves it behind. HRB has `admin_granted_caps()` = `all_caps()` minus `admin_denied_caps()` for exactly this.
- **A Super Admin is a plugin role, not "whoever is a WP administrator."** On a client site the client usually *is* a WP administrator, which would defeat the point.
- **If you hide a field from a form, do not let the empty POST overwrite the stored value.** HRB saved hidden price fields as `0` because the user's post carried no value. Keep the stored value when the field was never rendered.

**Reference:** `includes/class-capabilities.php` — the whole role/capability map lives in one class, so hiding a new figure is a matter of asking the same question rather than inventing a rule.

---

## 3. The past-booking boundary

### 3.1 The rule

> A booking becomes a **past** booking at **midnight after the day it finishes on** — not when its end time passes.

A booking 06:00–07:00 on the 24th is the desk's business all day on the 24th and turns over at **00:00 on the 25th**. Inclusive at midnight: at exactly `00:00:00` it is past.

This changed once. v1.17.0 set the boundary at the booking's end (past at 07:01); v1.19.0 moved it to end-of-day. **Implement the v1.19.0 rule directly.** The intermediate version dropped bookings off the desk's screens while the day they belonged to was still being worked, and wrote customers off as no-shows at 10:01 when they still had all day to walk in and pay.

### 3.2 Cross-midnight

Measure from the day the booking **finishes** on, never the day it started:

| Booking | Ends | Becomes past |
|---|---|---|
| 24th, 06:00–07:00 | 24th 07:00 | 25th 00:00 |
| 24th, 21:00–23:00 | 24th 23:00 | 25th 00:00 |
| 24th, 23:30–02:30 | **25th** 02:30 | **26th** 00:00 |
| 30 Sep, 10:00–12:00 | 30 Sep 12:00 | 1 Oct 00:00 |

Keying the overnight case to the start date would mark it past at 00:00 on the 25th — while it is still running.

### 3.3 Everything keyed to "past" must use the same boundary

Three things ask "is this booking over?", and they must never disagree:

1. **Which bookings an Employee is shown** (bookings list, payments list, dashboard recent-bookings, the Old Bookings screen)
2. **When a booking becomes `completed`**
3. **When an unpaid booking becomes a `no_show`**

HRB has one PHP function and one SQL expression, and all three call them:

```php
HRB_Capabilities::becomes_past_at($date, $start, $end)   // 'Y-m-d 00:00:00'
HRB_Capabilities::becomes_past_at_sql($alias)            // SQL DATETIME expression
```

The SQL twin, verified against MySQL 8.4:

```sql
TIMESTAMP(DATE_ADD(DATE(
  CASE WHEN b.end_time <= b.start_time
       THEN TIMESTAMP(DATE_ADD(b.booking_date, INTERVAL 1 DAY), b.end_time)
       ELSE TIMESTAMP(b.booking_date, b.end_time) END
), INTERVAL 1 DAY))
```

### 3.4 Traps

- **Filter in SQL, not in PHP after fetching.** Otherwise the list count disagrees with the rows returned, and pagination breaks.
- **Pass "now" in from PHP; never use `NOW()`.** The database server's clock and the plugin's timezone are not the same thing on shared hosting.
- **Sanitise the table alias** if you build the SQL from a parameter. HRB strips everything but `[A-Za-z0-9_]`.
- This hides finished bookings from **lists**. The **calendar** still shows them — see §2.3 for the separate rule about whether their price is visible.

---

## 4. No-show automation and the `nil` payment status

### 4.1 The rule

An hourly job marks a booking as `no_show` when **all three** hold:

1. It is past (§3 — the *day* has turned over, not just the end time)
2. `payment_status` is `pending` — the money never came
3. `status` is not already `cancelled` or `no_show`

It then sets `payment_status` to a new value: **`nil`**.

### 4.2 Why `nil` and not `cancelled`

A no-show **owes nothing and paid nothing**. `cancelled` would claim the booking was called off, which is the opposite of what happened: the slot was held, the room stood empty, nobody came.

Left as `pending`, these bookings sat in the outstanding figures for ever, quietly inflating what the business believed it was owed. `nil` is the void — the amount drops out of every pending figure without ever being counted as taken.

Add it to your payment-status constants, labels and valid-values list.

### 4.3 What it touches

- Booking status → `no_show`
- Payment status → `nil`
- `"No-Show"` appended to admin notes, so the screen says *why* the status moved rather than it appearing to change on its own
- Uncollected payment rows behind it → voided

### 4.4 Traps

- **Only void money that never arrived.** Payments that actually landed are left alone.
- **Leave the cancellation-fee charge alone.** That is a real debt; failing to turn up does not erase it.
- **Make the pass idempotent and run it over pre-existing no-shows too.** Bookings marked by hand, or marked before this rule existed, are still sitting in the pending figures. One run should leave the totals correct, not just correct for bookings that end from now on.
- The completion pass (`confirmed` → `completed`) runs in the same job and must use the **same** boundary and the **same** "now", or a paid booking completes at a different moment than an unpaid one becomes a no-show.

---

## 5. Bank transfer

Two halves, both admin-only. They mean different things and both are worth having.

### 5.1 The payment method

Selectable when creating or editing a booking **in the admin, and nowhere else**.

- Booking is **confirmed immediately**, payment left **pending**
- **Invoice raised up front** — that invoice is what the customer pays against (the opposite of cash, where the invoice waits until paid)
- Settled with the same **Mark Payment as Complete** button cash uses
- Payments screen gets a Bank Transfer filter

### 5.2 Keeping it off the front end — read this carefully

The public form not rendering the option is **not** sufficient. The AJAX endpoint behind that form is handed raw `$_POST`, so a crafted request can carry any method it likes. The validator is the real boundary.

Gate it with an **explicit argument**, never with a flag inside the submitted data:

```php
// Public AJAX path — no second argument, backend methods refused.
$validator->validate_booking_data($_POST);

// Admin form — explicitly unlocked.
$validator->validate_booking_data($data, true);
```

A flag read out of `$data` (`is_admin`, `created_by_admin`, …) is settable by the customer. HRB has a test that submits exactly that forged payload and asserts it is still refused.

### 5.3 The internal note

Separate from the method: a **"Paid by bank transfer"** checkbox on the same forms.

- The **method** says how a booking is *to be* settled
- The **note** records that it *was*

The note never reaches the customer, and it changes nothing — not booking status, not payment status, not the method.

> **Trap that will bite you.** Ticking an internal note and saving must not email the customer "your booking was modified". See §9.3.

### 5.4 Settings

A Bank Transfer settings tab: enable toggle, bank name, account holder, IBAN, BIC/SWIFT, payment reference, free-text instructions.

- The **reference** is a template; `{booking_reference}` is substituted per booking. On a new-booking form there is no reference yet, so leave the placeholder standing rather than blanking it.
- **Account holder, IBAN and BIC fall back** to the company bank details already used elsewhere (HRB uses the cancellation-fee invoice's), so the IBAN is not typed twice. Treat whitespace-only as empty.
- The account block appears on the booking form as soon as the method is selected *or* the note is ticked.

### 5.5 Trap

**A booking whose method is bank transfer keeps it even if the setting is later switched off.** Build the "what may be offered" list from the setting, but merge the booking's current method back in when rendering an edit form — otherwise turning the option off silently rewrites the payment method of every existing booking the next time someone saves one.

### 5.6 Data

`bookings` table gains `paid_by_bank_transfer TINYINT(1) NOT NULL DEFAULT 0`.

---

## 6. Booking-window semantics

This one went back and forth across four releases. **Port the final answer (v1.16.0) and read the rest as a warning.**

### 6.1 The rule

> "Booking Start Time" and "Booking End Time" bound **when a booking may start**. They say nothing about how long it runs or when it ends.

With an end time of `23:30` and a three-hour booking, the last slot offered is **23:30–02:30**. It runs past the window and past midnight, and that is the point.

### 6.2 The detours

- **v1.12.0** made the window bound the start. Correct.
- **v1.13.1** renamed the settings to "Opening/Closing Time".
- **v1.14.0** reinterpreted them as *office opening hours* — the wall-clock time at which a booking may be **placed**, unrelated to the slot. Wrong reading; every hour became bookable and a wall-clock check was added on submission.
- **v1.16.0** reverted to the v1.12.0 meaning, restored the original names, removed the wall-clock check and the timezone helper it needed.

Ship the v1.16.0 meaning. If Booking Suite genuinely needs "hours during which bookings may be placed", make it a **separate setting** — the two are different questions and sharing one field caused the whole detour.

### 6.3 Details

- **Both ends inclusive.** A window ending 23:30 makes 23:30 itself bookable.
- **An end of `00:00` or `24:00` means midnight at the end of the day.**
- **A window whose end precedes its start (20:00–02:00) wraps midnight.**
- **A room's own bookable hours follow the same rule** and are **additional** to the global window — both must allow the start. Do not let the room's hours replace the global ones, or the picker offers slots the save then rejects.
- **Admins are exempt** from this and from the past-date, advance-window and duration rules.
- **One function decides it**, and the save path, the slot picker, both calendars and both search filters all call it. That is what stops them drifting apart.

### 6.4 Duration rules

Minimum 2 hours. Maximum **12** for a public booking, **24** for one an admin enters.

> **Trap.** HRB carried a *duplicate* duration check hardcoded to 12 that ran after the admin allowance and silently overruled it, so admins could never book more than 12 hours. And the slot endpoint refused anything over 12 for everyone while the admin form offered 2–24. Keep one check, and make the picker and the save agree.

---

## 7. Room and maintenance locks

### 7.1 The rule

A lock (room-specific or global/master) blocks any slot that **overlaps** it. Half-open at both ends: a slot ending exactly when a lock begins, or starting exactly when one ends, is free.

### 7.2 The bug worth knowing about (v1.18.1)

A room locked from 17:13 on the 24th to 18:13 on the 25th still offered `22:00–00:00`, `22:30–00:30`, `23:00–01:00` and `23:30–01:30` on the 24th.

The slot picker pinned **both ends** of a slot to the booking date, so `22:00–00:00` became:

```
24th 22:00  →  24th 00:00     // a window running backwards
```

A backwards window fails every overlap test it is put through. The afternoon slots blocked correctly, which is what made the lock look half-applied rather than broken.

Two fixes:

1. **Roll the end onto the next day** when it does not follow the start (§8).
2. **Widen the lock fetch.** The query only loaded locks falling inside the booking date, so a slot starting at 23:30 and running into the next morning was never compared against a lock waiting for it there. Fetch everything the longest slot starting on that date can reach — HRB uses `[date 00:00, date + 2 days)`.

### 7.3 Trap

HRB had **two copies** of the overlap comparison: the correct one guarding the save, and a hand-written one drawing the picker. Only the second was wrong, which is why locked slots were *shown* but could never actually be *booked*. Put the comparison in one function and have both call it.

---

## 8. Cross-midnight: the recurring trap

Nearly every bug in this period traces back to the same assumption. Booking Suite will have it too.

**A booking that runs past midnight is stored on the day it starts, with an end time earlier than its start.** `23:30–02:30` is one row, on one date, and read naively it looks like a booking that ended twenty-one hours before it began.

**The rule, everywhere:**

```php
if (strtotime($end_time) <= strtotime($start_time)) {
    $end_date = date('Y-m-d', strtotime($booking_date . ' +1 day'));
}
```

Note `<=`, not `<`: an end equal to the start is a full 24-hour booking, and `00:00` as an end time is midnight *tomorrow*.

Places it was got wrong in HRB, all of which you will have equivalents of:

- Calendar feeds drew events ending before they began
- `CONCAT(booking_date, end_time)` in SQL marked an overnight booking completed before it started
- The slot picker built end times like `25:00:00`
- Room-lock overlap checks (§7)
- The past-booking boundary (§3)
- Time dropdowns came out empty when the end was `00:00`, because the hour loop counted from 8 down to 0

**Still outstanding in HRB, and worth doing right from the start here:** extras/add-on stock is *not* cross-midnight aware. It matches overlapping bookings by date plus time-of-day, so the hours an overnight booking runs into the next day are not counted against stock, and the same item can be taken twice in that window.

---

## 9. Other fixes worth carrying over

### 9.1 CSV exports that returned `0`

The export buttons posted `action=export_payments` to admin-ajax, and **WordPress only dispatches an action that has a matching `wp_ajax_{action}` hook registered.** There was no such hook, so what came back was admin-ajax's "nothing matched" body — a single `0` byte, saved as the CSV.

When porting exports:
- Register the handler, obviously
- **Read the same filters the screen is showing** (status, method, date range, search) so the file matches what the user was looking at
- **Resolve the screen's date range and the export's through one shared rule**, or the file covers a different period than the screen
- **Emit a UTF-8 BOM** or Excel opens it as mojibake
- **Check a capability.** HRB's booking CSV export had *no* capability check at all — only the shared nonce, which every plugin admin page carries.

### 9.2 Update delivery (only if Booking Suite self-updates from GitHub)

- Hook **both** `pre_set_site_transient_update_plugins` (WordPress *building* its update list — throttled, and abandoned early when it cannot reach api.wordpress.org) **and** `site_transient_update_plugins` (every *read* of that list, which is what actually draws the screen). The read filter must **never touch the network** — it runs on front-end requests too.
- A cron event keeps the cache warm so an idle site still notices a release.
- **Cache TTL depends on the answer:** short (60s) while up to date — that is the state a new release has to be noticed in — and long (6h) once an update is already pending, because the read filter is already putting it on screen every page load. A single long TTL in both states was the bug behind three "the update never arrived" reports.
- **A failed lookup must not overwrite a good answer.** On some hosts the lookup succeeds from wp-admin and fails from WP-Cron; each cron failure was replacing a perfectly good release with an empty one for fifteen minutes. Keep the last answer that had a version and record the error alongside it.
- **Say what the last check found** on the plugins row — "Latest release: x.y.z", or the actual error. Silence is the hardest version of this bug to diagnose.
- **Unauthenticated GitHub allows 60 calls/hour per IP** and answers 403 beyond it, which gets cached as "no release". Polling harder produces *fewer* update notices, not more.

> **Field note.** booking.techyza.com runs on Hostinger, which blocks all outbound traffic to GitHub (`api.github.com`, `github.com`, `objects.githubusercontent.com` all time out at the TCP layer) while proxying `api.wordpress.org` and `downloads.wordpress.org` through its own MU-plugin. No updater code can work around that — it needs a hosting-side allowance, or manual installation. Worth knowing before building a GitHub updater for a site on that host.

### 9.3 Do not email the customer about changes they cannot see

The admin edit form decides whether to send a "your booking was modified" notice by diffing the customer-facing fields. HRB's check matched an internal room move **exactly** (`diff === ['room_id']`), which meant an edit with **no** customer-facing change at all fell through to "notify".

So saving the form untouched — or ticking only an internal note — emailed the customer.

Treat **both** an empty diff and a room-only diff as "nothing the customer would notice". Keep internal-only fields (the bank transfer note, admin notes if you treat them that way) **out of the comparison set** entirely, so touching them leaves no diff.

### 9.4 Smaller ones

- An internal room move (Room 2 → Room 3) should not notify the customer; any other edit still should.
- On the payments screen, a refused AJAX request must **say so**. HRB's handler had no `else` branch, so a refusal arrived and nothing on screen changed — indistinguishable from a dead button.
- If the server will refuse an action, either give the role the capability or do not render the button. Do not render a button that cannot work.

---

## 10. Database changes

| Table | Column | Type | Notes |
|---|---|---|---|
| bookings | `paid_by_bank_transfer` | `TINYINT(1) NOT NULL DEFAULT 0` | The internal bank transfer note |

Payment status gains a new value: **`nil`**. Add it to constants, labels and the valid-values list.

**Migration pattern HRB uses**, worth copying — it means existing installs pick a column up without reactivating:

1. Add the column to the `CREATE TABLE` for fresh installs
2. Add it to the upgrade routine's column check
3. Add a standalone, **option-gated** migration hooked on `admin_init`:

```php
if (get_option('..._migrated') === 'yes') return;   // cheap guard, one SHOW COLUMNS per install
// ... ALTER TABLE if the column is absent ...
update_option('..._migrated', 'yes');
```

---

## 11. How this was pinned

HRB has no PHPUnit. Tests are standalone PHP files that stub just enough of WordPress to load the class under test, and exit non-zero on failure:

```
php tests/unit/test-no-show.php
```

The ones relevant here, worth writing equivalents of:

| File | Covers |
|---|---|
| `test-roles-and-exports.php` | Role/capability map, the past-booking boundary |
| `test-no-show.php` | No-show criteria, `nil`, the SQL expression |
| `test-bank-transfer.php` | Admin-only method, the forged-flag payload, settings fallback |
| `test-slot-locks.php` | Lock overlap, cross-midnight slots, boundary cases |
| `test-booking-window.php` | Window rule, inclusive ends, midnight wrap |
| `test-room-only-change.php` | Which edits notify the customer |

Pure rules — boundaries, overlaps, capability maps — are cheap to pin this way and were where every regression in this period lived.

---

## 12. Suggested order

1. **Roles and capabilities** (§2) — everything else references it
2. **Cross-midnight helper** (§8) — one function, used by everything after this
3. **Past-booking boundary** (§3) — built on §8
4. **No-show + `nil`** (§4) — built on §3
5. **Booking window** (§6) — independent, but high value
6. **Room locks** (§7) — built on §8
7. **Bank transfer** (§5) — self-contained
8. **Exports and notification fixes** (§9) — independent
