import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type AppRole = 'admin' | 'gsm' | 'operator' | 'master' | 'management';

export type FuelUnit = 'litr' | 'm3';

export interface Company {
  id: string;
  short_name: string;
  full_name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  department_id: string | null;
  company_id: string | null;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  name_uz: string;
  name_ru: string;
  is_total: boolean;
  company_id: string | null;
  created_at: string;
}

export interface Section {
  id: string;
  department_id: string;
  name: string;
  name_uz: string;
  name_ru: string;
  created_at: string;
}

export interface FuelType {
  id: string;
  code: string;
  name: string;
  name_uz: string;
  name_ru: string;
  unit: FuelUnit;
  created_at: string;
}

export interface Vehicle {
  id: string;
  code: string;
  name: string;
  name_uz: string;
  name_ru: string;
  department_id: string;
  fuel_type_id: string;
  created_at: string;
}

export interface MonthlyLimit {
  id: string;
  department_id: string;
  section_id: string | null;
  fuel_type_id: string;
  year: number;
  month: number;
  limit_value: number;
  created_at: string;
  updated_at: string;
}

export interface DailyEntry {
  id: string;
  entry_date: string;
  department_id: string;
  section_id: string | null;
  vehicle_id: string;
  fuel_type_id: string;
  opening_balance: number;
  received_azs: number;
  transfer_in: number;
  transfer_out: number;
  consumption: number;
  closing_balance: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  row_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role: AppRole;
  module: string;
  permission: string;
  allowed: boolean;
}

export interface DepartmentFuelMatrix {
  id: string;
  department_id: string;
  fuel_type_id: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** Fetch the fuel matrix and return a Set of "deptId|fuelId" keys that are enabled. */
export async function fetchEnabledFuelKeys(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('department_fuel_matrix')
    .select('department_id, fuel_type_id, enabled');
  if (error) throw error;
  const set = new Set<string>();
  for (const row of (data as Pick<DepartmentFuelMatrix, 'department_id' | 'fuel_type_id' | 'enabled'>[]) ?? []) {
    if (row.enabled) set.add(`${row.department_id}|${row.fuel_type_id}`);
  }
  return set;
}
