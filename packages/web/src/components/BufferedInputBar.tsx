import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { SendHorizontal, X } from 'lucide-react'
import type { WebmuxClient } from '@webmux/client'
import { cn } from '../lib/cn'

interface BufferedInputBarProps {
  client: WebmuxClient
  paneId: string
  canSend: boolean
  focused: boolean
  onFocusPane: () => void
  onExitBufferedMode: () => void
  onUnavailable: (notice: { title: string; detail: string; tone: 'warning' | 'error' }) => void
}

export interface BufferedInputBarHandle {
  focus: () => void
}

export const BufferedInputBar = forwardRef<BufferedInputBarHandle, BufferedInputBarProps>(
  function BufferedInputBar(
    { client, paneId, canSend, focused, onFocusPane, onExitBufferedMode, onUnavailable },
    ref,
  ) {
    const [buffer, setBuffer] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const canSubmit = canSend && buffer.length > 0

    useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), [])

    useEffect(() => {
      if (focused) {
        inputRef.current?.focus()
      }
    }, [focused])

    const send = () => {
      if (!canSend) {
        onUnavailable({
          title: 'Take control first',
          detail: 'Buffered input requires ownership of this session.',
          tone: 'warning',
        })
        return
      }

      client.sendInput(paneId, `${buffer}\n`)
      setBuffer('')
      inputRef.current?.focus()
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
          return
        }

        event.preventDefault()
        send()
        return
      }

      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      if (buffer) {
        setBuffer('')
        return
      }

      onExitBufferedMode()
    }

    return (
      <div
        className={cn(
          'flex h-9 shrink-0 items-center gap-2 border-t border-border-subtle bg-bg-surface px-2 font-mono text-[11px]',
          canSend ? 'text-text-secondary' : 'text-text-ghost',
        )}
        data-testid={`buffered-input-bar-${paneId}`}
        onPointerDownCapture={onFocusPane}
        onFocusCapture={onFocusPane}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="hidden text-[10px] uppercase tracking-wider text-accent-yellow sm:inline">
          buffered
        </span>
        <input
          ref={inputRef}
          value={buffer}
          disabled={!canSend}
          placeholder={canSend ? 'Compose locally, Enter to send' : 'Take control to send'}
          onChange={(event) => setBuffer(event.target.value)}
          onKeyDown={handleKeyDown}
          data-testid={`buffered-input-${paneId}`}
          className="focus-ring h-6 min-w-0 flex-1 rounded-[3px] border border-border-default bg-bg-base px-2 text-text-primary outline-none placeholder:text-text-ghost disabled:cursor-not-allowed disabled:text-text-ghost"
        />
        <button
          type="button"
          title="Send buffered input"
          aria-label="Send buffered input"
          disabled={!canSubmit}
          onClick={send}
          data-testid={`send-buffered-input-${paneId}`}
          className={cn(
            'focus-ring flex h-6 w-6 items-center justify-center rounded-[3px] transition-colors',
            canSubmit
              ? 'text-accent-green hover:bg-bg-hover'
              : 'cursor-not-allowed text-text-ghost/60',
          )}
        >
          <SendHorizontal size={13} />
        </button>
        <button
          type="button"
          title="Return to direct input"
          aria-label="Return to direct input"
          onClick={onExitBufferedMode}
          className="focus-ring flex h-6 w-6 items-center justify-center rounded-[3px] text-text-ghost transition-colors hover:bg-bg-hover hover:text-text-secondary"
        >
          <X size={13} />
        </button>
      </div>
    )
  },
)
