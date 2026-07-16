import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'uz' | 'ru';

const dict = {
  appName: { uz: "Yoqilg'i sarfi", ru: "Yoqilg'i sarfi" },
  dashboard: { uz: "Boshqaruv paneli", ru: "Boshqaruv paneli" },
  entries: { uz: "Kunlik kiritish", ru: "Kunlik kiritish" },
  limits: { uz: "Limitlar", ru: "Limitlar" },
  masterData: { uz: "Ma'lumotnomalar", ru: "Ma'lumotnomalar" },
  users: { uz: "Foydalanuvchilar", ru: "Foydalanuvchilar" },
  permissions: { uz: "Ruxsatlar", ru: "Ruxsatlar" },
  audit: { uz: "Audit jurnali", ru: "Audit jurnali" },
  signIn: { uz: "Kirish", ru: "Kirish" },
  signOut: { uz: "Chiqish", ru: "Chiqish" },
  email: { uz: "Email", ru: "Email" },
  password: { uz: "Parol", ru: "Parol" },
  fullName: { uz: "To'liq ism", ru: "To'liq ism" },
  loading: { uz: "Yuklanmoqda...", ru: "Yuklanmoqda..." },
  save: { uz: "Saqlash", ru: "Saqlash" },
  cancel: { uz: "Bekor qilish", ru: "Bekor qilish" },
  add: { uz: "Qo'shish", ru: "Qo'shish" },
  edit: { uz: "Tahrirlash", ru: "Tahrirlash" },
  delete: { uz: "O'chirish", ru: "O'chirish" },
  create: { uz: "Yaratish", ru: "Yaratish" },
  view: { uz: "Ko'rish", ru: "Ko'rish" },
  module: { uz: "Modul", ru: "Modul" },
  department: { uz: "Sex", ru: "Sex" },
  section: { uz: "Bo'lim", ru: "Bo'lim" },
  vehicle: { uz: "Texnika", ru: "Texnika" },
  fuelType: { uz: "Yoqilg'i turi", ru: "Yoqilg'i turi" },
  unit: { uz: "Birlik", ru: "Birlik" },
  date: { uz: "Sana", ru: "Sana" },
  opening: { uz: "Boshlang'ich qoldiq", ru: "Boshlang'ich qoldiq" },
  receivedAzs: { uz: "AYOQSHdan qabul", ru: "AYOQSHdan qabul" },
  transferIn: { uz: "Boshqalardan qabul", ru: "Boshqalardan qabul" },
  transferOut: { uz: "Boshqalarga uzatildi", ru: "Boshqalarga uzatildi" },
  consumption: { uz: "Sarf (Fakt)", ru: "Sarf (Fakt)" },
  closing: { uz: "Yakuniy qoldiq", ru: "Yakuniy qoldiq" },
  limit: { uz: "Limit", ru: "Limit" },
  fact: { uz: "Amalda", ru: "Amalda" },
  deviation: { uz: "Og'ish", ru: "Og'ish" },
  percent: { uz: "Foiz", ru: "Foiz" },
  year: { uz: "Yil", ru: "Yil" },
  month: { uz: "Oy", ru: "Oy" },
  total: { uz: "Jami", ru: "Jami" },
  byDepartment: { uz: "Sexlar bo'yicha", ru: "Sexlar bo'yicha" },
  bySection: { uz: "Bo'limlar bo'yicha", ru: "Bo'limlar bo'yicha" },
  byFuelType: { uz: "Yoqilg'i turlari bo'yicha", ru: "Yoqilg'i turlari bo'yicha" },
  dailyTrend: { uz: "Kunlik dinamika", ru: "Kunlik dinamika" },
  limitVsFact: { uz: "Limit va Fakt", ru: "Limit va Fakt" },
  alerts: { uz: "Ogohlantirishlar", ru: "Ogohlantirishlar" },
  overLimit: { uz: "Limitdan oshib ketdi", ru: "Limitdan oshib ketdi" },
  near80: { uz: "Limitning 80% dan oshdi", ru: "Limitning 80% dan oshdi" },
  noAlerts: { uz: "Ogohlantirishlar yo'q", ru: "Ogohlantirishlar yo'q" },
  role: { uz: "Rol", ru: "Rol" },
  name: { uz: "Nomi", ru: "Nomi" },
  nameUz: { uz: "Nomi (UZ)", ru: "Nomi (UZ)" },
  nameRu: { uz: "Nomi (RU)", ru: "Nomi (RU)" },
  code: { uz: "Kod", ru: "Kod" },
  actions: { uz: "Amallar", ru: "Amallar" },
  filter: { uz: "Filtr", ru: "Filtr" },
  all: { uz: "Hammasi", ru: "Hammasi" },
  noData: { uz: "Ma'lumot yo'q", ru: "Ma'lumot yo'q" },
  saved: { uz: "Saqlandi", ru: "Saqlandi" },
  economy: { uz: "Tejalgan", ru: "Экономия" },
  error: { uz: "Xato", ru: "Xato" },
  reportingPeriod: { uz: "Hisobot davri: kecha 07:00 – bugun 07:00", ru: "Hisobot davri: kecha 07:00 – bugun 07:00" },
  yesterday: { uz: "Kecha", ru: "Kecha" },
  deptTotals: { uz: "Bo'limlar bo'yicha jami", ru: "Bo'limlar bo'yicha jami" },
  newEntry: { uz: "Yangi yozuv", ru: "Yangi yozuv" },
  monthlyLimit: { uz: "Oylik limit", ru: "Oylik limit" },
  noPermission: { uz: "Ruxsat yo'q", ru: "Ruxsat yo'q" },
  welcome: { uz: "Xush kelibsiz", ru: "Xush kelibsiz" },
  subtitle: { uz: "Operativ yoqilg'i va transport monitoringi", ru: "Operativ yoqilg'i va transport monitoringi" },
  goToDashboard: { uz: "Panelga o'tish", ru: "Panelga o'tish" },
  newUser: { uz: "Yangi foydalanuvchi", ru: "Yangi foydalanuvchi" },
  confirmDelete: { uz: "O'chirishni tasdiqlaysizmi?", ru: "O'chirishni tasdiqlaysizmi?" },
  selectDepartmentFirst: { uz: "Avval sexni tanlang", ru: "Avval sexni tanlang" },
  selectSectionRequired: { uz: "Bo'lim majburiy", ru: "Bo'lim majburiy" },
  noSectionsForDept: { uz: "Bu sexda bo'limlar yo'q", ru: "Bu sexda bo'limlar yo'q" },
  search: { uz: "Qidirish", ru: "Qidirish" },
  user: { uz: "Foydalanuvchi", ru: "Foydalanuvchi" },
  action: { uz: "Amal", ru: "Amal" },
  details: { uz: "Tafsilotlar", ru: "Tafsilotlar" },
  from: { uz: "Dan", ru: "Dan" },
  to: { uz: "Gacha", ru: "Gacha" },
  reset: { uz: "Tozalash", ru: "Tozalash" },
  page: { uz: "Sahifa", ru: "Sahifa" },
  prev: { uz: "Oldingi", ru: "Oldingi" },
  next: { uz: "Keyingi", ru: "Keyingi" },
  changes: { uz: "O'zgarishlar", ru: "O'zgarishlar" },
  field: { uz: "Maydon", ru: "Maydon" },
  oldValue: { uz: "Eski qiymat", ru: "Eski qiymat" },
  newValue: { uz: "Yangi qiymat", ru: "Yangi qiymat" },
  today: { uz: "Bugun", ru: "Bugun" },
  monthToDate: { uz: "Oy boshidan", ru: "Oy boshidan" },
  dailyLimit: { uz: "Kunlik limit", ru: "Kunlik limit" },
  dailyFact: { uz: "Kunlik fakt", ru: "Kunlik fakt" },
  monthlyFact: { uz: "Oylik fakt", ru: "Oylik fakt" },
  mtdLimit: { uz: "Oy boshidan limit", ru: "Oy boshidan limit" },
  mtdFact: { uz: "Oy boshidan fakt", ru: "Oy boshidan fakt" },
  docs: { uz: "Qo'llanma", ru: "Qo'llanma" },
  userGuide: { uz: "Foydalanuvchi qo'llanmasi", ru: "Foydalanuvchi qo'llanmasi" },
  devGuide: { uz: "Dasturchi qo'llanmasi", ru: "Dasturchi qo'llanmasi" },
  exportExcel: { uz: "Excelga eksport", ru: "Excelga eksport" },
  companies: { uz: "Kompaniyalar", ru: "Kompaniyalar" },
  company: { uz: "Kompaniya", ru: "Kompaniya" },
  shortName: { uz: "Qisqa nom", ru: "Qisqa nom" },
  fullName: { uz: "To'liq nom", ru: "To'liq nom" },
  dateFrom: { uz: "Sana (dan)", ru: "Sana (dan)" },
  dateTo: { uz: "Sana (gacha)", ru: "Sana (gacha)" },
  selectCompany: { uz: "Kompaniya tanlang", ru: "Kompaniya tanlang" },
  noCompany: { uz: "Kompaniya biriktirilmagan", ru: "Kompaniya biriktirilmagan" },
  fuelMatrix: { uz: "Yoqilg'i matritsasi", ru: "Матрица топлива" },
  fuelMatrixHint: { uz: "Sex uchun ruxsat etilgan yoqilg'i turlarini sozlang", ru: "Настройте разрешённые виды топлива для цехов" },
  allowed: { uz: "Ruxsat berilgan", ru: "Разрешён" },
} as const;

export type DictKey = keyof typeof dict;

const Ctx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: DictKey) => string;
  ln: (row: { name_uz?: string | null; name_ru?: string | null; name?: string | null } | null | undefined) => string;
}>({
  lang: 'uz',
  setLang: () => {},
  t: (k) => k,
  ln: () => '',
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('uz');

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem('lang')) as Lang | null;
    if (saved === 'uz' || saved === 'ru') setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== 'undefined') localStorage.setItem('lang', l);
  };

  const t = (k: DictKey) => dict[k]?.[lang] ?? k;
  const ln = (row: { name_uz?: string | null; name_ru?: string | null; name?: string | null } | null | undefined) => {
    if (!row) return '—';
    if (lang === 'uz') return row.name_uz || row.name || row.name_ru || '—';
    return row.name_ru || row.name || row.name_uz || '—';
  };

  return <Ctx.Provider value={{ lang, setLang, t, ln }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

export function formatUnit(unit: string | null | undefined, _lang: Lang): string {
  if (!unit) return '';
  if (unit === 'm3') return 'm\u00b3';
  if (unit === 'litr') return 'l';
  return unit;
}
