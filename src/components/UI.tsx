import { ReactNode } from 'react'
import { IconPlus, IconSearch } from './Icons'

type PageHeaderProps = {
  title: string
  onCreate?: () => void
  createLabel?: string
  search: string
  onSearch: (v: string) => void
  searchPlaceholder?: string
}

export function PageHeader({ title, onCreate, createLabel, search, onSearch, searchPlaceholder }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
      <div className="flex items-center gap-2">
        <div className="relative">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder={searchPlaceholder || 'Qidirish...'}
            className="input pl-9 w-48 sm:w-64"
          />
        </div>
        {onCreate && (
          <button onClick={onCreate} className="btn-primary whitespace-nowrap">
            <IconPlus size={18} />
            {createLabel || 'Yangi qo\'shish'}
          </button>
        )}
      </div>
    </div>
  )
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-slate-400">
      {message}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-error-600">
      {message}
    </div>
  )
}

export function TableContainer({ children }: { children: ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          {children}
        </table>
      </div>
    </div>
  )
}

export function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-primary-50 text-slate-500 hover:text-primary-600 transition-colors" title="Tahrirlash">
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-error-50 text-slate-500 hover:text-error-600 transition-colors" title="O'chirish">
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message }: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-w-sm w-full bg-white rounded-xl shadow-xl p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Bekor qilish</button>
          <button onClick={onConfirm} className="btn-danger">O'chirish</button>
        </div>
      </div>
    </div>
  )
}

export function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
        type === 'success' ? 'bg-success-600 text-white' : 'bg-error-600 text-white'
      }`}>
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  )
}
