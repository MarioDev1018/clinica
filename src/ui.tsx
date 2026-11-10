import { useEffect, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-lg border border-line bg-white p-5', className)}>{children}</div>
}
export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-[14px] font-semibold">{children}</h3>
      {action}
    </div>
  )
}
export function Btn({ variant = 'primary', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return (
    <button
      {...p}
      className={cx(
        'rounded-md px-4 py-2 text-[12.5px] font-medium transition-colors',
        variant === 'primary' && 'bg-brand text-white hover:bg-brand-dark',
        variant === 'ghost' && 'border border-line bg-white text-ink hover:bg-canvas',
        variant === 'danger' && 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
        className,
      )}
    />
  )
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded-full border border-ink/60 bg-white px-2.5 py-0.5 text-[11px]">{children}</span>
}
export function Note({ children }: { children: ReactNode }) {
  return <div className="mt-3 rounded border border-dashed border-amber-400 bg-note px-3 py-2 text-[11.5px] text-ink/80">{children}</div>
}
export function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className="text-[26px] font-bold leading-tight">{String(value).padStart(2, '0')}</div>
    </div>
  )
}

const ctl = 'w-full rounded-md border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-canvas'
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-[11.5px] text-muted">{label}</span>
      {children}
    </label>
  )
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(ctl, p.className)} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(ctl, p.className)} />

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[12.5px]">
        <thead>
          <tr className="bg-canvas">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line/60">{children}</tbody>
      </table>
      {!has && <div className="px-3 py-6 text-center text-muted">{empty ?? 'Sin registros.'}</div>}
    </div>
  )
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cx('px-3 py-2', className)}>{children}</td>

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-white p-6 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-[15px] font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  )
}

export type Msg = { tipo: 'ok' | 'error'; texto: string } | null
export function Alert({ msg }: { msg: Msg }) {
  if (!msg) return null
  return (
    <div role="alert" className={cx('mb-3 rounded-md border px-3 py-2 text-[12.5px]', msg.tipo === 'ok' ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-800')}>
      {msg.texto}
    </div>
  )
}
/** Ejecuta una acción local o remota y devuelve el mensaje. */
export function useMsg() {
  const [msg, setMsg] = useState<Msg>(null)
  const run = async (fn: () => void | Promise<unknown>, ok: string) => {
    try { await fn(); setMsg({ tipo: 'ok', texto: ok }); return true } catch (e) { setMsg({ tipo: 'error', texto: (e as Error).message }); return false }
  }
  return { msg, setMsg, run }
}
export const soles = (n: number) => `S/ ${n.toFixed(2)}`
export function EstadoBadge({ e }: { e: string }) { return <Badge>{e}</Badge> }

export function PageTitle({ children, user }: { children: ReactNode; user: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between">
      <h1 className="text-[22px] font-semibold">{children}</h1>
      <div className="text-[11.5px] text-muted">{user}</div>
    </div>
  )
}
