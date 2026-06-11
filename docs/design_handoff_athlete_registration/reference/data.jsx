/* =====================================================================
   data.jsx — i18n strings + realistic Cambodian sports registration data
   Bilingual (km / en). Everything exported to window.
   ===================================================================== */

// ---- UI string dictionary -------------------------------------------------
const STR = {
  appName:        { km: "ក្រសួងអប់រំ យុវជន និងកីឡា", en: "Ministry of Education, Youth & Sport" },
  crumbHome:      { km: "ផ្ទះគ្រប់គ្រង", en: "Dashboard" },
  crumbCurrent:   { km: "ការចុះឈ្មោះអត្តពលិក", en: "Athlete Registration" },
  userRole:       { km: "អ្នកគ្រប់គ្រង", en: "Administrator" },

  pageEyebrow:    { km: "បើកការចុះឈ្មោះ ២០២៦", en: "Registration open · 2026" },
  pageTitle:      { km: "ការចុះឈ្មោះព្រឹត្តិការណ៍កីឡា", en: "Sports Event Registration" },
  pageSub:        { km: "បំពេញ ៥ ជំហានដើម្បីចុះឈ្មោះសម្រាប់ព្រឹត្តិការណ៍កីឡា", en: "Complete 5 steps to register for the sports event" },

  // steps
  step1:          { km: "ព្រឹត្តិការណ៍ និងកីឡា", en: "Event & Sports" },
  step2:          { km: "ប្រភេទប្រកួត", en: "Category" },
  step3:          { km: "ព័ត៌មានផ្ទាល់ខ្លួន", en: "Personal Info" },
  step4:          { km: "ឯកសារភ្ជាប់", en: "Documents" },
  step5:          { km: "ត្រួតពិនិត្យ", en: "Review" },

  // step 1
  s1_title:       { km: "ព្រឹត្តិការណ៍ និងកីឡា", en: "Event & Sports" },
  s1_sub:         { km: "ជ្រើសរើសព្រឹត្តិការណ៍ និងប្រភេទកីឡាដែលអ្នកចង់ចូលរួម", en: "Choose the event and the sports you want to take part in" },
  f_eventType:    { km: "ប្រភេទព្រឹត្តិការណ៍", en: "Event type" },
  f_event:        { km: "ព្រឹត្តិការណ៍", en: "Event" },
  f_org:          { km: "អង្គភាព / តំណាង", en: "Organization / Delegation" },
  f_sport:        { km: "ប្រភេទកីឡា", en: "Sports" },
  sport_hint:     { km: "ជ្រើសរើសបានច្រើន — ចុចលើកាតកីឡា", en: "Select one or more — tap a sport card" },
  sport_search:   { km: "ស្វែងរកកីឡា...", en: "Search sports..." },
  sport_selected: { km: "បានជ្រើស", en: "selected" },
  sport_of:       { km: "ក្នុងចំណោម", en: "of" },

  // step 2
  s2_title:       { km: "ប្រភេទប្រកួត", en: "Competition Category" },
  s2_sub:         { km: "ជ្រើសរើសប្រភេទអាយុ ឬកម្រិតប្រកួត", en: "Select the age group or competition level" },
  f_category:     { km: "ប្រភេទប្រកួត", en: "Category" },

  // step 3
  s3_title:       { km: "ព័ត៌មានផ្ទាល់ខ្លួន", en: "Personal Information" },
  s3_sub:         { km: "បំពេញព័ត៌មានឱ្យបានត្រឹមត្រូវ ដូចក្នុងឯកសារផ្លូវការ", en: "Fill in accurately, matching your official documents" },
  grp_nameKh:     { km: "ឈ្មោះពេញ (ខ្មែរ)", en: "Full name (Khmer)" },
  grp_nameEn:     { km: "ឈ្មោះពេញ (ឡាតាំង)", en: "Full name (Latin)" },
  f_lastName:     { km: "នាមត្រកូល", en: "Last name" },
  f_firstName:    { km: "នាមខ្លួន", en: "First name" },
  f_gender:       { km: "ភេទ", en: "Gender" },
  f_dob:          { km: "ថ្ងៃខែឆ្នាំកំណើត", en: "Date of birth" },
  f_phone:        { km: "លេខទូរស័ព្ទ", en: "Phone number" },
  f_nationality:  { km: "សញ្ជាតិ", en: "Nationality" },
  f_idType:       { km: "ប្រភេទឯកសារសម្គាល់ខ្លួន", en: "Identity document type" },
  f_idNumber:     { km: "លេខឯកសារសម្គាល់ខ្លួន", en: "Identity document number" },
  f_address:      { km: "អាសយដ្ឋានបច្ចុប្បន្ន", en: "Current address" },
  f_role:         { km: "តួនាទីក្នុងក្រុម", en: "Role in the team" },
  grp_identity:   { km: "អត្តសញ្ញាណ និងទំនាក់ទំនង", en: "Identity & contact" },

  // step 4
  s4_title:       { km: "ឯកសារភ្ជាប់", en: "Supporting Documents" },
  s4_sub:         { km: "បង្ហោះរូបថត និងឯកសារសម្គាល់ខ្លួនឱ្យបានច្បាស់", en: "Upload a clear photo and identity documents" },
  up_photo:       { km: "រូបថតប្រវត្តិរូប", en: "Profile photo" },
  up_photo_sub:   { km: "មុខត្រង់ ផ្ទៃខាងក្រោយធម្មតា · អតិបរមា ២MB", en: "Front-facing, plain background · Max 2MB" },
  up_id:          { km: "ឯកសារសម្គាល់ខ្លួន", en: "Identity document" },
  up_birth:       { km: "សំបុត្រកំណើត", en: "Birth certificate" },
  up_browse:      { km: "ជ្រើសរើសឯកសារ", en: "Browse file" },
  up_drop:        { km: "ចុច ឬអូសឯកសារមកដាក់ទីនេះ", en: "Click or drag & drop your file here" },
  up_fmt:         { km: "JPG, PNG, WebP · អតិបរមា 5MB", en: "JPG, PNG, WebP · Max 5MB" },
  up_done:        { km: "បង្ហោះបានជោគជ័យ", en: "Uploaded successfully" },

  // step 5
  s5_title:       { km: "ត្រួតពិនិត្យ និងបញ្ជាក់", en: "Review & Confirm" },
  s5_sub:         { km: "សូមពិនិត្យព័ត៌មានម្ដងទៀតមុនពេលដាក់ស្នើ", en: "Please check your information once more before submitting" },
  rev_event:      { km: "ព័ត៌មានព្រឹត្តិការណ៍", en: "Event details" },
  rev_personal:   { km: "ព័ត៌មានផ្ទាល់ខ្លួន", en: "Personal details" },
  rev_docs:       { km: "ឯកសារភ្ជាប់", en: "Documents" },
  notice_title:   { km: "ព័ត៌មានរបស់អ្នកត្រូវបានរក្សាការសម្ងាត់", en: "Your information is kept confidential" },
  notice_text:    { km: "ទិន្នន័យត្រូវបានគ្រប់គ្រងដោយ ក្រសួងអប់រំ យុវជន និងកីឡា ស្របតាមច្បាប់ការពារទិន្នន័យ", en: "Data is managed by MoEYS in line with data-protection regulations" },
  consent_text:   { km: "ខ្ញុំបញ្ជាក់ថា ព័ត៌មានខាងលើពិតជាត្រឹមត្រូវ និងយល់ព្រមតាមលក្ខខណ្ឌចុះឈ្មោះ", en: "I confirm the above information is correct and agree to the registration terms" },

  // nav
  back:           { km: "ត្រឡប់ក្រោយ", en: "Back" },
  next:           { km: "បន្ទាប់", en: "Next" },
  submit:         { km: "ដាក់ស្នើការចុះឈ្មោះ", en: "Submit registration" },

  // success
  suc_title:      { km: "ការចុះឈ្មោះបានជោគជ័យ!", en: "Registration successful!" },
  suc_sub:        { km: "ពាក្យសុំរបស់អ្នកត្រូវបានទទួល និងកំពុងរង់ចាំការផ្ទៀងផ្ទាត់", en: "Your application has been received and is awaiting verification" },
  suc_refK:       { km: "លេខយោងពាក្យសុំ", en: "Application reference" },
  suc_register:   { km: "ចុះឈ្មោះអ្នកចូលរួមម្នាក់ទៀត", en: "Register another participant" },
  suc_home:       { km: "ត្រឡប់ទៅផ្ទះគ្រប់គ្រង", en: "Back to dashboard" },

  required_err:   { km: "តម្រូវឱ្យបំពេញ", en: "This field is required" },
  pick_one:       { km: "សូមជ្រើសរើស", en: "Please select" },
  optional:       { km: "ស្រេចចិត្ត", en: "optional" },
};

// helper: t(STR.key, lang)
function t(entry, lang) {
  if (!entry) return "";
  return entry[lang] || entry.km || "";
}

// ---- Domain data ----------------------------------------------------------
const EVENT_TYPES = [
  { id: "national", icon: "Trophy",   km: "កីឡាជាតិ", en: "National Sports", subKm: "ប្រកួតថ្នាក់ជាតិ", subEn: "National-level competition" },
  { id: "school",   icon: "GraduationCap", km: "កីឡាសិក្សា", en: "School Sports", subKm: "សិស្ស និស្សិត", subEn: "Students" },
  { id: "youth",    icon: "Users",    km: "កីឡាយុវជន", en: "Youth Games", subKm: "យុវជនទូទាំងប្រទេស", subEn: "Nationwide youth" },
  { id: "forall",   icon: "HeartHandshake", km: "កីឡាសម្រាប់ទាំងអស់គ្នា", en: "Sports for All", subKm: "សហគមន៍", subEn: "Community" },
];

const EVENTS = [
  { id: "ng2026",  icon: "Medal",  km: "ការប្រកួតកីឡាជាតិ ២០២៦", en: "National Games 2026", subKm: "ភ្នំពេញ · មីនា ២០២៦", subEn: "Phnom Penh · Mar 2026" },
  { id: "sea33",   icon: "Globe",  km: "រៀបចំ SEA Games", en: "SEA Games Prep", subKm: "ក្រុមជម្រើសជាតិ", subEn: "National selection" },
  { id: "prov26",  icon: "Flag",   km: "ប្រកួតថ្នាក់ខេត្ត ២០២៦", en: "Provincial Championship 2026", subKm: "គ្រប់ខេត្ត/ក្រុង", subEn: "All provinces" },
];

const ORGS = [
  { id: "pp",  icon: "Building2", km: "រាជធានីភ្នំពេញ", en: "Phnom Penh Capital" },
  { id: "sr",  icon: "Building2", km: "ខេត្តសៀមរាប", en: "Siem Reap" },
  { id: "bb",  icon: "Building2", km: "ខេត្តបាត់ដំបង", en: "Battambang" },
  { id: "kpc", icon: "Building2", km: "ខេត្តកំពង់ចាម", en: "Kampong Cham" },
  { id: "kep", icon: "Building2", km: "ខេត្តកំពត", en: "Kampot" },
  { id: "sihanouk", icon: "Building2", km: "ខេត្តព្រះសីហនុ", en: "Preah Sihanouk" },
  { id: "bl",  icon: "Building2", km: "ក្លឹបបឹងលិច", en: "Boeung Lich Club" },
];

const SPORTS = [
  { id: "football",  icon: "Goal",       km: "បាល់ទាត់",        en: "Football" },
  { id: "volleyball",icon: "Volleyball", km: "បាល់ទះ",         en: "Volleyball" },
  { id: "basketball",icon: "Dribbble",   km: "បាល់បោះ",        en: "Basketball" },
  { id: "athletics", icon: "Footprints", km: "អត្តពលកម្ម",      en: "Athletics" },
  { id: "swimming",  icon: "Waves",      km: "ហែលទឹក",         en: "Swimming" },
  { id: "cycling",   icon: "Bike",       km: "ជិះកង់",          en: "Cycling" },
  { id: "weightlift",icon: "Dumbbell",   km: "លើកទម្ងន់",       en: "Weightlifting" },
  { id: "taekwondo", icon: "Swords",     km: "តេក្វាន់ដូ",      en: "Taekwondo" },
  { id: "boxing",    icon: "Hand",       km: "ប្រដាល់",         en: "Boxing" },
  { id: "badminton", icon: "Activity",   km: "កីឡាវាយសី",       en: "Badminton" },
  { id: "tabletennis",icon: "Disc",      km: "តេនីសតុ",         en: "Table Tennis" },
  { id: "petanque",  icon: "Target",     km: "ប៉េតង់",          en: "Petanque" },
];

const CATEGORIES = [
  { id: "u16",    icon: "Baby",   km: "ក្រោម ១៦ ឆ្នាំ", en: "Under 16", subKm: "កើតក្រោយ ២០១០", subEn: "Born after 2010" },
  { id: "u18",    icon: "User",   km: "ក្រោម ១៨ ឆ្នាំ", en: "Under 18", subKm: "កើតក្រោយ ២០០៨", subEn: "Born after 2008" },
  { id: "u21",    icon: "Users",  km: "ក្រោម ២១ ឆ្នាំ", en: "Under 21", subKm: "កើតក្រោយ ២០០៥", subEn: "Born after 2005" },
  { id: "senior", icon: "Trophy", km: "មនុស្សពេញវ័យ", en: "Senior / Open", subKm: "គ្មានកំណត់អាយុ", subEn: "No age limit" },
];

const GENDERS = [
  { id: "male",   icon: "User",  km: "ប្រុស", en: "Male" },
  { id: "female", icon: "User",  km: "ស្រី", en: "Female" },
];

const ID_TYPES = [
  { id: "natid",    icon: "Contact",      km: "អត្តសញ្ញាណប័ណ្ណ", en: "National ID" },
  { id: "birth",    icon: "FileText",    km: "សំបុត្រកំណើត",    en: "Birth Certificate" },
  { id: "passport", icon: "BookUser",    km: "លិខិតឆ្លងដែន",   en: "Passport" },
  { id: "family",   icon: "Users",       km: "សៀវភៅគ្រួសារ",   en: "Family Book" },
];

const ROLES = [
  { id: "athlete", icon: "Medal",      km: "អត្តពលិក",   en: "Athlete" },
  { id: "coach",   icon: "Megaphone",    km: "គ្រូបង្វឹក",  en: "Coach" },
  { id: "official",icon: "ClipboardCheck", km: "មន្ត្រី", en: "Official" },
  { id: "manager", icon: "Briefcase",  km: "អ្នកគ្រប់គ្រងក្រុម", en: "Team Manager" },
];

const NATIONALITIES = [
  { id: "kh", icon: "Flag", km: "ខ្មែរ", en: "Cambodian" },
  { id: "th", icon: "Flag", km: "ថៃ", en: "Thai" },
  { id: "vn", icon: "Flag", km: "វៀតណាម", en: "Vietnamese" },
  { id: "other", icon: "Globe", km: "ផ្សេងៗ", en: "Other" },
];

Object.assign(window, {
  STR, t,
  EVENT_TYPES, EVENTS, ORGS, SPORTS, CATEGORIES,
  GENDERS, ID_TYPES, ROLES, NATIONALITIES,
});
