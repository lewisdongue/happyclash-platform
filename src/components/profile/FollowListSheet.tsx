import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { fetchFollowList } from '@/api/profiles'
import { Avatar } from '@/components/ui/Avatar'
import { Sheet } from '@/components/ui/Sheet'

interface FollowListSheetProps {
  profileId: string
  direction: 'followers' | 'following' | null
  onClose: () => void
}

/** Who follows a talent, or whom they follow. */
export function FollowListSheet({ profileId, direction, onClose }: FollowListSheetProps) {
  const { data: people = [], isLoading } = useQuery({
    queryKey: ['follow-list', profileId, direction],
    queryFn: () => fetchFollowList(profileId, direction!),
    enabled: direction !== null,
  })

  return (
    <Sheet open={direction !== null} title={direction === 'following' ? 'Following' : 'Followers'} onClose={onClose}>
      <div className="no-scrollbar max-h-[60dvh] overflow-y-auto">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        ) : people.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{direction === 'following' ? 'Not following anyone yet.' : 'No followers yet.'}</p>
        ) : (
          <ul className="space-y-1">
            {people.map((person) => (
              <li key={person.id}>
                <Link to={`/u/${person.handle}`} onClick={onClose} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-fg/5">
                  <Avatar name={person.displayName} src={person.avatarUrl} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold"><span translate="no" className="notranslate">{person.displayName}</span></span>
                    <span className="block truncate text-xs text-muted"><span translate="no" className="notranslate">@{person.handle}</span></span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
