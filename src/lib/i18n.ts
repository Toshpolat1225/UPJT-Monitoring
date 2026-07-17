export type TranslationKey = keyof typeof translations;

export const translations = {
  // App
  appName: 'Yoqilg\'i Monitoringi',
  appSubtitle: 'Yonilg\'i sarfini nazorat qilish tizimi',

  // Auth
  login: 'Tizimga kirish',
  email: 'Email',
  password: 'Parol',
  passwordConfirm: 'Parolni tasdiqlang',
  passwordTooShort: 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak',
  passwordMismatch: 'Parollar mos kelmaydi',
  signIn: 'Kirish',
  signOut: 'Chiqish',
  loginError: 'Email yoki parol noto\'g\'ri',
  fillAllFields: 'Barcha majburiy maydonlarni to\'ldiring',
  selectDept: 'Sexni tanlang',
  selectCompany: 'Kompaniyani tanlang',
  selectRole: 'Rolni tanlang',
  creating: 'Yaratilmoqda...',
  userCreated: 'Foydalanuvchi yaratildi',
  userCreateFailed: 'Foydalanuvchi yaratishda xatolik',

  // Nav
  dashboard: 'Boshqaruv paneli',
  dailyEntries: 'Kunlik yozuvlar',
  monthlyLimits: 'Oylik limitlar',
  departments: 'Sexlar',
  sections: 'Bo\'limlar',
  fuelTypes: 'Yoqilg\'i turlari',
  vehicles: 'Transport vositalari',
  companies: 'Kompaniyalar',
  users: 'Foydalanuvchilar',
  auditLog: 'Audit jurnali',
  rolePermissions: 'Rol huquqlari',
  masterData: 'Ma\'lumotlar bazasi',
  settings: 'Sozlamalar',

  // Common
  save: 'Saqlash',
  cancel: 'Bekor qilish',
  delete: 'O\'chirish',
  edit: 'Tahrirlash',
  create: 'Yaratish',
  add: 'Qo\'shish',
  search: 'Qidirish',
  filter: 'Filtr',
  actions: 'Amallar',
  confirm: 'Tasdiqlang',
  confirmDelete: 'O\'chirishni tasdiqlaysizmi?',
  noData: 'Ma\'lumot topilmadi',
  loading: 'Yuklanmoqda...',
  saved: 'Saqlandi',
  deleted: 'O\'chirildi',
  error: 'Xatolik',
  close: 'Yopish',
  all: 'Hammasi',
  none: 'Hech biri',
  yes: 'Ha',
  no: 'Yo\'q',
  name: 'Nomi',
  code: 'Kod',
  fullName: 'To\'liq ism',
  role: 'Rol',
  roles: 'Rollar',
  date: 'Sana',
  year: 'Yil',
  month: 'Oy',
  value: 'Qiymat',
  enabled: 'Faol',
  disabled: 'Faol emas',
  active: 'Faol',
  inactive: 'Nofaol',
  status: 'Holat',
  total: 'Jami',
  select: 'Tanlang',
  required: 'Majburiy',

  // Dashboard
  totalDepartments: 'Jami sexlar',
  totalVehicles: 'Jami transport vositalari',
  totalUsers: 'Jami foydalanuvchilar',
  todayEntries: 'Bugungi yozuvlar',
  monthlyConsumption: 'Oylik sarf',
  consumptionByDepartment: 'Sexlar bo\'yicha sarf',
  consumptionByFuelType: 'Yoqilg\'i turi bo\'yicha sarf',
  recentEntries: 'So\'nggi yozuvlar',
  limitUsage: 'Limitdan foydalanish',

  // Daily entries
  entryDate: 'Yozuv sanasi',
  department: 'Sex',
  section: 'Bo\'lim',
  vehicle: 'Transport vositasi',
  fuelType: 'Yoqilg\'i turi',
  openingBalance: 'Boshlang\'ich qoldiq',
  receivedAzs: 'Qabul qilingan AZS',
  transferIn: 'Kirim o\'tkazma',
  transferOut: 'Chiqim o\'tkazma',
  consumption: 'Sarf',
  closingBalance: 'Yakuniy qoldiq',
  unit: 'O\'lchov birligi',
  litr: 'Litr',
  m3: 'm³',

  // Monthly limits
  limitValue: 'Limit qiymati',
  fuelLimit: 'Yoqilg\'i limiti',
  monthlyLimit: 'Oylik limit',
  setLimit: 'Limit belgilash',
  limitExceeded: 'Limitdan oshdi',
  limitRemaining: 'Limit qoldi',
  limitUsed: 'Limit sarflandi',

  // Departments
  departmentName: 'Sex nomi',
  isTotal: 'Umumiy',
  company: 'Kompaniya',
  companyName: 'Kompaniya nomi',
  shortName: 'Qisqa nom',
  fullNameLabel: 'To\'liq nom',

  // Sections
  sectionName: 'Bo\'lim nomi',
  parentDepartment: 'Yuqori sex',

  // Fuel types
  fuelTypeName: 'Yoqilg\'i nomi',

  // Vehicles
  vehicleName: 'Transport vositasi nomi',
  vehicleCode: 'Transport kodi',

  // Users
  newUser: 'Yangi foydalanuvchi',
  editUser: 'Foydalanuvchini tahrirlash',
  userRoles: 'Foydalanuvchi rollari',
  noPermission: 'Ruxsat yo\'q',
  admin: 'Admin',
  gsm: 'GSM',
  operator: 'Operator',
  master: 'Master',
  management: 'Boshqaruv',

  // Audit
  action: 'Amal',
  tableName: 'Jadval nomi',
  rowId: 'Qator ID',
  details: 'Tafsilotlar',
  timestamp: 'Vaqt',
  user: 'Foydalanuvchi',

  // Role permissions
  module: 'Modul',
  permission: 'Huquq',
  allowed: 'Ruxsat berilgan',
  view: 'Ko\'rish',
  createPerm: 'Yaratish',
  editPerm: 'Tahrirlash',
  deletePerm: 'O\'chirish',
  entries: 'Yozuvlar',
  limits: 'Limitlar',
  masterDataModule: 'Ma\'lumotlar bazasi',
  usersModule: 'Foydalanuvchilar',
  auditModule: 'Audit',

  // Matrix
  fuelMatrix: 'Yoqilg\'i matritsasi',
  matrixEnabled: 'Matritsa faol',
} as const;

export function t(key: TranslationKey): string {
  return translations[key] ?? key;
}
