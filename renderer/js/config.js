async function loadConfig() {
  const config = await window.electronAPI.getConfig()

  document.getElementById('target_chat').value   = config.target_chat   || 'mis notas'
  document.getElementById('gemini_api_key').value = config.gemini_api_key || ''
  document.getElementById('gemini_model').value   = config.gemini_model   || 'gemini-1.5-flash'

  if (config.sync_on_start === 'true') {
    document.getElementById('toggle-sync').classList.add('on')
  }
}

function toggleSwitch(el) {
  el.classList.toggle('on')
}

document.getElementById('save-btn').addEventListener('click', async () => {
  const config = {
    target_chat:    document.getElementById('target_chat').value.trim(),
    gemini_api_key: document.getElementById('gemini_api_key').value.trim(),
    gemini_model:   document.getElementById('gemini_model').value.trim() || 'gemini-1.5-flash',
    sync_on_start:  document.getElementById('toggle-sync').classList.contains('on') ? 'true' : 'false',
  }

  await window.electronAPI.saveConfig(config)

  const status = document.getElementById('save-status')
  status.textContent = '✓ guardado'
  setTimeout(() => { status.textContent = '' }, 2000)
})

loadConfig()
