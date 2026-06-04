import { useMemo } from 'react'

export function useDateFormatter(
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  },
  locale: string = 'es-AR'
) {
  // We stringify the options to safely use them in the dependency array
  // so we don't recreate the formatter on every render if an inline object is passed.
  const optionsStr = JSON.stringify(options)
  
  return useMemo(() => {
    return new Intl.DateTimeFormat(locale, JSON.parse(optionsStr))
  }, [optionsStr, locale])
}
