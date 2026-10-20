/** Web/phone: opt-in icon download through a favicon service (CORS image -> data URL). Desktop uses the main process instead. */
export function webIcon(host: string): Promise<string | null> {
  return new Promise((res) => {
    const im = new Image(); im.crossOrigin = 'anonymous'
    im.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d')!.drawImage(im, 0, 0, 64, 64); res(c.toDataURL('image/png')) } catch { res(null) } }
    im.onerror = () => res(null); im.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
  })
}
