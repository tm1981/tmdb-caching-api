import { after } from 'next/server'
import { AdminNavigation } from '@/components/admin/admin-navigation'
import { warmUsageDashboardCache } from '@/lib/usage-dashboard'

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Warm the expensive default aggregates after an authenticated admin page is sent.
  // Subsequent layouts reuse the same single-flight, one-minute cache entry.
  after(() => warmUsageDashboardCache().catch(error => {
    console.warn('Usage dashboard warmup failed:', error)
  }))

  return (
    <div className="min-h-screen bg-background md:flex">
      <AdminNavigation />
      <main className="min-w-0 flex-1 px-4 py-5 md:p-6">{children}</main>
    </div>
  )
}
