import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export type Company = {
  id: string
  short_name: string
  full_name: string
  created_at: string
}

export type Department = {
  id: string
  code: string
  name: string
  name_uz: string
  name_ru: string | null
  is_total: boolean
  created_at: string
  company_id: string | null
}

export type Section = {
  id: string
  department_id: string
  name: string
  name_uz: string
  name_ru: string | null
  created_at: string
}

export type FuelType = {
  id: string
  code: string
  name: string
  name_uz: string
  name_ru: string | null
  unit: string
  created_at: string
}

export type Vehicle = {
  id: string
  code: string
  name: string
  name_uz: string
  name_ru: string | null
  department_id: string
  fuel_type_id: string
  created_at: string
}

export type DailyEntry = {
  id: string
  entry_date: string
  department_id: string
  section_id: string | null
  vehicle_id: string
  fuel_type_id: string
  opening_balance: number
  received_azs: number
  transfer_in: number
  transfer_out: number
  consumption: number
  closing_balance: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export type MonthlyLimit = {
  id: string
  department_id: string
  section_id: string | null
  fuel_type_id: string
  year: number
  month: number
  limit_value: number
  created_at: string
  updated_at: string
}

export type DepartmentFuelMatrix = {
  id: string
  department_id: string
  fuel_type_id: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export type RolePermission = {
  id: string
  role: string
  module: string
  permission: string
  allowed: boolean
}

export type UserRole = {
  id: string
  user_id: string
  role: string
}

export type Profile = {
  id: string
  full_name: string | null
  email: string | null
  department_id: string | null
  created_at: string
  company_id: string | null
}

export type AppRole = 'admin' | 'gsm' | 'operator' | 'master' | 'management'
