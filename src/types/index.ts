export interface Department {
  id: string
  code: string
  name: string
  name_uz: string
  name_ru: string
  is_total: boolean
  company_id: string
}

export interface FuelType {
  id: string
  code: string
  name: string
  name_uz: string
  name_ru: string
  unit: 'litr' | 'm3'
}

export interface Section {
  id: string
  name: string
  name_uz: string
  name_ru: string
  department_id: string
}

export interface DailyEntry {
  id: string
  entry_date: string
  department_id: string
  section_id: string | null
  vehicle_id: string | null
  fuel_type_id: string
  opening_balance: number
  received_azs: number
  transfer_in: number
  transfer_out: number
  consumption: number
  closing_balance: number
}

export interface MonthlyLimit {
  id: string
  department_id: string
  section_id: string | null
  fuel_type_id: string
  year: number
  month: number
  limit_value: number
}

export interface DateRange {
  startDate: string
  endDate: string
}

export interface PeriodData {
  limit: number
  norm: number
  excess: number
  percentage: number
}
