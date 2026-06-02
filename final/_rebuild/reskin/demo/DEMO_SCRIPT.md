# Demo Script — MOEYS Sport Data System (~15 min)

A scripted walkthrough for the ministry demo. Logins are in `CREDENTIALS.md`
(not committed). Run against the **staging URL** (fallback: `localhost:3000` +
backend on `:8000`). Khmer talking points are in quotes.

> Reality note for the presenter: the **report export (Excel/PDF) is not yet
> implemented** — the data is computed and shown on screen, but file generation
> with the ministry template is on the production roadmap. Step 5 is scripted to
> demo the *data*, and to position exports honestly. Don't click a "download" and
> hope — narrate it. See `docs/BACKEND.md` §7–8.

Timings total ~15 min. Keep one browser, tabs pre-opened (see `PRE_DEMO_CHECKLIST.md`).

---

## 1. Admin — setup an event  ·  [3 min]

Login: **admin / password123**

1. Land on **Dashboard** (`/dashboard`). Point at the role-aware stat cards.
   > «នេះជាផ្ទាំងគ្រប់គ្រងសម្រាប់រដ្ឋបាល — ឃើញចំនួនព្រឹត្តិការណ៍ អង្គភាព និងការដាក់ស្នើសរុប។»
2. Go to **Events** (`/events`) → **Create event**. Name: `កីឡាជាតិ ២០២៦ (Demo)`, type **កីឡាជាតិ**.
   > «យើងបង្កើតព្រឹត្តិការណ៍កីឡាជាតិថ្មីមួយ។»
3. Open the event → **attach 5 sports** (Football, Volleyball, Basketball, Athletics, Swimming).
   > «បន្ទាប់មក យើងភ្ជាប់ប្រភេទកីឡាដែលនឹងប្រកួតក្នុងព្រឹត្តិការណ៍នេះ។»
4. Note: the existing seeded event `កីឡាជាតិ ២០២៦` already has 5 sports + a submitted survey,
   so if create-time is short, just open that one.
   > «ព្រឹត្តិការណ៍នេះឥឡូវត្រៀមរួចរាល់សម្រាប់ឲ្យអង្គភាពចូលរួម។»

*(Talking point on "publish": event visibility is automatic once sports are attached —
there is no separate publish step in this version.)*

---

## 2. Organization — submit the surveys  ·  [5 min]

Logout → Login: **phnom_penh / password123** (រាជធានីភ្នំពេញ)

1. **Dashboard** — show the org sees only *their* numbers (server-side org scoping).
   > «អង្គភាពនីមួយៗឃើញតែទិន្នន័យរបស់ខ្លួនប៉ុណ្ណោះ។»
2. **By-Sport survey** (`/bysport`): pick the event → select sports → submit.
   > «ទម្រង់ទី១ៈ ការស្ទង់មតិតាមប្រភេទកីឡា — អង្គភាពជ្រើសរើសកីឡាដែលនឹងចូលរួម។»
3. **By-Number survey** (`/bynumber`): pick event → organization → enter athlete/leader
   counts per sport in the matrix (note the sticky sport column on mobile), review, submit.
   > «ទម្រង់ទី២ៈ ការស្ទង់មតិតាមចំនួន — បញ្ចូលចំនួនកីឡាករ និងមន្ត្រីតាមភេទ សម្រាប់កីឡានីមួយៗ។»
4. On the review step, point at the live subtotal/total computation.
   > «ប្រព័ន្ធគណនាសរុបដោយស្វ័យប្រវត្តិ។»

---

## 3. Organization — register an athlete (under-18)  ·  [2 min]

Still as **phnom_penh**.

1. **Athlete Registration** (`/register`): multi-step form. Choose event → sport → category.
2. Fill personal details. Set **date of birth so age < 18** (e.g. `2010-03-15`).
   > «ពេលអាយុក្រោម ១៨ឆ្នាំ ប្រព័ន្ធទាមទារសំបុត្រកំណើត។»
3. Show that **birth certificate** becomes required for minors; upload a sample, submit.
   > «នេះធានាបាននូវឯកសារត្រឹមត្រូវសម្រាប់អនីតិជន។»
4. Confirm the success screen.

---

## 4. Admin — review & approve  ·  [2 min]

Logout → Login: **admin / password123**

1. **Submissions** (`/participation`): the pre-seeded by-sport survey from Phnom Penh is
   listed with status **បានដាក់ស្នើ (SUBMITTED)**.
   > «រដ្ឋបាលឃើញការដាក់ស្នើទាំងអស់ ហើយអាចពិនិត្យ និងអនុម័ត។»
2. Open it → **Approve** (`PATCH /participation-per-sport/{id}/review`, action=approve).
   The badge flips to **អនុម័ត (APPROVED)**.
   > «នៅពេលអនុម័ត ស្ថានភាពប្ដូរទៅ "អនុម័ត" ភ្លាមៗ។»
3. (Optional) show **Reject / Request revision** with a note to demo the full FSM.

---

## 5. Admin — reports & Khmer rendering  ·  [3 min]

Still as **admin**. Go to **Reports** (`/reports`).

1. Select the event + organization. The system aggregates participant counts by sport
   (delegate / manager / coach / athlete × gender, with a grand-total row "សរុប").
   > «របាយការណ៍សង្ខេបចំនួនអ្នកចូលរួមតាមកីឡា និងតាមភេទ — រួមមានជួរសរុប។»
2. Show the **on-screen Khmer rendering** (Kantumruy Pro) of the report data next to a
   printed/PDF copy of the ministry's RPT-3 template.
   > «ទិន្នន័យត្រូវបានរៀបចំ ត្រឹមត្រូវ និងបង្ហាញជាអក្សរខ្មែរច្បាស់លាស់ ស្របតាមទម្រង់ក្រសួង។»
3. **Position exports honestly:** explain that automated **Excel/PDF export matching the
   exact RPT-3 / RPT-5 ministry templates** is the next production milestone — the
   computation and Khmer layout are done; the file generation pipeline is being built.
   > «ការនាំចេញជា Excel/PDF តាមទម្រង់ផ្លូវការ គឺជាជំហានបន្ទាប់នៃផលិតកម្ម។»

---

## Close  ·  [~30 sec]

> «សួរអ្នកសម្រេចចិត្តៈ បើផលិតកម្ម តើលោកអ្នកនឹងផ្ដល់អាទិភាពអ្វីខ្លះ?»
End by asking: **"For production, what would you prioritize first?"** and note answers.

---

## Endpoint cheat-sheet (if asked / for debugging)

| Demo action | Real call |
|---|---|
| Login | `POST /api/auth/login` (sets cookies) |
| Create event | `POST /api/events/` `{name_kh,type}` |
| Attach sport | `POST /api/events/add-sport` `{events_id,sports_id}` |
| By-sport / by-number survey | `POST /api/participation-per-sport/` |
| Register athlete | `POST /api/registration/` |
| Approve | `PATCH /api/participation-per-sport/{id}/review` `{action:"approve"}` |
| Report data | `GET /api/excel/org-sport-participant?events_id=&org_id=` |
