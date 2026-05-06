export function Onboarding() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 pt-12 text-center">
      <h2 className="text-2xl font-semibold">Bienvenido a BrainTwo</h2>
      <p className="text-bt-muted">
        Tu chat de WhatsApp contigo mismo, convertido en una base de conocimiento privada
        con búsqueda semántica.
      </p>
      <div className="mt-6 rounded-lg border border-bt-border bg-bt-surface p-6 text-sm text-bt-muted">
        Etapa 0 — esqueleto en marcha. La vinculación con WhatsApp llega en la Etapa 3.
      </div>
    </div>
  )
}
