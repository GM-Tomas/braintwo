let allNotes = []
let selectedId = null

async function loadNotes() {
  allNotes = await window.electronAPI.getNotes()
  renderNoteList(allNotes)
  document.getElementById('note-count').textContent = `${allNotes.length} notas`
}

function renderNoteList(notes) {
  const list = document.getElementById('note-list')
  if (!notes.length) {
    list.innerHTML = '<div class="loading">no hay notas todavía. mandá un mensaje a tu chat de WhatsApp.</div>'
    return
  }

  // Agrupar por día
  const groups = {}
  notes.forEach(n => {
    const d = new Date(n.created_at)
    const key = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })
    if (!groups[key]) groups[key] = []
    groups[key].push(n)
  })

  list.innerHTML = Object.entries(groups).map(([day, dayNotes]) => `
    <div class="day-sep">${day}</div>
    ${dayNotes.map(n => noteItemHTML(n)).join('')}
  `).join('')

  list.querySelectorAll('.note-item').forEach(el => {
    el.addEventListener('click', () => selectNote(parseInt(el.dataset.id)))
  })
}

function noteItemHTML(note) {
  const icon = note.type === 'audio' ? '♪' : note.type === 'image' ? '▣' : 'T'
  const time = new Date(note.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const preview = note.content.replace(/\[audio.*?\]|—/g, '').trim().substring(0, 80)
  return `
    <div class="note-item ${note.id === selectedId ? 'active' : ''}" data-id="${note.id}">
      <span class="n-icon">${icon}</span>
      <div class="n-preview">${preview}</div>
      <div class="n-time">${time}</div>
    </div>
  `
}

async function selectNote(id) {
  selectedId = id
  renderNoteList(allNotes)

  const note = allNotes.find(n => n.id === id)
  if (!note) return

  const pane = document.getElementById('detail-pane')
  const time = new Date(note.created_at).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })

  const tagsHTML = (note.tags || []).map(t => `<span class="tag">${t}</span>`).join('')

  pane.innerHTML = `
    <div class="detail-header">
      <span class="detail-badge">${note.type}</span>
      <span class="detail-ts">${time}</span>
    </div>
    <div class="detail-body">
      <div class="detail-text">${note.content}</div>
      <div class="detail-divider"></div>
      <div>
        <div class="detail-label">etiquetas</div>
        <div class="tags-row">${tagsHTML || '<span class="tag" style="opacity:0.4">sin etiquetas</span>'}</div>
      </div>
      <div>
        <div class="detail-label">fuente</div>
        <div style="font-size:12px;color:var(--text-dim)">WhatsApp · ${note.source_chat}</div>
      </div>
    </div>
  `
}

// Tabs
function switchTab(name, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('show'))
  el.classList.add('active')
  document.getElementById('tab-' + name).classList.add('show')
}

// Búsqueda
document.getElementById('search-btn').addEventListener('click', doSearch)
document.getElementById('search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch()
})

async function doSearch() {
  const query = document.getElementById('search-input').value.trim()
  if (!query) return

  document.getElementById('rag-result').style.display = 'none'
  document.getElementById('searching').style.display = 'flex'

  const result = await window.electronAPI.search(query)

  document.getElementById('searching').style.display = 'none'
  document.getElementById('rag-text').textContent = result.answer
  document.getElementById('rag-sources').innerHTML = (result.sources || [])
    .map(s => {
      const t = new Date(s.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
      return `<span class="source-chip">${s.content.substring(0, 40)}... · ${t}</span>`
    }).join('')
  document.getElementById('rag-result').style.display = 'block'
}

// Actualizar cuando llegan notas nuevas
window.electronAPI.onNotesUpdated(() => loadNotes())

// Iniciar
loadNotes()
