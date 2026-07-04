import { useVirtualizer } from "@tanstack/react-virtual"
import { type ReactNode, useRef } from "react"

const VIRTUALIZE_THRESHOLD = 40
const DEFAULT_ITEM_HEIGHT = 52

export type VirtualizedListProps<T> = {
  items: T[]
  estimateSize?: number
  className?: string
  getKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
}

export function VirtualizedList<T>({
  items,
  estimateSize = DEFAULT_ITEM_HEIGHT,
  className,
  getKey,
  renderItem,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const useVirtual = items.length >= VIRTUALIZE_THRESHOLD

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 8,
    enabled: useVirtual,
  })

  if (!useVirtual) {
    return (
      <div className={className}>
        <ul className="flex flex-col gap-1.5">
          {items.map((item, index) => (
            <li key={getKey(item, index)}>{renderItem(item, index)}</li>
          ))}
        </ul>
      </div>
    )
  }

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div ref={parentRef} className={className}>
      <ul
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index]
          return (
            <li
              key={getKey(item, virtualRow.index)}
              className="absolute top-0 left-0 w-full pb-1.5"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}