import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { BookOpen, Code2, Search } from 'lucide-react';

type Article = { id: string; title: string; body: string };

const userArticles: Article[] = [
  {
    id: 'overview',
    title: "Tizim haqida",
    body: "Yoqilg'i sarfi — UPJT bo'yicha yoqilg'ining kunlik harakati, limit va faktini hisobga oluvchi monitoring tizimi. Asosiy maqsad: har bir texnika va bo'lim bo'yicha sarfni nazorat qilish, limitdan oshishni aniqlash, hisobotlarni avtomatlashtirish.",
  },
  {
    id: 'hierarchy',
    title: 'Iyerarxiya',
    body: "Yoqilg'i turi → Sex (Department) → Bo'lim (Subdivision) → Texnika (Vehicle). Sex jamlamasi — uning bo'limlari yig'indisi. Bo'lim jamlamasi — texnika kiritmalari yig'indisi.",
  },
  {
    id: 'day',
    title: 'Operativ kun (07:00–07:00)',
    body: "Hisobot kuni soat 07:00 dan keyingi kunning 07:00 gacha. Barcha kunlik kiritishlar shu davrga tegishli.",
  },
  {
    id: 'entries',
    title: 'Kunlik kiritish',
    body: "Har bir texnika uchun: boshlang'ich qoldiq, AYOQSHdan qabul, boshqalardan qabul, boshqalarga uzatildi, sarf (fakt), yakuniy qoldiq. Yakuniy qoldiq = boshlang'ich + qabul − uzatish − sarf.",
  },
  {
    id: 'limits',
    title: 'Limitlar',
    body: "Limit oylik tarzda Sex × Yoqilg'i turi (ixtiyoriy ravishda Bo'lim) bo'yicha kiritiladi. Kunlik limit = oylik / oydagi kunlar soni. Foiz = Fakt / Limit × 100.",
  },
  {
    id: 'dashboard',
    title: 'Boshqaruv paneli',
    body: "Bugungi va oylik fakt, limit, og'ish va foiz; sex/bo'lim/yoqilg'i turi kesimida diagrammalar; drill-down: Yoqilg'i → Sex → Bo'lim.",
  },
  {
    id: 'alerts',
    title: 'Ogohlantirishlar',
    body: "Limitning 80% yetganda — ogohlantirish; 100% dan oshganda — overlimit. Dashboardda alohida bloklar.",
  },
  {
    id: 'audit',
    title: 'Audit jurnali',
    body: "Barcha CREATE/UPDATE/DELETE amallari foydalanuvchi, vaqt va o'zgarishlar bilan saqlanadi. Admin/GSM/Operator ko'ra oladi.",
  },
  {
    id: 'roles',
    title: 'Rollar va ruxsatlar',
    body: "admin — to'liq boshqaruv. gsm — limitlar va yozuvlar. operator — yozuvlar va ma'lumotnomalar. master — faqat o'z sexining yozuvlari. management — faqat dashboard ko'rish.",
  },
];

const devArticles: Article[] = [
  {
    id: 'arch',
    title: 'Arxitektura',
    body: "Frontend: React + Vite + Tailwind CSS. Backend: FastAPI (Python) + SQLAlchemy. Ma'lumotlar bazasi: Supabase (PostgreSQL) + RLS. Auth: Supabase Auth.",
  },
  {
    id: 'schema',
    title: "Ma'lumotlar bazasi sxemasi",
    body: "Jadvallar: departments, sections, fuel_types, vehicles, profiles, user_roles, monthly_limits, daily_entries, audit_log, role_permissions. Enumlar: app_role, fuel_unit.",
  },
  {
    id: 'rls',
    title: 'RLS siyosati',
    body: "Barcha jadvallarda RLS yoqilgan. has_role() funksiyasi orqali rol tekshiruvi. Master roli faqat o'z sexining ma'lumotlarini ko'radi.",
  },
  {
    id: 'triggers',
    title: 'Triggerlar',
    body: "handle_new_user — yangi foydalanuvchi uchun profil yaratish. log_daily_entry_changes — daily_entries o'zgarishlarini audit_log'ga yozish. set_updated_at — updated_at maydonini avtomatik yangilash.",
  },
];

export function DocsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'user' | 'dev'>('user');
  const [search, setSearch] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const articles = tab === 'user' ? userArticles : devArticles;

  const filtered = useMemo(() => {
    if (!search) return articles;
    const q = search.toLowerCase();
    return articles.filter((a) => {
      const title = a.title.toLowerCase();
      const body = a.body.toLowerCase();
      return title.includes(q) || body.includes(q);
    });
  }, [articles, search]);

  const toggle = (id: string) => setOpenItems((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('docs')}</h1>

      <div className="inline-flex rounded-lg border border-border p-0.5">
        <button onClick={() => setTab('user')} className={`inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm transition-colors ${tab === 'user' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
          <BookOpen className="h-4 w-4" />{t('userGuide')}
        </button>
        <button onClick={() => setTab('dev')} className={`inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm transition-colors ${tab === 'dev' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
          <Code2 className="h-4 w-4" />{t('devGuide')}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((a) => {
          const isOpen = !!openItems[a.id];
          return (
            <div key={a.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <button
                onClick={() => toggle(a.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30"
              >
                <span className="font-medium text-foreground">{a.title}</span>
                <span className="text-muted-foreground">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                  {a.body}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">{t('noData')}</div>
        )}
      </div>
    </div>
  );
}
