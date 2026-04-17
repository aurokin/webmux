import { useEffect, useRef, useState } from 'react'

export type TokenPromptKind = 'missing' | 'storage-rejected' | 'submitted-rejected'

interface TokenPromptProps {
  kind: TokenPromptKind
  onSubmit: (token: string) => void
}

const COPY: Record<TokenPromptKind, { title: string; detail: string }> = {
  missing: {
    title: 'Bridge token required',
    detail: 'Paste the token printed by the bridge daemon to connect.',
  },
  'storage-rejected': {
    title: 'Authentication failed',
    detail:
      'The token saved in this browser session is no longer valid. Paste a valid token to reconnect.',
  },
  'submitted-rejected': {
    title: 'Authentication failed',
    detail: 'The bridge rejected that token. Paste a valid token to try again.',
  },
}

export function TokenPrompt({ kind, onSubmit }: TokenPromptProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  const copy = COPY[kind]
  const isError = kind !== 'missing'

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center font-ui"
      data-testid="token-prompt"
      data-kind={kind}
    >
      <div className="flex flex-col gap-2.5">
        <div
          className={
            'text-[15px] font-semibold ' +
            (isError ? 'text-accent-red' : 'text-text-primary')
          }
        >
          {copy.title}
        </div>
        <div className="max-w-[480px] text-sm leading-relaxed text-text-tertiary">
          {copy.detail}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 w-full max-w-[480px]"
        data-testid="token-prompt-form"
      >
        <input
          ref={inputRef}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Bridge token"
          autoComplete="off"
          spellCheck={false}
          data-testid="token-prompt-input"
          className="flex-1 bg-bg-elevated border border-border-default rounded-md px-3 py-2 text-sm text-text-primary font-mono outline-none focus:border-border-active"
        />
        <button
          type="submit"
          disabled={value.trim().length === 0}
          data-testid="token-prompt-submit"
          className="px-4 py-2 rounded-md bg-accent-green text-bg-deep font-semibold text-sm cursor-pointer border-none hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Connect
        </button>
      </form>
    </div>
  )
}
