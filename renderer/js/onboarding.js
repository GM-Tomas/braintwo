window.electronAPI.onQR((qrData) => {
  const canvas = document.getElementById('qr-canvas')
  QRCode.toCanvas(canvas, qrData, { width: 140, margin: 1, color: { dark: '#e8c88a', light: '#201608' } })
  document.getElementById('status-text').textContent = 'escaneá el código'
})

window.electronAPI.onWhatsAppReady(() => {
  document.getElementById('status-text').textContent = '¡conectado!'
  document.querySelector('.status-dot').style.background = '#7aaa60'
})
