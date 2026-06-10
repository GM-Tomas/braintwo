export interface TranscriptionService {
  transcribe(buffer: Buffer): Promise<string>
}

export function createTranscriptionService(apiKey: string): TranscriptionService {
  return {
    async transcribe(buffer: Buffer): Promise<string> {
      const formData = new FormData()
      const blob = new Blob([buffer], { type: 'audio/ogg' })
      formData.append('file', blob, 'audio.ogg')
      formData.append('model', 'whisper-large-v3-turbo')
      formData.append('language', 'es')

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Groq API error ${res.status}: ${body}`)
      }

      const data = (await res.json()) as { text: string }
      return data.text
    }
  }
}
