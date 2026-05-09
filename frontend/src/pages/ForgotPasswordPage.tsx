import { Link } from 'react-router-dom'

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Forgot Password</h1>
        <p className="mt-3 text-slate-600">This feature will be added in a later phase.</p>
        <Link
          to="/login"
          className="mt-6 inline-flex rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white"
        >
          Back to Login
        </Link>
      </div>
    </div>
  )
}