import { Fragment, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/States'
import { LEGAL_DOCUMENTS } from '@/content/legal'

/** Turns email addresses in a line into mail links. */
function withLinks(text: string): ReactNode[] {
  return text.split(/([\w.+-]+@[\w-]+\.[\w.]+)/g).map((part, index) =>
    index % 2 === 1 ? (
      <a key={index} href={`mailto:${part}`} className="font-bold text-world break-all">
        {part}
      </a>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  )
}

export function LegalPage() {
  const { docId } = useParams()
  const doc = LEGAL_DOCUMENTS.find((item) => item.id === docId)

  if (!doc) {
    return (
      <div className="pt-32">
        <EmptyState title="This page does not exist" />
      </div>
    )
  }

  const blocks: ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-3 space-y-2 pl-1">
        {bullets.map((item, index) => (
          <li key={index} className="flex gap-3">
            <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-world" />
            <span>{withLinks(item)}</span>
          </li>
        ))}
      </ul>,
    )
    bullets = []
  }
  doc.body.split('\n').forEach((line, index) => {
    if (line.startsWith('- ')) return bullets.push(line.slice(2))
    flush()
    if (line.startsWith('## ')) blocks.push(<h2 key={index} className="mt-8 mb-2 text-lg font-extrabold text-text">{line.slice(3)}</h2>)
    else if (line.trim()) blocks.push(<p key={index} className="my-3">{withLinks(line)}</p>)
  })
  flush()

  const others = LEGAL_DOCUMENTS.filter((item) => item.id !== doc.id)

  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-36 lg:pb-12">
      <PageHeader back title={doc.title} />
      <article className="px-5 pt-2 text-[15px] leading-relaxed break-words text-fg/80">{blocks}</article>
      <nav aria-label="Other legal documents" className="mx-5 mt-10 border-t border-fg/8 pt-6">
        <p className="mb-3 text-[11px] font-extrabold tracking-widest text-muted uppercase">Also read</p>
        <div className="flex flex-wrap gap-2">
          {others.map((item) => (
            <Link key={item.id} to={`/legal/${item.id}`} className="pressable rounded-full border border-line bg-fg/5 px-3.5 py-2 text-xs font-bold">
              {item.title}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
