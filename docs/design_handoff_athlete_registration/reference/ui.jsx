/* =====================================================================
   ui.jsx — shared presentational components
   ===================================================================== */
const { useState, useRef, useEffect, useCallback } = React;

// ---- Icon (lucide UMD → React svg, with graceful fallback) ---------------
function Icon({ name, size = 24, stroke = 2, className, style }) {
  const lib = window.lucide && window.lucide.icons;
  const data = (lib && (lib[name] || lib.Circle)) || null;
  if (!data) return null;
  const children = data[2] || [];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
      strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      {children.map((c, i) => React.createElement(c[0], { key: i, ...c[1] }))}
    </svg>
  );
}

// ---- Field wrapper (label + required + error) ----------------------------
function Field({ label, icon, required, optional, hint, error, lang, children, className }) {
  return (
    <div className={"field " + (className || "")}>
      {label && (
        <label className="field__label">
          {icon && <span className="lic"><Icon name={icon} size={17} /></span>}
          <span>{label}</span>
          {required && <span className="req" title="*">*</span>}
          {optional && <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 13 }}>· {t(STR.optional, lang)}</span>}
        </label>
      )}
      {hint && <div className="field__hint">{hint}</div>}
      {children}
      {error && (
        <div className="field__error">
          <Icon name="AlertCircle" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ---- Plain text input ----------------------------------------------------
function TextInput({ value, onChange, placeholder, error, icon, type = "text", inputMode, dir }) {
  const el = (
    <input
      type={type}
      inputMode={inputMode}
      dir={dir}
      className={"control" + (error ? " is-error" : "")}
      value={value || ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  if (icon) {
    return (
      <div className="input-ico">
        <span className="input-ico__ico"><Icon name={icon} size={18} /></span>
        {el}
      </div>
    );
  }
  return el;
}

// ---- Rich dropdown (single select, icons, optional search) ---------------
function Dropdown({ options, value, onChange, lang, placeholder, error, searchable, withIcons = true }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = q
    ? options.filter((o) => (o.km + " " + o.en).toLowerCase().includes(q.toLowerCase()))
    : options;

  return (
    <div className="dd" ref={ref}>
      <button type="button"
        className={"dd__btn" + (open ? " is-open" : "") + (error ? " is-error" : "")}
        onClick={() => setOpen((v) => !v)}>
        {selected ? (
          <>
            {withIcons && <span className="dd__btn-ico"><Icon name={selected.icon} size={17} /></span>}
            <span className="dd__btn-label">{t(selected, lang)}</span>
          </>
        ) : (
          <span className="dd__btn-label placeholder">{placeholder || t(STR.pick_one, lang)}</span>
        )}
        <span className="dd__btn-chev"><Icon name="ChevronDown" size={18} /></span>
      </button>
      {open && (
        <div className="dd__menu">
          {searchable && (
            <div className="dd__search">
              <div className="input-ico">
                <span className="input-ico__ico"><Icon name="Search" size={16} /></span>
                <input className="control" style={{ height: 42 }} autoFocus
                  placeholder={t(STR.sport_search, lang)} value={q}
                  onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
          )}
          {filtered.length === 0 && <div className="dd__empty">—</div>}
          {filtered.map((o) => (
            <button key={o.id} type="button"
              className={"dd__opt" + (o.id === value ? " is-selected" : "")}
              onClick={() => { onChange(o.id); setOpen(false); setQ(""); }}>
              {withIcons && <span className="dd__opt-ico"><Icon name={o.icon} size={18} /></span>}
              <span className="dd__opt-main">
                <span className="dd__opt-title">{t(o, lang)}</span>
                {(o.subKm || o.subEn) && <span className="dd__opt-sub">{lang === "en" ? o.subEn : o.subKm}</span>}
              </span>
              {o.id === value && <span className="dd__opt-check"><Icon name="Check" size={18} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Segmented control (e.g. gender) -------------------------------------
function Segmented({ options, value, onChange, lang }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.id} type="button"
          className={"seg" + (o.id === value ? " is-active" : "")}
          onClick={() => onChange(o.id)}>
          <span>{t(o, lang)}</span>
        </button>
      ))}
    </div>
  );
}

// ---- Radio cards (e.g. category) -----------------------------------------
function RadioCards({ options, value, onChange, lang }) {
  return (
    <div className="radio-cards">
      {options.map((o) => (
        <button key={o.id} type="button"
          className={"radio-card" + (o.id === value ? " is-selected" : "")}
          onClick={() => onChange(o.id)}>
          <span className="radio-card__ico"><Icon name={o.icon} size={20} /></span>
          <span style={{ minWidth: 0 }}>
            <span className="radio-card__name" style={{ display: "block" }}>{t(o, lang)}</span>
            {(o.subKm || o.subEn) && <span className="radio-card__sub">{lang === "en" ? o.subEn : o.subKm}</span>}
          </span>
          <span className="radio-card__radio" />
        </button>
      ))}
    </div>
  );
}

// ---- Sport multi-select grid ---------------------------------------------
function SportGrid({ options, selected, onToggle, lang }) {
  const [q, setQ] = useState("");
  const filtered = q
    ? options.filter((o) => (o.km + " " + o.en).toLowerCase().includes(q.toLowerCase()))
    : options;
  return (
    <div>
      <div className="sportbar">
        <div className="sportbar__count">
          <b>{selected.length}</b> {t(STR.sport_selected, lang)} {t(STR.sport_of, lang)} {options.length}
        </div>
        <div className="sport-search">
          <div className="input-ico">
            <span className="input-ico__ico"><Icon name="Search" size={17} /></span>
            <input className="control" placeholder={t(STR.sport_search, lang)}
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="sport-grid">
        {filtered.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button key={o.id} type="button"
              className={"sport-card" + (on ? " is-selected" : "")}
              onClick={() => onToggle(o.id)} aria-pressed={on}>
              <span className="sport-card__check"><Icon name="Check" size={14} stroke={3} /></span>
              <span className="sport-card__ico"><Icon name={o.icon} size={24} /></span>
              <span>
                <span className="sport-card__name" style={{ display: "block" }}>{t(o, lang)}</span>
                <span className="sport-card__sub">{lang === "en" ? o.km : o.en}</span>
              </span>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="chips">
          {selected.map((id) => {
            const o = options.find((s) => s.id === id);
            if (!o) return null;
            return (
              <span key={id} className="chip">
                <Icon name={o.icon} size={14} />
                {t(o, lang)}
                <button type="button" className="chip__x" onClick={() => onToggle(id)} aria-label="remove">
                  <Icon name="X" size={12} stroke={2.5} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- File upload (hero + tile variants) ----------------------------------
function readFileMeta(file) {
  return { name: file.name, size: file.size, url: URL.createObjectURL(file), isImage: file.type.startsWith("image/") };
}

function UploadHero({ value, onChange, lang }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const pick = (files) => { if (files && files[0]) onChange(readFileMeta(files[0])); };
  if (value) {
    return (
      <div className="uploaded" style={{ padding: 18 }}>
        {value.isImage
          ? <img className="uploaded__thumb" src={value.url} alt="" />
          : <span className="uploaded__thumb"><Icon name="FileCheck2" size={22} /></span>}
        <div className="uploaded__meta">
          <div className="uploaded__name">{value.name}</div>
          <div className="uploaded__status"><Icon name="CheckCircle2" size={15} /> {t(STR.up_done, lang)}</div>
        </div>
        <button type="button" className="uploaded__x" onClick={() => onChange(null)} aria-label="remove">
          <Icon name="Trash2" size={17} />
        </button>
      </div>
    );
  }
  return (
    <div className={"upload-hero" + (drag ? " is-drag" : "")}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}>
      <div className="upload-hero__ico"><Icon name="Camera" size={28} /></div>
      <div className="upload-hero__title">{t(STR.up_photo, lang)}</div>
      <div className="upload-hero__sub">{t(STR.up_photo_sub, lang)}</div>
      <button type="button" className="upload-hero__btn" onClick={() => inputRef.current.click()}>
        <Icon name="Upload" size={17} /> {t(STR.up_browse, lang)}
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files)} />
    </div>
  );
}

function UploadTile({ title, value, onChange, lang }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const pick = (files) => { if (files && files[0]) onChange(readFileMeta(files[0])); };
  if (value) {
    return (
      <div className="uploaded">
        {value.isImage
          ? <img className="uploaded__thumb" src={value.url} alt="" />
          : <span className="uploaded__thumb"><Icon name="FileCheck2" size={22} /></span>}
        <div className="uploaded__meta">
          <div className="uploaded__name">{value.name}</div>
          <div className="uploaded__status"><Icon name="CheckCircle2" size={15} /> {t(STR.up_done, lang)}</div>
        </div>
        <button type="button" className="uploaded__x" onClick={() => onChange(null)} aria-label="remove">
          <Icon name="Trash2" size={17} />
        </button>
      </div>
    );
  }
  return (
    <div className={"upload-tile" + (drag ? " is-drag" : "")}
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
      role="button" style={{ cursor: "pointer" }}>
      <div className="upload-tile__ico"><Icon name="UploadCloud" size={22} /></div>
      <div className="upload-tile__title">{title}</div>
      <div className="upload-tile__sub">{t(STR.up_drop, lang)}</div>
      <div className="upload-tile__fmt"><Icon name="Info" size={13} /> {t(STR.up_fmt, lang)}</div>
      <input ref={inputRef} type="file" accept="image/*,.pdf" hidden onChange={(e) => pick(e.target.files)} />
    </div>
  );
}

// ---- Stepper -------------------------------------------------------------
function Stepper({ steps, current, maxReached, onJump, lang }) {
  const pct = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0;
  return (
    <div className="stepper">
      <div className="stepper__track" />
      <div className="stepper__fill" style={{ width: `calc((100% - 88px) * ${pct / 100})` }} />
      {steps.map((s, i) => {
        const state = i < current ? "is-done" : i === current ? "is-active" : "";
        const clickable = i <= maxReached;
        return (
          <button key={s.key} type="button"
            className={"step " + state + (clickable ? " is-clickable" : "")}
            onClick={() => clickable && onJump(i)} disabled={!clickable}>
            <span className="step__dot">
              {i < current ? <Icon name="Check" size={20} stroke={2.5} /> : i + 1}
            </span>
            <span className="step__label">{t(s.label, lang)}</span>
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  Icon, Field, TextInput, Dropdown, Segmented, RadioCards,
  SportGrid, UploadHero, UploadTile, Stepper,
});
