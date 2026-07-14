import { AdminNavigation } from '@/components/admin/admin-navigation'

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen bg-background md:flex">
      <AdminNavigation />
      <main className="min-w-0 flex-1 px-4 py-5 md:p-6">{children}</main>
    </div>
  )
}
