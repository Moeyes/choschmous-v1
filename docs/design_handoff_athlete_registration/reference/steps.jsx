/* =====================================================================
   steps.jsx — the 5 wizard step screens + review
   Each receives { form, set, errors, lang }
   ===================================================================== */

function CardHead({ icon, title, sub }) {
  return (
    <div className="card__head">
      <div className="card__icon"><Icon name={icon} size={24} /></div>
      <div>
        <h2 className="card__title">{title}</h2>
        <p className="card__sub">{sub}</p>
      </div>
    </div>
  );
}

function SectionLabel({ icon, children }) {
  return (
    <div className="section-label">
      {icon && <Icon name={icon} size={15} />}
      <span>{children}</span>
      <span className="section-label__line" />
    </div>
  );
}

// ---- STEP 1 · Event & Sports ---------------------------------------------
function Step1({ form, set, errors, lang }) {
  return (
    <div className="card step-anim">
      <CardHead icon="Trophy" title={t(STR.s1_title, lang)} sub={t(STR.s1_sub, lang)} />
      <hr className="card__divider" />
      <div className="grid grid--2">
        <Field label={t(STR.f_eventType, lang)} icon="LayoutGrid" required lang={lang} error={errors.eventType}>
          <Dropdown options={EVENT_TYPES} value={form.eventType}
            onChange={(v) => set({ eventType: v })} lang={lang} error={errors.eventType} />
        </Field>
        <Field label={t(STR.f_event, lang)} icon="CalendarDays" required lang={lang} error={errors.event}>
          <Dropdown options={EVENTS} value={form.event}
            onChange={(v) => set({ event: v })} lang={lang} error={errors.event} />
        </Field>
        <Field label={t(STR.f_org, lang)} icon="Building2" required lang={lang} error={errors.org} className="col-span-2">
          <Dropdown options={ORGS} value={form.org} searchable
            onChange={(v) => set({ org: v })} lang={lang} error={errors.org} />
        </Field>
      </div>

      <div style={{ height: 28 }} />
      <SectionLabel icon="Medal">{t(STR.f_sport, lang)}</SectionLabel>
      {errors.sports && (
        <div className="field__error" style={{ marginBottom: 12 }}>
          <Icon name="AlertCircle" size={14} /><span>{errors.sports}</span>
        </div>
      )}
      <SportGrid options={SPORTS} selected={form.sports || []} lang={lang}
        onToggle={(id) => {
          const cur = form.sports || [];
          set({ sports: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
        }} />
    </div>
  );
}

// ---- STEP 2 · Category ----------------------------------------------------
function Step2({ form, set, errors, lang }) {
  return (
    <div className="card step-anim">
      <CardHead icon="Layers" title={t(STR.s2_title, lang)} sub={t(STR.s2_sub, lang)} />
      <hr className="card__divider" />
      <Field label={t(STR.f_category, lang)} icon="Users" required lang={lang} error={errors.category}>
        <RadioCards options={CATEGORIES} value={form.category}
          onChange={(v) => set({ category: v })} lang={lang} />
      </Field>
    </div>
  );
}

// ---- STEP 3 · Personal info ----------------------------------------------
function Step3({ form, set, errors, lang }) {
  return (
    <div className="card step-anim">
      <CardHead icon="UserCircle2" title={t(STR.s3_title, lang)} sub={t(STR.s3_sub, lang)} />
      <hr className="card__divider" />

      <SectionLabel icon="Type">{t(STR.grp_nameKh, lang)}</SectionLabel>
      <div className="grid grid--2">
        <Field label={t(STR.f_lastName, lang)} required lang={lang} error={errors.lastNameKh}>
          <TextInput value={form.lastNameKh} onChange={(v) => set({ lastNameKh: v })}
            placeholder="ឧ. សុខ" error={errors.lastNameKh} />
        </Field>
        <Field label={t(STR.f_firstName, lang)} required lang={lang} error={errors.firstNameKh}>
          <TextInput value={form.firstNameKh} onChange={(v) => set({ firstNameKh: v })}
            placeholder="ឧ. ពិសិដ្ឋ" error={errors.firstNameKh} />
        </Field>
      </div>

      <div style={{ height: 24 }} />
      <SectionLabel icon="CaseSensitive">{t(STR.grp_nameEn, lang)}</SectionLabel>
      <div className="grid grid--2">
        <Field label={t(STR.f_lastName, lang)} required lang={lang} error={errors.lastNameEn}>
          <TextInput value={form.lastNameEn} onChange={(v) => set({ lastNameEn: v })}
            placeholder="e.g. SOK" error={errors.lastNameEn} dir="ltr" />
        </Field>
        <Field label={t(STR.f_firstName, lang)} required lang={lang} error={errors.firstNameEn}>
          <TextInput value={form.firstNameEn} onChange={(v) => set({ firstNameEn: v })}
            placeholder="e.g. PISETH" error={errors.firstNameEn} dir="ltr" />
        </Field>
      </div>

      <div style={{ height: 24 }} />
      <SectionLabel icon="IdCard">{t(STR.grp_identity, lang)}</SectionLabel>
      <div className="grid grid--3">
        <Field label={t(STR.f_gender, lang)} required lang={lang} error={errors.gender}>
          <Segmented options={GENDERS} value={form.gender} onChange={(v) => set({ gender: v })} lang={lang} />
        </Field>
        <Field label={t(STR.f_dob, lang)} icon="Calendar" required lang={lang} error={errors.dob}>
          <input type="date" className={"control" + (errors.dob ? " is-error" : "")}
            value={form.dob || ""} onChange={(e) => set({ dob: e.target.value })} />
        </Field>
        <Field label={t(STR.f_phone, lang)} required lang={lang} error={errors.phone}>
          <TextInput value={form.phone} onChange={(v) => set({ phone: v })}
            placeholder="012 345 678" icon="Phone" type="tel" inputMode="tel" error={errors.phone} dir="ltr" />
        </Field>
        <Field label={t(STR.f_nationality, lang)} required lang={lang} error={errors.nationality}>
          <Dropdown options={NATIONALITIES} value={form.nationality}
            onChange={(v) => set({ nationality: v })} lang={lang} error={errors.nationality} />
        </Field>
        <Field label={t(STR.f_idType, lang)} required lang={lang} error={errors.idType}>
          <Dropdown options={ID_TYPES} value={form.idType}
            onChange={(v) => set({ idType: v })} lang={lang} error={errors.idType} />
        </Field>
        <Field label={t(STR.f_idNumber, lang)} required lang={lang} error={errors.idNumber}>
          <TextInput value={form.idNumber} onChange={(v) => set({ idNumber: v })}
            placeholder="123456789" icon="Hash" error={errors.idNumber} dir="ltr" />
        </Field>
      </div>

      <div style={{ height: 24 }} />
      <div className="grid grid--2">
        <Field label={t(STR.f_address, lang)} icon="MapPin" required lang={lang} error={errors.address} className="col-span-2">
          <textarea className={"control" + (errors.address ? " is-error" : "")}
            value={form.address || ""} placeholder={lang === "en" ? "House, street, commune, district, province" : "ផ្ទះ ផ្លូវ ឃុំ/សង្កាត់ ស្រុក/ខណ្ឌ ខេត្ត/ក្រុង"}
            onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <Field label={t(STR.f_role, lang)} icon="UserCog" required lang={lang} error={errors.role}>
          <Dropdown options={ROLES} value={form.role}
            onChange={(v) => set({ role: v })} lang={lang} error={errors.role} />
        </Field>
      </div>
    </div>
  );
}

// ---- STEP 4 · Documents ---------------------------------------------------
function Step4({ form, set, errors, lang }) {
  return (
    <div className="card step-anim">
      <CardHead icon="FolderUp" title={t(STR.s4_title, lang)} sub={t(STR.s4_sub, lang)} />
      <hr className="card__divider" />
      <SectionLabel icon="Camera">{t(STR.up_photo, lang)} <span style={{ color: "var(--danger)" }}>*</span></SectionLabel>
      <UploadHero value={form.photo} onChange={(v) => set({ photo: v })} lang={lang} />
      {errors.photo && (
        <div className="field__error" style={{ marginTop: 10 }}>
          <Icon name="AlertCircle" size={14} /><span>{errors.photo}</span>
        </div>
      )}

      <div style={{ height: 28 }} />
      <SectionLabel icon="Paperclip">{t(STR.rev_docs, lang)}</SectionLabel>
      <div className="grid grid--2">
        <Field label={t(STR.up_id, lang)} required lang={lang} error={errors.idDoc}>
          <UploadTile title={t(STR.up_id, lang)} value={form.idDoc} onChange={(v) => set({ idDoc: v })} lang={lang} />
        </Field>
        <Field label={t(STR.up_birth, lang)} optional lang={lang}>
          <UploadTile title={t(STR.up_birth, lang)} value={form.birthDoc} onChange={(v) => set({ birthDoc: v })} lang={lang} />
        </Field>
      </div>
    </div>
  );
}

// ---- STEP 5 · Review ------------------------------------------------------
function ReviewRow({ k, children }) {
  return (
    <div className="review-row">
      <div className="review-row__k">{k}</div>
      <div className="review-row__v">{children || "—"}</div>
    </div>
  );
}

function nameOf(list, id, lang) {
  const o = list.find((x) => x.id === id);
  return o ? t(o, lang) : "—";
}

function Step5({ form, lang, consent, setConsent }) {
  const sportNames = (form.sports || []).map((id) => SPORTS.find((s) => s.id === id)).filter(Boolean);
  return (
    <div className="card step-anim">
      <CardHead icon="ClipboardCheck" title={t(STR.s5_title, lang)} sub={t(STR.s5_sub, lang)} />
      <hr className="card__divider" />
      <div className="review-grid">
        {/* Event block */}
        <div className="review-block">
          <div className="review-block__head"><span className="ico"><Icon name="Trophy" size={18} /></span>{t(STR.rev_event, lang)}</div>
          <div className="review-block__body">
            <ReviewRow k={t(STR.f_event, lang)}>{nameOf(EVENTS, form.event, lang)}</ReviewRow>
            <ReviewRow k={t(STR.f_org, lang)}>{nameOf(ORGS, form.org, lang)}</ReviewRow>
            <ReviewRow k={t(STR.f_category, lang)}>{nameOf(CATEGORIES, form.category, lang)}</ReviewRow>
            <ReviewRow k={t(STR.f_sport, lang)}>
              <div className="review-tags">
                {sportNames.length ? sportNames.map((s) => (
                  <span key={s.id} className="review-tag"><Icon name={s.icon} size={13} />{t(s, lang)}</span>
                )) : "—"}
              </div>
            </ReviewRow>
          </div>
        </div>
        {/* Personal block */}
        <div className="review-block">
          <div className="review-block__head"><span className="ico"><Icon name="UserCircle2" size={18} /></span>{t(STR.rev_personal, lang)}</div>
          <div className="review-block__body">
            <ReviewRow k={t(STR.grp_nameKh, lang)}>{[form.lastNameKh, form.firstNameKh].filter(Boolean).join(" ")}</ReviewRow>
            <ReviewRow k={t(STR.grp_nameEn, lang)}>{[form.lastNameEn, form.firstNameEn].filter(Boolean).join(" ").toUpperCase()}</ReviewRow>
            <ReviewRow k={t(STR.f_gender, lang) + " · " + t(STR.f_dob, lang)}>
              {nameOf(GENDERS, form.gender, lang)}{form.dob ? "  ·  " + form.dob : ""}
            </ReviewRow>
            <ReviewRow k={t(STR.f_phone, lang)}>{form.phone}</ReviewRow>
            <ReviewRow k={t(STR.f_idType, lang)}>{nameOf(ID_TYPES, form.idType, lang)}{form.idNumber ? "  ·  " + form.idNumber : ""}</ReviewRow>
            <ReviewRow k={t(STR.f_role, lang)}>{nameOf(ROLES, form.role, lang)}</ReviewRow>
          </div>
        </div>
      </div>

      {/* Documents row */}
      <div className="review-block" style={{ marginTop: 22 }}>
        <div className="review-block__head"><span className="ico"><Icon name="Paperclip" size={18} /></span>{t(STR.rev_docs, lang)}</div>
        <div className="review-block__body" style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "14px 18px" }}>
          {[
            { f: form.photo, label: t(STR.up_photo, lang) },
            { f: form.idDoc, label: t(STR.up_id, lang) },
            { f: form.birthDoc, label: t(STR.up_birth, lang) },
          ].map((d, i) => (
            <span key={i} className="review-tag" style={d.f
              ? { background: "var(--success-l)", color: "#176f44" }
              : { background: "var(--surface-3)", color: "var(--muted)" }}>
              <Icon name={d.f ? "CheckCircle2" : "MinusCircle"} size={14} />{d.label}
            </span>
          ))}
        </div>
      </div>

      <div className="notice">
        <span className="notice__ico"><Icon name="ShieldCheck" size={20} /></span>
        <div>
          <div className="notice__title">{t(STR.notice_title, lang)}</div>
          <div className="notice__text">{t(STR.notice_text, lang)}</div>
        </div>
      </div>

      <button type="button" className={"consent" + (consent ? " is-checked" : "")} onClick={() => setConsent(!consent)}>
        <span className="consent__box">{consent && <Icon name="Check" size={16} stroke={3} />}</span>
        <span className="consent__text">{t(STR.consent_text, lang)}</span>
      </button>
    </div>
  );
}

Object.assign(window, { Step1, Step2, Step3, Step4, Step5, CardHead });
