/* =====================================================================
   app.jsx — app shell, KH/EN toggle, wizard orchestration, mount
   ===================================================================== */

const STEPS = [
  { key: "event",    label: STR.step1, render: Step1 },
  { key: "category", label: STR.step2, render: Step2 },
  { key: "personal", label: STR.step3, render: Step3 },
  { key: "docs",     label: STR.step4, render: Step4 },
  { key: "review",   label: STR.step5, render: Step5 },
];

const RAIL = [
  { icon: "LayoutDashboard" },
  { icon: "CalendarDays" },
  { icon: "Trophy" },
  { icon: "UserPlus", active: true },
  { icon: "Users" },
  { icon: "FileText" },
  { icon: "BarChart3" },
];

const DEFAULT_FORM = {
  eventType: "national", event: "ng2026", org: "pp", sports: ["football", "athletics"],
  category: "u18",
  lastNameKh: "សុខ", firstNameKh: "ពិសិដ្ឋ",
  lastNameEn: "SOK", firstNameEn: "PISETH",
  gender: "male", dob: "2007-05-14", phone: "012 345 678",
  nationality: "kh", idType: "birth", idNumber: "112233445",
  address: "ផ្ទះលេខ 352A, ផ្លូវ 271, សង្កាត់ទួលទំពូង, ខណ្ឌចំការមន, រាជធានីភ្នំពេញ",
  role: "athlete",
  photo: null, idDoc: null, birthDoc: null,
};

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}

function validate(step, form, lang) {
  const e = {};
  const req = (k) => { if (!form[k] || (typeof form[k] === "string" && !form[k].trim())) e[k] = t(STR.required_err, lang); };
  if (step === 0) {
    ["eventType", "event", "org"].forEach(req);
    if (!form.sports || form.sports.length === 0) e.sports = t(STR.pick_one, lang);
  } else if (step === 1) {
    if (!form.category) e.category = t(STR.pick_one, lang);
  } else if (step === 2) {
    ["lastNameKh", "firstNameKh", "lastNameEn", "firstNameEn", "gender", "dob",
     "phone", "nationality", "idType", "idNumber", "address", "role"].forEach(req);
  } else if (step === 3) {
    if (!form.photo) e.photo = t(STR.required_err, lang);
    if (!form.idDoc) e.idDoc = t(STR.required_err, lang);
  }
  return e;
}

function App() {
  const [lang, setLang] = useState(() => load("moeys.lang", "km"));
  const [step, setStep] = useState(() => load("moeys.step", 0));
  const [maxReached, setMaxReached] = useState(() => load("moeys.max", 0));
  const [form, setForm] = useState(() => load("moeys.form", DEFAULT_FORM));
  const [errors, setErrors] = useState({});
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refNo] = useState(() => "NG26-" + Math.floor(100000 + Math.random() * 899999));

  useEffect(() => { localStorage.setItem("moeys.lang", JSON.stringify(lang)); document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { localStorage.setItem("moeys.step", JSON.stringify(step)); }, [step]);
  useEffect(() => { localStorage.setItem("moeys.max", JSON.stringify(maxReached)); }, [maxReached]);
  useEffect(() => {
    const { photo, idDoc, birthDoc, ...persistable } = form;
    localStorage.setItem("moeys.form", JSON.stringify(persistable));
  }, [form]);

  const set = useCallback((patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((er) => {
      const next = { ...er };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  }, []);

  const scrollTop = () => {
    const c = document.querySelector(".content");
    if (c) c.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = () => {
    const e = validate(step, form, lang);
    if (Object.keys(e).length) { setErrors(e); return; }
    const ns = Math.min(step + 1, STEPS.length - 1);
    setStep(ns); setMaxReached((m) => Math.max(m, ns)); setErrors({}); scrollTop();
  };
  const goBack = () => { setStep((s) => Math.max(0, s - 1)); setErrors({}); scrollTop(); };
  const jump = (i) => { if (i <= maxReached) { setStep(i); setErrors({}); scrollTop(); } };

  const submit = () => { if (consent) { setSubmitted(true); scrollTop(); } };

  const resetAll = () => {
    setForm(DEFAULT_FORM); setStep(0); setMaxReached(0); setConsent(false); setSubmitted(false); setErrors({});
  };

  const Current = STEPS[step].render;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="app">
      {/* Rail */}
      <aside className="rail">
        <div className="rail__logo"><Icon name="Landmark" size={22} /></div>
        {RAIL.map((r, i) => (
          <button key={i} className={"rail__item" + (r.active ? " is-active" : "")}>
            <Icon name={r.icon} size={21} />
          </button>
        ))}
        <div className="rail__spacer" />
        <button className="rail__item"><Icon name="Settings" size={21} /></button>
        <div className="rail__avatar">S</div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <nav className="crumbs">
            <span className="crumbs__home"><Icon name="House" size={16} /><span>{t(STR.crumbHome, lang)}</span></span>
            <span className="crumbs__sep"><Icon name="ChevronRight" size={15} /></span>
            <span className="crumbs__current">{t(STR.crumbCurrent, lang)}</span>
          </nav>
          <div className="topbar__right">
            <div className="lang" role="group" aria-label="language">
              <button className={"lang__btn" + (lang === "km" ? " is-active" : "")} onClick={() => setLang("km")}>ខ្មែរ</button>
              <button className={"lang__btn" + (lang === "en" ? " is-active" : "")} onClick={() => setLang("en")}>EN</button>
            </div>
            <div className="user">
              <div className="user__av">S</div>
              <div className="user__meta">
                <span className="user__name">satpanha</span>
                <span className="user__role">{t(STR.userRole, lang)}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="content">
          {submitted ? (
            <Success lang={lang} refNo={refNo} onAgain={resetAll} />
          ) : (
            <div className="wrap">
              <div className="page-head">
                <div className="page-head__eyebrow"><Icon name="Sparkles" size={14} />{t(STR.pageEyebrow, lang)}</div>
                <h1>{t(STR.pageTitle, lang)}</h1>
                <p>{t(STR.pageSub, lang)}</p>
              </div>

              <Stepper steps={STEPS} current={step} maxReached={maxReached} onJump={jump} lang={lang} />

              <Current form={form} set={set} errors={errors} lang={lang} consent={consent} setConsent={setConsent} />

              <div className="footer-nav">
                <button className="btn btn--ghost" onClick={goBack} disabled={step === 0}>
                  <Icon name="ArrowLeft" size={18} />{t(STR.back, lang)}
                </button>
                {isLast ? (
                  <button className="btn btn--success btn--lg" onClick={submit} disabled={!consent}>
                    <Icon name="Send" size={18} />{t(STR.submit, lang)}
                  </button>
                ) : (
                  <button className="btn btn--primary" onClick={goNext}>
                    {t(STR.next, lang)}<Icon name="ArrowRight" size={18} />
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Success({ lang, refNo, onAgain }) {
  return (
    <div className="success-wrap">
      <div className="success-card">
        <div className="success-hero">
          <div className="success-hero__check"><Icon name="Check" size={40} stroke={3} /></div>
          <h2>{t(STR.suc_title, lang)}</h2>
          <p>{t(STR.suc_sub, lang)}</p>
        </div>
        <div className="success-body">
          <div className="success-ref">
            <div className="success-ref__k">{t(STR.suc_refK, lang)}</div>
            <div className="success-ref__v">{refNo}</div>
          </div>
          <div className="success-actions">
            <button className="btn btn--primary btn--lg" style={{ width: "100%", justifyContent: "center" }} onClick={onAgain}>
              <Icon name="UserPlus" size={18} />{t(STR.suc_register, lang)}
            </button>
            <button className="btn btn--ghost btn--lg" style={{ width: "100%", justifyContent: "center" }} onClick={onAgain}>
              <Icon name="House" size={18} />{t(STR.suc_home, lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
