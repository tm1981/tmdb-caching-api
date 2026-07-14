export const dynamic = 'force-dynamic'

import { UsageDashboard } from '@/components/admin/usage-dashboard'
import { getUsageDashboard } from '@/lib/usage-dashboard'

type UsagePageProps = {
  searchParams: Promise<{
    range?: string
    search?: string
    status?: string
    country?: string
    page?: string
  }>
}

export default async function UsagePage({ searchParams }: UsagePageProps) {
  const params = await searchParams
  const data = await getUsageDashboard({
    ...params,
    page: Number(params.page) || 1,
  })

  return <UsageDashboard data={data} />
}
