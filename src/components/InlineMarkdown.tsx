interface InlineMarkdownProps {
  text: string
}

export function InlineText({ text }: InlineMarkdownProps) {
  // Minimal inline renderer: **bold**, *italic*, and `code`. No external dependency.
  // Using lookarounds to avoid matches that start or end with spaces, and preventing matches across lines.
  const parts = text.split(/(\*\*(?!\s)[^*\r\n]+(?<!\s)\*\*|\*(?!\s)[^*\r\n]+(?<!\s)\*|`(?!\s)[^\`\r\n]+(?<!\s)`)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="rounded bg-bt-hover px-1 font-mono text-bt-accent">
              {part.slice(1, -1)}
            </code>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export function InlineMarkdown({ text }: InlineMarkdownProps) {
  const lines = text.split('\n')
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {lines.map((line, idx) => {
        if (line.trim() === '') {
          return <div key={idx} className="h-2" />
        }

        // Bullet list item
        if (line.startsWith('* ')) {
          return (
            <div key={idx} className="relative pl-5 py-0.5 leading-relaxed text-bt-text">
              <span className="absolute left-1.5 text-bt-accent select-none">•</span>
              <InlineText text={line.slice(2)} />
            </div>
          )
        }

        // Alternate bullet list item (dash)
        if (line.startsWith('- ')) {
          return (
            <div key={idx} className="relative pl-5 py-0.5 leading-relaxed text-bt-text">
              <span className="absolute left-1.5 text-bt-accent select-none">•</span>
              <InlineText text={line.slice(2)} />
            </div>
          )
        }

        // Numbered list item
        const numMatch = line.match(/^(\d+)\.\s(.*)/)
        if (numMatch) {
          const num = numMatch[1]
          const content = numMatch[2]
          return (
            <div key={idx} className="relative pl-6 py-0.5 leading-relaxed text-bt-text">
              <span className="absolute left-1 text-bt-dim select-none font-medium">{num}.</span>
              <InlineText text={content} />
            </div>
          )
        }

        // Normal paragraph
        return (
          <div key={idx} className="leading-relaxed text-bt-text">
            <InlineText text={line} />
          </div>
        )
      })}
    </div>
  )
}
