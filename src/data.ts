export interface FuelRecord {
  id: number
  sex: string
  fuelType: string
  carNumber: string
  driver: string
  date: string
  volume: number
  unit: string
  cost: number
  currency: string
  station: string
  status: 'Berilgan' | 'Kutilmoqda' | 'Bekor qilingan'
}

export const fuelRecords: FuelRecord[] = [
  { id: 1, sex: '1', fuelType: 'AI-80', carNumber: '01A123BC', driver: 'Akmal Karimov', date: '2024-01-15', volume: 45, unit: 'litr', cost: 56000, currency: 'UZS', station: 'O\'zbekneftgaz #14', status: 'Berilgan' },
  { id: 2, sex: '2', fuelType: 'AI-80', carNumber: '02B456DE', driver: 'Sardor Rahimov', date: '2024-01-16', volume: 50, unit: 'litr', cost: 62000, currency: 'UZS', station: 'O\'zbekneftgaz #14', status: 'Berilgan' },
  { id: 3, sex: '3', fuelType: 'Dizel', carNumber: '03C789EF', driver: 'Jasur Aliyev', date: '2024-01-16', volume: 80, unit: 'litr', cost: 96000, currency: 'UZS', station: 'O\'zbekneftgaz #22', status: 'Kutilmoqda' },
  { id: 4, sex: '4', fuelType: 'AI-80', carNumber: '04D012GH', driver: 'Bekzod Yusupov', date: '2024-01-17', volume: 40, unit: 'litr', cost: 49600, currency: 'UZS', station: 'O\'zbekneftgaz #14', status: 'Berilgan' },
  { id: 5, sex: '5', fuelType: 'Dizel', carNumber: '05E345IJ', driver: 'Otabek Tursunov', date: '2024-01-17', volume: 75, unit: 'litr', cost: 90000, currency: 'UZS', station: 'O\'zbekneftgaz #22', status: 'Bekor qilingan' },
  { id: 6, sex: '6', fuelType: 'AI-80', carNumber: '06F678KL', driver: 'Davron Saidov', date: '2024-01-18', volume: 55, unit: 'litr', cost: 68200, currency: 'UZS', station: 'O\'zbekneftgaz #14', status: 'Berilgan' },
  { id: 7, sex: '7', fuelType: 'Dizel', carNumber: '07G901MN', driver: 'Rustam Xolmatov', date: '2024-01-18', volume: 90, unit: 'litr', cost: 108000, currency: 'UZS', station: 'O\'zbekneftgaz #22', status: 'Kutilmoqda' },
  { id: 8, sex: '8', fuelType: 'AI-80', carNumber: '08H234OP', driver: 'Aziz Qodirov', date: '2024-01-19', volume: 48, unit: 'litr', cost: 59520, currency: 'UZS', station: 'O\'zbekneftgaz #14', status: 'Berilgan' },
]
