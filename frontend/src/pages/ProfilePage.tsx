import { zodResolver } from '@hookform/resolvers/zod'
import {
  Bell,
  Camera,
  Edit3,
  Globe,
  Lock,
  LogOut,
  Monitor,
  Save,
  Smartphone,
  UserCircle2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../context/AuthContext'
import { changeMyPassword, getMyProfile, updateMyProfile } from '../features/profile/api'
import {
  changePasswordSchema,
  profileSchema,
  type ChangePasswordFormValues,
  type ProfileFormValues,
} from '../features/profile/schemas'
import type { Profile } from '../features/profile/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

const languageOptions = ['English (US)', 'English (UK)', 'Hindi', 'French']
const timezoneOptions = [
  '(GMT+05:30) India Standard Time',
  '(GMT-05:00) Eastern Time',
  '(GMT+00:00) UTC',
  '(GMT+01:00) Central European Time',
]

const mockLoginActivity = [
  {
    id: 1,
    title: 'Windows PC • Chrome',
    subtitle: 'Current device • Last active: just now',
    current: true,
    icon: Monitor,
  },
  {
    id: 2,
    title: 'iPhone • Safari',
    subtitle: 'Mobile device • Oct 24, 2023 • 09:12 AM',
    current: false,
    icon: Smartphone,
  },
  {
    id: 3,
    title: 'MacBook • Chrome',
    subtitle: 'Work device • Oct 21, 2023 • 11:45 PM',
    current: false,
    icon: Monitor,
  },
]

function splitFullName(fullName: string | null | undefined) {
  const safe = (fullName || '').trim()
  if (!safe) return { firstName: '', lastName: '' }
  const parts = safe.split(' ')
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  }
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-2 block text-xs sm:text-sm font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
        {label}
      </label>
      <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:py-4 text-sm sm:text-base text-slate-700
        dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {value || '-'}
      </div>
    </div>
  )
}

function LogoutConfirmModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm dark:bg-black/50">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900 dark:shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Logout?</h3>
        <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
          Are you sure you want to logout from your account?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 sm:px-5 sm:py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50
              dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl bg-red-600 px-4 py-2.5 sm:px-5 sm:py-3 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Yes, Logout
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { logout, refreshMe } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      phone: '',
      profile_image_url: '',
      timezone: '',
      language: 'English (US)',
      two_factor_enabled: false,
    },
  })

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  const loadProfile = async () => {
    try {
      setProfileError('')
      const data = await getMyProfile()
      setProfile(data)
      const derived = splitFullName(data.full_name)
      profileForm.reset({
        first_name: data.first_name || derived.firstName,
        last_name: data.last_name || derived.lastName,
        phone: data.phone || '',
        profile_image_url: data.profile_image_url || '',
        timezone: data.timezone || '(GMT+05:30) India Standard Time',
        language: data.language || 'English (US)',
        two_factor_enabled: Boolean(data.two_factor_enabled),
      })
    } catch (error: any) {
      setProfileError(error?.response?.data?.detail || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const watchedFirstName = profileForm.watch('first_name')
  const watchedLastName = profileForm.watch('last_name')
  const watchedImage = profileForm.watch('profile_image_url')
  const watchedTwoFactor = profileForm.watch('two_factor_enabled')

  const displayFullName = useMemo(() => {
    if (isEditing) {
      const composed = `${watchedFirstName || ''} ${watchedLastName || ''}`.trim()
      return composed || profile?.full_name || 'User'
    }
    return profile?.full_name || 'User'
  }, [isEditing, watchedFirstName, watchedLastName, profile?.full_name])

  const profileImage = isEditing
    ? watchedImage
      ? watchedImage.startsWith('/uploads')
        ? `${API_BASE_URL}${watchedImage}`
        : watchedImage
      : null
    : profile?.profile_image_url
      ? profile.profile_image_url.startsWith('/uploads')
        ? `${API_BASE_URL}${profile.profile_image_url}`
        : profile.profile_image_url
      : null

  const handleEditClick = () => {
    setProfileError('')
    setProfileSuccess('')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    if (!profile) return
    const derived = splitFullName(profile.full_name)
    profileForm.reset({
      first_name: profile.first_name || derived.firstName,
      last_name: profile.last_name || derived.lastName,
      phone: profile.phone || '',
      profile_image_url: profile.profile_image_url || '',
      timezone: profile.timezone || '(GMT+05:30) India Standard Time',
      language: profile.language || 'English (US)',
      two_factor_enabled: Boolean(profile.two_factor_enabled),
    })
    setProfileError('')
    setProfileSuccess('')
    setIsEditing(false)
  }

  const onSubmitProfile = async (values: ProfileFormValues) => {
    setProfileError('')
    setProfileSuccess('')
    setSavingProfile(true)
    try {
      const composedFullName = `${values.first_name || ''} ${values.last_name || ''}`.trim()
      const updated = await updateMyProfile({
        full_name: composedFullName || profile?.full_name || 'User',
        first_name: values.first_name || null,
        last_name: values.last_name || null,
        phone: values.phone || null,
        profile_image_url: values.profile_image_url || null,
        timezone: values.timezone || null,
        language: values.language,
        two_factor_enabled: values.two_factor_enabled,
      })
      setProfile(updated)
      setProfileSuccess('Profile updated successfully')
      setIsEditing(false)
      await refreshMe()
      await loadProfile()
    } catch (error: any) {
      setProfileError(error?.response?.data?.detail || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const onSubmitPassword = async (values: ChangePasswordFormValues) => {
    setPasswordError('')
    setPasswordSuccess('')
    setSavingPassword(true)
    try {
      await changeMyPassword({
        current_password: values.current_password,
        new_password: values.new_password,
      })
      setPasswordSuccess('Password changed successfully')
      passwordForm.reset()
    } catch (error: any) {
      setPasswordError(error?.response?.data?.detail || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  // Shared input className for edit mode
  const inputCls = "w-full rounded-2xl border border-slate-300 px-4 py-3 sm:py-4 text-sm sm:text-base outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
  const labelCls = "mb-2 block text-xs sm:text-sm font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500"

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-lg text-slate-600 dark:text-slate-400">Loading profile...</div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <LogoutConfirmModal
        open={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={logout}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-0">

        {/* Breadcrumb */}
        <div className="mb-4 mt-2 sm:mb-6">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Settings / User Profile</p>
        </div>

        {/* Header: Avatar + Name + Edit button */}
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 lg:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={displayFullName}
                  className="h-20 w-20 sm:h-28 sm:w-28 rounded-[24px] sm:rounded-[28px] object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-20 w-20 sm:h-28 sm:w-28 items-center justify-center rounded-[24px] sm:rounded-[28px] bg-indigo-50 text-indigo-600 shadow-sm
                  dark:bg-indigo-950/60 dark:text-indigo-400">
                  <UserCircle2 size={44} className="sm:hidden" />
                  <UserCircle2 size={58} className="hidden sm:block" />
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl bg-indigo-600 text-white shadow-lg transition-all duration-300 hover:-translate-y-[1px] hover:bg-indigo-700">
                <Camera size={15} className="sm:hidden" />
                <Camera size={18} className="hidden sm:block" />
              </div>
            </div>

            {/* Name + role */}
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.03em] text-slate-900 truncate dark:text-white">
                {displayFullName}
              </h1>
              <div className="mt-1 sm:mt-2 flex flex-wrap items-center gap-1 sm:gap-2 text-base sm:text-xl lg:text-2xl text-slate-500 dark:text-slate-400">
                <span>{profile?.role || 'Store Manager'}</span>
                <span>•</span>
                <span className="font-medium text-indigo-600 dark:text-indigo-400">Admin Access</span>
              </div>
            </div>
          </div>

          {/* Edit / Save / Cancel buttons */}
          <div className="flex gap-3 flex-shrink-0 self-start sm:self-auto">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="group relative overflow-hidden rounded-[18px] border border-indigo-200/70 bg-white px-3 py-2.5 sm:px-5 sm:py-3 text-slate-700 shadow-[0_10px_24px_rgba(99,102,241,0.08)] transition-all duration-300 hover:-translate-y-[1px] hover:border-violet-300/70 hover:shadow-[0_12px_28px_rgba(99,102,241,0.14)] active:translate-y-0
                    dark:border-indigo-800/50 dark:bg-slate-800 dark:text-slate-200 dark:shadow-[0_10px_24px_rgba(99,102,241,0.04)] dark:hover:border-indigo-700"
                >
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_35%)]" />
                  <span className="relative flex items-center gap-2 sm:gap-3">
                    <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 ring-1 ring-indigo-100 transition-all duration-300 group-hover:scale-105 group-hover:bg-indigo-100 group-hover:text-indigo-600
                      dark:bg-indigo-950/60 dark:text-indigo-400 dark:ring-indigo-800">
                      <X size={14} className="transition-transform duration-300 group-hover:rotate-90" />
                    </span>
                    <span className="text-sm sm:text-[15px] font-semibold text-slate-700 dark:text-slate-200">Cancel</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={profileForm.handleSubmit(onSubmitProfile)}
                  disabled={savingProfile}
                  className="group relative overflow-hidden rounded-[18px] border border-indigo-300/50 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-3 py-2.5 sm:px-5 sm:py-3 text-white shadow-[0_10px_24px_rgba(79,70,229,0.22)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_12px_28px_rgba(79,70,229,0.28)] active:translate-y-0 disabled:opacity-70"
                >
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.20),transparent_35%)]" />
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  <span className="relative flex items-center gap-2 sm:gap-3">
                    <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
                      <Save size={14} className="transition-transform duration-300 group-hover:rotate-6" />
                    </span>
                    <span className="text-sm sm:text-[15px] font-semibold">
                      {savingProfile ? 'Saving...' : 'Save Changes'}
                    </span>
                  </span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleEditClick}
                className="group relative overflow-hidden rounded-[18px] border border-indigo-300/50 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-3 py-2.5 sm:px-5 sm:py-3 text-white shadow-[0_10px_24px_rgba(79,70,229,0.22)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_12px_28px_rgba(79,70,229,0.28)] active:translate-y-0"
              >
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.20),transparent_35%)]" />
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative flex items-center gap-2 sm:gap-3">
                  <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
                    <Edit3 size={14} className="transition-transform duration-300 group-hover:rotate-6" />
                  </span>
                  <span className="text-sm sm:text-[15px] font-semibold">Edit Profile</span>
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Personal Info + Preferences */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_0.9fr] gap-6">

          {/* Personal Information */}
          <div className="rounded-[24px] sm:rounded-[30px] bg-white p-5 sm:p-8 shadow-sm
            dark:bg-slate-900 dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
            <div className="mb-6 sm:mb-8 flex items-center gap-3">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600
                dark:bg-indigo-950/60 dark:text-indigo-400">
                <UserCircle2 size={18} className="sm:hidden" />
                <UserCircle2 size={20} className="hidden sm:block" />
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">Personal Information</h2>
            </div>

            <form className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                {isEditing ? (
                  <>
                    <div>
                      <label className={labelCls}>First Name</label>
                      <input {...profileForm.register('first_name')} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Last Name</label>
                      <input {...profileForm.register('last_name')} className={inputCls} />
                    </div>
                  </>
                ) : (
                  <>
                    <ReadOnlyField label="First Name" value={profile?.first_name || splitFullName(profile?.full_name).firstName} />
                    <ReadOnlyField label="Last Name" value={profile?.last_name || splitFullName(profile?.full_name).lastName} />
                  </>
                )}
              </div>

              <ReadOnlyField label="Email Address" value={profile?.email || ''} />

              {isEditing ? (
                <div>
                  <label className={labelCls}>Phone Number</label>
                  <input {...profileForm.register('phone')} className={inputCls} />
                </div>
              ) : (
                <ReadOnlyField label="Phone Number" value={profile?.phone || ''} />
              )}

              {isEditing ? (
                <div>
                  <label className={labelCls}>Profile Image URL</label>
                  <input
                    {...profileForm.register('profile_image_url')}
                    placeholder="https://..."
                    className={inputCls}
                  />
                </div>
              ) : (
                <ReadOnlyField label="Profile Image URL" value={profile?.profile_image_url || ''} />
              )}

              {profileError && (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">{profileError}</div>
              )}
              {profileSuccess && (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">{profileSuccess}</div>
              )}
            </form>
          </div>

          {/* Preferences */}
          <div className="rounded-[24px] sm:rounded-[30px] bg-white p-5 sm:p-8 shadow-sm
            dark:bg-slate-900 dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
            <div className="mb-6 sm:mb-8 flex items-center gap-3">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600
                dark:bg-indigo-950/60 dark:text-indigo-400">
                <Globe size={18} className="sm:hidden" />
                <Globe size={20} className="hidden sm:block" />
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">Preferences</h2>
            </div>

            <div className="space-y-6 sm:space-y-8">
              {isEditing ? (
                <>
                  <div>
                    <label className={labelCls}>Language</label>
                    <select
                      {...profileForm.register('language')}
                      className={inputCls}
                    >
                      {languageOptions.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Timezone</label>
                    <select
                      {...profileForm.register('timezone')}
                      className={inputCls}
                    >
                      {timezoneOptions.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4
                    dark:bg-slate-800">
                    <div className="pr-4">
                      <p className="text-base sm:text-xl font-semibold text-slate-900 dark:text-white">Two-factor Authentication</p>
                      <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">Add an extra layer of security</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => profileForm.setValue('two_factor_enabled', !watchedTwoFactor)}
                      className={`relative h-7 w-12 sm:h-8 sm:w-14 flex-shrink-0 rounded-full transition ${
                        watchedTwoFactor ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 sm:top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all ${
                          watchedTwoFactor ? 'left-5 sm:left-7' : 'left-0.5 sm:left-1'
                        }`}
                      />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <ReadOnlyField label="Language" value={profile?.language || ''} />
                  <ReadOnlyField label="Timezone" value={profile?.timezone || ''} />
                  <ReadOnlyField
                    label="Two-factor Authentication"
                    value={profile?.two_factor_enabled ? 'Enabled' : 'Disabled'}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Account Security + Login Activity */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Account Security */}
          <div className="rounded-[24px] sm:rounded-[30px] bg-white p-5 sm:p-8 shadow-sm
            dark:bg-slate-900 dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
            <div className="mb-6 sm:mb-8 flex items-center gap-3">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600
                dark:bg-indigo-950/60 dark:text-indigo-400">
                <Lock size={18} className="sm:hidden" />
                <Lock size={20} className="hidden sm:block" />
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">Account Security</h2>
            </div>

            <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-4 sm:space-y-5">
              <div>
                <label className={labelCls}>Current Password</label>
                <input
                  type="password"
                  {...passwordForm.register('current_password')}
                  className={inputCls}
                />
                {passwordForm.formState.errors.current_password && (
                  <p className="mt-1 text-xs text-red-500">{passwordForm.formState.errors.current_password.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>New Password</label>
                  <input
                    type="password"
                    {...passwordForm.register('new_password')}
                    className={inputCls}
                  />
                  {passwordForm.formState.errors.new_password && (
                    <p className="mt-1 text-xs text-red-500">{passwordForm.formState.errors.new_password.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Confirm New Password</label>
                  <input
                    type="password"
                    {...passwordForm.register('confirm_password')}
                    className={inputCls}
                  />
                  {passwordForm.formState.errors.confirm_password && (
                    <p className="mt-1 text-xs text-red-500">{passwordForm.formState.errors.confirm_password.message}</p>
                  )}
                </div>
              </div>

              {passwordError && (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">{passwordError}</div>
              )}
              {passwordSuccess && (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">{passwordSuccess}</div>
              )}

              <button
                type="submit"
                disabled={savingPassword}
                className="group relative overflow-hidden rounded-[18px] border border-indigo-300/50 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-4 py-2.5 sm:px-5 sm:py-3 text-white shadow-[0_10px_24px_rgba(79,70,229,0.22)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_12px_28px_rgba(79,70,229,0.28)] active:translate-y-0 disabled:opacity-70"
              >
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.20),transparent_35%)]" />
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative flex items-center gap-2 sm:gap-3">
                  <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
                    <Lock size={14} className="transition-transform duration-300 group-hover:rotate-6" />
                  </span>
                  <span className="text-sm sm:text-[15px] font-semibold">
                    {savingPassword ? 'Updating...' : 'Update Password'}
                  </span>
                </span>
              </button>
            </form>
          </div>

          {/* Recent Login Activity */}
          <div className="rounded-[24px] sm:rounded-[30px] bg-white p-5 sm:p-8 shadow-sm
            dark:bg-slate-900 dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
            <div className="mb-6 sm:mb-8 flex items-center gap-3">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600
                dark:bg-indigo-950/60 dark:text-indigo-400">
                <Bell size={18} className="sm:hidden" />
                <Bell size={20} className="hidden sm:block" />
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">Recent Login Activity</h2>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {mockLoginActivity.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-3 sm:px-4 sm:py-4 transition hover:bg-slate-100
                      dark:bg-slate-800 dark:hover:bg-slate-700/70"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div className="flex h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-white text-slate-600 shadow-sm
                        dark:bg-slate-700 dark:text-slate-300 dark:shadow-none">
                        <Icon size={18} className="sm:hidden" />
                        <Icon size={20} className="hidden sm:block" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm sm:text-base font-semibold text-slate-900 truncate dark:text-white">{item.title}</p>
                        <p className="text-xs sm:text-sm text-slate-500 truncate dark:text-slate-400">{item.subtitle}</p>
                      </div>
                    </div>
                    {item.current && (
                      <span className="ml-2 flex-shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700
                        dark:bg-emerald-900/40 dark:text-emerald-400">
                        CURRENT
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Delete Account */}
        <div className="mt-6 rounded-[24px] sm:rounded-[30px] border border-red-200 bg-red-50 px-5 py-5 sm:px-8 sm:py-8
          dark:border-red-900/40 dark:bg-red-950/30">
          <div className="flex flex-col gap-4 md:flex-row-1 lg:flex-row md:items-center md:justify-between md:gap-4">
            <div>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600 dark:text-red-400">Delete Account</h3>
              <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
                Permanently remove your personal data and account access. This action cannot be undone.
              </p>
            </div>
            <button className="self-start sm:self-auto flex-shrink-0 rounded-2xl bg-red-600 px-5 py-3 sm:px-6 sm:py-4 text-sm sm:text-base font-semibold text-white shadow-md transition hover:-translate-y-[1px] hover:bg-red-700 hover:shadow-lg">
              Deactivate Account
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 text-xs sm:text-sm text-slate-400 dark:text-slate-600">
          <p>© 2024 RetailFlow Enterprise. All rights reserved.</p>
          <div className="flex flex-wrap gap-4 sm:gap-6">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Security Overview</span>
          </div>
        </div>

        {/* Logout */}
        <div className="mt-4 pb-8">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 sm:px-5 sm:py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100
              dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </div>
    </AppShell>
  )
}