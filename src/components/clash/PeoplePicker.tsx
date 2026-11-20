import { useEffect, useState } from 'react'
import { searchProfiles } from '@/api/groups'
import { CloseIcon, SearchIcon } from '@/components/icons/UiIcons'
import { Avatar } from '@/components/ui/Avatar'
import type { Author } from '@/types/domain'

export type Person = Pick<Author, 'id' | 'handle' | 'displayName' | 'avatarUrl'>

interface PeoplePickerProps {
  selected: Person[]
  onChange: (people: Person[]) => void
  /** The signed-in user, who cannot invite themselves. */
  selfId?: string
}

/** Search talents by handle or name and collect them as invitees. */
export function PeoplePicker({ selected, onChange, selfId }: PeoplePickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Person[]>([])

  useEffect(() => {
    let current = true
    const timer = window.setTimeout(() => {
      searchProfiles(query, selfId)
        .then((people) => current && setResults(people))
        .catch(() => current && setResults([]))
    }, 220)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [query, selfId])

  const chosen = new Set(selected.map((person) => person.id))

  return (
    <div>
      <label className="flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-fg/5 px-4 focus-within:border-world">
        <SearchIcon size={18} className="text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search talents by name or @handle"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
        />
      </label>

      {query.trim().length >= 2 && (
        <ul className="mt-2 overflow-hidden rounded-2xl border border-line bg-surface">
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No talent matches “{query.trim()}”.</li>
          ) : (
            results.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  disabled={chosen.has(person.id)}
                  onClick={() => {
                    onChange([...selected, person])
                    setQuery('')
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-fg/5 disabled:opacity-40"
                >
                  <Avatar name={person.displayName} src={person.avatarUrl} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold"><span translate="no" className="notranslate">{person.displayName}</span></span>
                    <span className="block truncate text-xs text-muted"><span translate="no" className="notranslate">@{person.handle}</span></span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {selected.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {selected.map((person) => (
            <li key={person.id} className="flex h-9 items-center gap-2 rounded-full bg-world-soft pr-1.5 pl-1 text-[13px] font-extrabold">
              <Avatar name={person.displayName} src={person.avatarUrl} size={28} /><span translate="no" className="notranslate">@{person.handle}</span>
              <button
                type="button"
                aria-label={`Remove @${person.handle}`}
                onClick={() => onChange(selected.filter((other) => other.id !== person.id))}
                className="grid size-6 place-items-center rounded-full bg-black/25"
              >
                <CloseIcon size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
