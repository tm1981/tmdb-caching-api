export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getCachedTmdb } from '@/lib/tmdb-cache'
import { getPosterPath } from '@/lib/tmdb'
import { User } from 'lucide-react'

type PersonSearchResult = {
  id: number
  name: string
  known_for_department: string | null
  profile_path: string | null
  known_for?: Array<{ title?: string; name?: string; media_type?: string }>
}

type SearchPayload = {
  page: number
  results: PersonSearchResult[]
  total_results: number
}

async function searchPeople(query: string, page: number) {
  if (!query) return { page, results: [], total_results: 0 }
  const result = await getCachedTmdb<SearchPayload>('/search/person', {
    query,
    page,
    language: 'en-US',
    include_adult: 'false',
  })
  return result.payload
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const search = params.q || ''
  const page = parseInt(params.page || '1')
  const people = await searchPeople(search, page)

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">People</h2>
      <form action="/admin/people" method="GET" className="mb-6">
        <Input
          type="search"
          placeholder="Search people..."
          defaultValue={search}
          name="q"
          className="max-w-sm"
        />
      </form>

      <div className="text-sm text-muted-foreground mb-4">
        {search ? `Showing ${people.results?.length || 0} of ${people.total_results || 0} people` : 'Search TMDB people'}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {(people.results || []).map((person) => (
          <Link key={person.id} href={`/admin/people/${person.id}`} className="group">
            <Card className="overflow-hidden py-0 h-full">
              <div className="aspect-[2/3] bg-muted">
                {person.profile_path ? (
                  <img
                    src={getPosterPath(person.profile_path, 'w500')!}
                    alt={person.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <User className="size-10 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <p className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                  {person.name}
                </p>
                {person.known_for_department && (
                  <Badge variant="secondary" className="mt-2">
                    {person.known_for_department}
                  </Badge>
                )}
                {!!person.known_for?.length && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {person.known_for.map((item) => item.title || item.name).filter(Boolean).join(', ')}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
