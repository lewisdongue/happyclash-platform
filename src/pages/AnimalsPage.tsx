import { useSearchParams } from 'react-router'
import { Model3D } from '@/components/three/Model3D'
import type { ModelKey } from '@/lib/assets'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { RankingPage } from '@/pages/RankingPage'
import { WorldPage } from '@/pages/WorldPage'

type View = 'animals' | 'ranking'

const PETS: { model: ModelKey; label: string }[] = [
  { model: 'pet-dog', label: 'Dogs' },
  { model: 'pet-cat', label: 'Cats' },
  { model: 'pet-rabbit', label: 'Rabbits' },
]

/** Pets on stage, turned with a finger. */
function PetStage() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-3 lg:px-8">
      <div className="grid grid-cols-3 gap-2 lg:gap-4">
        {PETS.map((pet) => (
          <figure key={pet.model} className="flex min-w-0 flex-col items-center rounded-3xl border border-line bg-[radial-gradient(70%_60%_at_50%_40%,var(--world-soft),transparent)] pb-3">
            <Model3D model={pet.model} label={pet.label} interactive spin={16} className="aspect-square w-full" />
            <figcaption className="truncate text-sm font-extrabold">{pet.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

/** The Animals section: the pet talent world first, the full ranking as its second view. */
export function AnimalsPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'ranking' ? 'ranking' : 'animals'

  return (
    <>
      <div className="sticky top-0 z-30 mx-auto flex max-w-6xl justify-center px-4 pt-[calc(var(--safe-top)+10px)] pb-1 lg:px-8 lg:pt-3">
        <SegmentedTabs
          label="Animals section"
          value={view}
          onChange={(next) => setParams(next === 'ranking' ? { view: 'ranking' } : {}, { replace: true })}
          options={[
            { value: 'animals', label: 'Animals' },
            { value: 'ranking', label: 'Ranking' },
          ]}
        />
      </div>
      {view === 'ranking' ? (
        <RankingPage />
      ) : (
        <>
          <PetStage />
          <WorldPage fixedWorld="animals" />
        </>
      )}
    </>
  )
}
