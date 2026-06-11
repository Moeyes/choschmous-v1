# Handoff: MoEYS Athlete Registration — 5-Step Wizard

## Overview
A bilingual (Khmer-first / English) multi-step registration flow for a Ministry of
Education, Youth & Sport (MoEYS) sports-event system. A user (admin) registers an
athlete/participant for a sports event across **5 steps**: Event & Sports → Category →
Personal Info → Documents → Review & Confirm, ending in a success screen.

The redesign targets **older users and government staff**: calm institutional palette,
generous spacing, large readable type, big touch targets, clear step progress, and
plain-language inline validation.

## About the Design Files
The files in `reference/` are a **design reference built in HTML/React (via in-browser
Babel)** — a working prototype that shows the intended look and behavior. **They are not
meant to be shipped as-is.** Your task is to **recreate this design inside the target
Next.js codebase** using its established patterns (App Router, `next/font`, `lucide-react`,
its component conventions). The prototype uses CDN React + global components only because
it runs standalone; in the real project these become proper modules.

Open `reference/index.html` in a browser to see the live prototype.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, components, and interactions
are all defined below and in `reference/styles.css`. Recreate the UI faithfully. Exact
hex values, sizes, and radii are listed in **Design Tokens**.

---

## Target stack (assumed)
- **Next.js App Router** (`app/`), React 18, **TypeScript**.
- **`lucide-react`** for icons (the prototype uses Lucide via UMD; map by name).
- **`next/font/google`** for fonts.
- Plain global CSS is fine (the prototype CSS drops in unchanged). Convert to Tailwind/CSS
  Modules only if that matches the existing project — keep the **token values identical**.

---

## Screens / Views

All five steps share the same **app shell**:
- **Left icon rail** (76px): logo (Landmark icon, blue gradient tile) + nav icons
  (LayoutDashboard, CalendarDays, Trophy, UserPlus = active, Users, FileText, BarChart3),
  spacer, Settings, avatar "S". Active item: blue tint pill (`--primary-l`) + 3px left bar.
- **Top bar** (64px, sticky, translucent white + blur): left = breadcrumb
  (House icon · "ផ្ទះគ្រប់គ្រង / Dashboard" › "ការចុះឈ្មោះអត្តពលិក / Athlete Registration");
  right = **language toggle** (`ខ្មែរ | EN` pill segmented) + user chip (avatar "S",
  name "satpanha", role "អ្នកគ្រប់គ្រង / Administrator").
- **Content area** (scrolls): centered `max-width: 940px`. Page heading (eyebrow pill
  "បើកការចុះឈ្មោះ ២០២៦ / Registration open · 2026", H1 title, subtitle), then the
  **Stepper**, then the active **step card**, then **footer nav** (Back / Next or Submit).

### Stepper
Horizontal, 5 nodes, max-width 760px. A grey track with a blue gradient **fill** that grows
left→right as steps complete (`width = current/(steps-1)`). Each node: 44px circle —
upcoming = white/grey border + number; active = solid blue + number + soft blue glow ring;
done = blue-tint fill + **Check** icon. Labels under each (13px). Nodes ≤ furthest-reached
step are clickable to jump back.

### Step 1 — Event & Sports
- Card header: Trophy icon tile + title "ព្រឹត្តិការណ៍ និងកីឡា / Event & Sports" + subtitle.
- 2-col grid of **rich dropdowns** (each option has an icon + optional sub-label):
  - **Event type** (LayoutGrid label icon) — options: National Sports, School Sports,
    Youth Games, Sports for All.
  - **Event** (CalendarDays) — National Games 2026, SEA Games Prep, Provincial Championship 2026.
  - **Organization / Delegation** (full width, **searchable** dropdown) — Phnom Penh, Siem
    Reap, Battambang, Kampong Cham, Kampot, Preah Sihanouk, Boeung Lich Club.
- **Sports** section (label with underline rule) — **multi-select grid** of sport cards
  (`repeat(auto-fill, minmax(150px,1fr))`, 12px gap). Each card: 46px rounded icon tile,
  Khmer name (15px/600) + secondary-language name (12.5px muted). A **search** input filters
  cards. Selected card: blue tint bg, blue border, icon tile turns solid blue, a check badge
  fades in top-right. A live count ("2 selected of 12") and **chips** of the selected sports
  (each removable with an ×) appear below.

### Step 2 — Category
- Card header: Layers icon. Single field **"Category"** rendered as **radio cards**
  (`minmax(210px,1fr)`): icon tile + name + sub (e.g. "Born after 2008") + a radio dot on the
  right that fills blue when selected. Options: Under 16, Under 18, Under 21, Senior/Open.

### Step 3 — Personal Information
- Card header: UserCircle2 icon. Three labeled sub-sections (each a small uppercase label with
  an underline rule):
  1. **Full name (Khmer)** — 2-col: Last name, First name (text inputs).
  2. **Full name (Latin)** — 2-col: Last name, First name (`dir="ltr"`, uppercased on review).
  3. **Identity & contact** — 3-col grid:
     - **Gender** — **segmented control** (Male / Female).
     - **Date of birth** — native `<input type="date">`.
     - **Phone** — text input with leading Phone icon, `type="tel"`.
     - **Nationality** — dropdown (Cambodian, Thai, Vietnamese, Other).
     - **Identity document type** — dropdown (National ID, Birth Certificate, Passport, Family Book).
     - **Identity document number** — text input with leading Hash icon.
  - **Address** — full-width `<textarea>` (MapPin label icon).
  - **Role in the team** — dropdown (Athlete, Coach, Official, Team Manager).

### Step 4 — Documents
- Card header: FolderUp icon.
- **Profile photo** — large **drag-&-drop hero** (dashed 2px border, Camera icon, "Browse
  file" button). On upload: green "uploaded" row with thumbnail/file-check icon, filename,
  "Uploaded successfully", and a trash button. Required.
- **Documents** sub-section — 2-col **upload tiles**: Identity document (required) and Birth
  certificate (optional). Tile = dashed border, UploadCloud icon, "Click or drag & drop",
  format hint "JPG, PNG, WebP · Max 5MB". Same green uploaded state.

### Step 5 — Review & Confirm
- Card header: ClipboardCheck icon.
- 2-col **review blocks** (header bar + key/value rows):
  - **Event details**: Event, Organization, Category, Sports (as blue tags with icons).
  - **Personal details**: name (KH), name (Latin, uppercased), Gender · DOB, Phone,
    ID type · number, Role.
- Full-width **Documents** block: tag per document — green "uploaded" tag (CheckCircle2) or
  grey "missing" tag (MinusCircle).
- **Privacy notice** (green ShieldCheck panel).
- **Consent checkbox card** ("I confirm the above information is correct…") — must be checked
  to enable Submit.

### Success screen (after Submit)
Centered card (max 560px): green gradient hero with a pop-in **Check** circle, "Registration
successful!" + subtitle; body shows an **Application reference** (e.g. `NG26-482913`) in a
green panel, then two full-width buttons: "Register another participant" (primary) and "Back
to dashboard" (ghost).

---

## Interactions & Behavior
- **Next**: validates the current step; on error, shows inline field errors and does not
  advance. On success, advances, records furthest-reached step, smooth-scrolls content to top.
- **Back**: goes to previous step (disabled on step 1).
- **Stepper jump**: clicking a node ≤ furthest-reached step navigates there.
- **Submit** (step 5): enabled only when consent is checked → shows success screen.
- **Language toggle**: instantly swaps ALL UI strings + data labels between Khmer and English.
  Khmer-name fields always display Khmer regardless of UI language.
- **Entrance animation**: cards fade/slide in (~0.35–0.4s, `cubic-bezier(.2,.7,.2,1)`). Respect
  `prefers-reduced-motion`.
- **Persistence**: UI language, current step, furthest-reached step, and (non-file) form values
  persist to `localStorage` (keys `moeys.lang`, `moeys.step`, `moeys.max`, `moeys.form`). File
  uploads are not persisted. **Guard all `localStorage` access for SSR** (read inside `useEffect`,
  not during render).
- **Validation rules**: every field marked required must be non-empty; step 1 requires ≥1 sport;
  step 4 requires profile photo + identity document (birth certificate optional). Plain-language
  error: "តម្រូវឱ្យបំពេញ / This field is required" and "សូមជ្រើសរើស / Please select".

## State Management
Single client component holds: `lang`, `step`, `maxReached`, `form` (all fields below),
`errors` (map of field→message), `consent` (bool), `submitted` (bool), `refNo` (generated once).
`set(patch)` merges into `form` and clears any errors for the patched keys.

`form` shape:
```
eventType, event, org, sports[],            // step 1
category,                                    // step 2
lastNameKh, firstNameKh, lastNameEn, firstNameEn,
gender, dob, phone, nationality, idType, idNumber, address, role,  // step 3
photo, idDoc, birthDoc                        // step 4 (File metadata or null)
```

---

## Design Tokens
**Copy these verbatim** (full set in `reference/styles.css` `:root`).

Colors
- Background `#eef2f7` · Surface `#ffffff` · Surface-2 `#f6f9fc` · Surface-3 `#eef3f9`
- Ink `#15263a` · Ink-2 `#46586e` · Muted `#7b899c` · Muted-2 `#9aa6b6`
- Line `#e4eaf2` · Line-2 `#d6dfeb` · Line-strong `#c3cfde`
- **Primary `#1f5f9e`** · Primary-d `#18507f` · Primary-dd `#123e63` · Primary-l `#eaf2fb` · Primary-l2 `#dceaf8`
- Focus ring `rgba(31,95,158,.20)`
- Success `#1c8a55` · Success-l `#e8f6ef` · Success-line `#bfe5d1`
- Danger `#c4432e` · Danger-l `#fcecea`

Radius: sm 8 · md 12 · lg 16 · xl 22 (px). 
Shadows: sm `0 1px 2px rgba(20,40,70,.06)`; md `0 4px 16px rgba(20,40,70,.07), 0 1px 3px rgba(20,40,70,.05)`; lg `0 18px 50px rgba(20,40,70,.12), 0 4px 12px rgba(20,40,70,.06)`.

Layout: sidebar 76px · topbar 64px · content max-width 940px.
Controls: inputs/dropdowns 50px tall, 1.5px border, 12px radius, focus = primary border + 4px ring.
Buttons: 52px tall (lg 56px), 12px radius; primary = solid `--primary` + blue shadow; ghost = white + border; success = solid green.

Typography
- **Latin: "Public Sans"** (400/500/600/700/800). **Khmer: "Kantumruy Pro"** (300–700).
- Stack: `'Public Sans', 'Kantumruy Pro', system-ui, sans-serif` (Latin glyphs use Public Sans,
  Khmer glyphs fall back to Kantumruy Pro automatically). Khmer line-height ~1.7.
- H1 30px/700 · card title 21px/700 · labels 14.5px/600 · inputs 15.5px · body 16px.

Responsive: < 820px collapses 2/3-col grids to 1 col, shrinks stepper; < 560px hides the rail.

## Assets
- **Icons: Lucide** (`lucide-react`). Names referenced by `data.jsx` / `steps.jsx` / `app.jsx`:
  sports — Goal, Volleyball, Dribbble, Footprints, Waves, Bike, Dumbbell, Swords, Hand, Activity,
  Disc, Target; plus Trophy, Medal, Globe, Flag, Building2, GraduationCap, HeartHandshake, Users,
  Layers, UserCircle2, Type, CaseSensitive, Contact, FileText, BookUser, Megaphone, ClipboardCheck,
  Briefcase, Camera, UploadCloud, Upload, FolderUp, Paperclip, Info, FileCheck2, CheckCircle2,
  MinusCircle, ShieldCheck, AlertCircle, Search, Check, X, ChevronDown, ChevronRight, ArrowLeft,
  ArrowRight, Send, Sparkles, Landmark, House, Settings, LayoutDashboard, LayoutGrid, CalendarDays,
  Calendar, Phone, Hash, MapPin, UserCog, UserPlus, BarChart3, Baby, User.
  (Note: a few sports map to the nearest generic Lucide glyph — Lucide has no basketball/boxing.)
- **No raster/vector image assets.** Avatars are letter tiles.
- Fonts from Google Fonts via `next/font/google`.

## Files
- `reference/index.html` — entry; loads fonts, Lucide UMD, React/Babel, and the scripts below.
- `reference/styles.css` — **the full design system** (tokens + every component). Drop-in.
- `reference/data.jsx` — i18n dictionary `STR`, `t(entry, lang)` helper, and all domain data
  arrays (events, orgs, sports, categories, genders, id types, roles, nationalities).
- `reference/ui.jsx` — shared components: `Icon`, `Field`, `TextInput`, `Dropdown` (rich +
  searchable), `Segmented`, `RadioCards`, `SportGrid`, `UploadHero`, `UploadTile`, `Stepper`.
- `reference/app.jsx` — app shell, language toggle, wizard orchestration, validation, `Success`.
- `reference/steps.jsx` — the five step screens + review rows.

See **AGENT_PROMPT.md** for a ready-to-paste instruction to drive an AI coding agent.
