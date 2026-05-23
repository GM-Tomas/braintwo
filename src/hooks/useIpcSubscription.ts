import { useEffect, useRef, useLayoutEffect } from 'react'

/**
 * A custom hook to maintain a ref to the latest callback function.
 * This prevents the subscription from being recreated on every render
 * when an inline function is passed as a callback.
 */
function useLatest<T extends (...args: any[]) => void>(callback: T) {
  const ref = useRef<T>(callback)
  useLayoutEffect(() => {
    ref.current = callback
  })
  return ref
}

/**
 * A hook that manages an IPC subscription, automatically unsubscribing on unmount.
 * 
 * @param subscribeFn The API function that takes a callback and returns an unsubscribe function.
 * @param callback The callback to execute when the event fires.
 */
export function useIpcSubscription<T extends (...args: any[]) => void>(
  subscribeFn: (cb: T) => () => void,
  callback: T
) {
  const callbackRef = useLatest(callback)

  useEffect(() => {
    const handler = (...args: Parameters<T>) => callbackRef.current(...args)
    const unsubscribe = subscribeFn(handler as T)
    return () => unsubscribe()
  }, [subscribeFn, callbackRef])
}
