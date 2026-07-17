import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, Profile, UserRole, AppRole } from './supabase'

type AuthContextType = {
  session: { user: { id: string; email?: string } } | null
  profile: Profile | null
  roles: AppRole[]
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthContextType['session']>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<AppRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session as AuthContextType['session'])
      if (data.session) {
        loadUserData(data.session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession as AuthContextType['session'])
      if (newSession) {
        await loadUserData(newSession.user.id)
      } else {
        setProfile(null)
        setRoles([])
        setLoading(false)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function loadUserData(userId: string) {
    try {
      const [{ data: profileData }, { data: rolesData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('*').eq('user_id', userId),
      ])

      setProfile(profileData as Profile | null)
      setRoles((rolesData as UserRole[] || []).map(r => r.role as AppRole))
    } catch {
      setProfile(null)
      setRoles([])
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message || null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setRoles([])
  }

  return (
    <AuthContext.Provider value={{ session, profile, roles, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
