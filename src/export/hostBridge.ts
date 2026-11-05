/**
 * Anbindung an die Umgebung, in der die Vorschau läuft.
 * Als claude.ai-Artefakt sind direkte Downloads und der Druckdialog gesperrt;
 * Downloads laufen dort über die freigegebene `downloads`-Funktion.
 */
type DownloadsNs = { save: (r: { filename: string; data: Blob }) => Promise<{ status: string }> };
type ClaudeHost = { use: (name: string) => Promise<unknown> };

function host(): ClaudeHost | null {
  const c = (window as unknown as { claude?: ClaudeHost }).claude;
  return c && typeof c.use === 'function' ? c : null;
}

/** true, wenn die Anwendung als eingebettetes claude.ai-Artefakt läuft. */
export function isEmbeddedHost(): boolean {
  return host() !== null;
}

export async function saveFile(filename: string, blob: Blob): Promise<'saved' | 'declined' | 'browser'> {
  const h = host();
  if (h) {
    const downloads = (await h.use('downloads')) as DownloadsNs | null;
    if (downloads) {
      try {
        await downloads.save({ filename, data: blob });
        return 'saved';
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'declined') return 'declined';
        throw new Error(`Download in dieser Ansicht nicht möglich (${code ?? 'unbekannt'}).`);
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 2000);
  return 'browser';
}
