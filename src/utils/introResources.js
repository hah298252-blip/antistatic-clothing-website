const readyResources = new Set()
const waiters = new Map()

export function markIntroResourceReady(key) {
  if (!key || readyResources.has(key)) return
  readyResources.add(key)
  waiters.get(key)?.forEach((resolve) => resolve())
  waiters.delete(key)
}

export function waitForIntroResource(key, timeout = 10000) {
  if (readyResources.has(key)) return Promise.resolve()
  return new Promise((resolve) => {
    const callbacks = waiters.get(key) || new Set()
    const finish = () => {
      clearTimeout(timer)
      callbacks.delete(finish)
      resolve()
    }
    callbacks.add(finish)
    waiters.set(key, callbacks)
    const timer = window.setTimeout(finish, timeout)
  })
}
