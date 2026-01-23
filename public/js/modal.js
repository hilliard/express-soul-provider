/**
 * Reusable Modal System for Soul Provider
 * Provides consistent styled popups across the site
 */

let modalContainer = null

function createModalContainer() {
  if (modalContainer) return modalContainer
  
  modalContainer = document.createElement('div')
  modalContainer.id = 'modal-overlay'
  modalContainer.className = 'modal-overlay'
  modalContainer.innerHTML = `
    <div class="modal-content">
      <h3 class="modal-title"></h3>
      <p class="modal-message"></p>
      <div class="modal-buttons"></div>
    </div>
  `
  document.body.appendChild(modalContainer)
  
  // Close on overlay click
  modalContainer.addEventListener('click', (e) => {
    if (e.target === modalContainer) {
      closeModal()
    }
  })
  
  return modalContainer
}

function openModal(title, message, buttons) {
  const modal = createModalContainer()
  
  const titleEl = modal.querySelector('.modal-title')
  const messageEl = modal.querySelector('.modal-message')
  const buttonsEl = modal.querySelector('.modal-buttons')
  
  titleEl.textContent = title
  messageEl.textContent = message
  buttonsEl.innerHTML = ''
  
  buttons.forEach(btn => {
    const button = document.createElement('button')
    button.textContent = btn.text
    button.className = btn.className || 'main-btn'
    button.onclick = () => {
      if (btn.onClick) btn.onClick()
      closeModal()
    }
    buttonsEl.appendChild(button)
  })
  
  modal.classList.add('modal-visible')
  document.body.style.overflow = 'hidden'
}

function closeModal() {
  if (modalContainer) {
    modalContainer.classList.remove('modal-visible')
    document.body.style.overflow = ''
  }
}

/**
 * Show a confirmation dialog with custom styling
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
export function showConfirm(title, message) {
  return new Promise((resolve) => {
    openModal(title, message, [
      {
        text: 'Cancel',
        className: 'secondary-btn',
        onClick: () => resolve(false)
      },
      {
        text: 'Confirm',
        className: 'main-btn',
        onClick: () => resolve(true)
      }
    ])
  })
}

/**
 * Show an alert dialog with custom styling
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @returns {Promise<void>}
 */
export function showAlert(title, message) {
  return new Promise((resolve) => {
    openModal(title, message, [
      {
        text: 'OK',
        className: 'main-btn',
        onClick: () => resolve()
      }
    ])
  })
}
