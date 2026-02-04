/**
 * Album Modal - Display album details in a modal overlay
 * Click album image to open, close button or overlay to close
 */

const modalOverlay = document.getElementById('albumModalOverlay')
const modalClose = document.getElementById('albumModalClose')
const modalBody = document.getElementById('albumModalBody')

// ===== Helper Functions =====
function formatDuration(seconds) {
  if (!seconds) return 'N/A'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// ===== Fetch Album Details =====
async function fetchAlbumDetails(albumId) {
  try {
    const response = await fetch(`/api/products/${albumId}`)
    if (!response.ok) throw new Error('Failed to fetch album')
    return await response.json()
  } catch (err) {
    console.error('Error fetching album details:', err)
    return null
  }
}

// ===== Fetch Album Songs =====
async function fetchAlbumSongs(albumId) {
  try {
    const response = await fetch(`/api/songs?albumId=${albumId}`)
    if (!response.ok) throw new Error('Failed to fetch songs')
    return await response.json()
  } catch (err) {
    console.error('Error fetching album songs:', err)
    return []
  }
}

// ===== Render Album Details =====
async function renderAlbumDetails(album) {
  // Fetch songs for this album
  const songs = await fetchAlbumSongs(album.id)
  
  // Handle image path
  const imagePath = album.image.startsWith('images/') || album.image.startsWith('media_assets/') 
    ? album.image 
    : `images/${album.image}`

  let songsHTML = ''
  if (songs && songs.length > 0) {
    songsHTML = `
      <div class="modal-songs-section">
        <h3 class="modal-songs-title">Track List</h3>
        <ul class="modal-songs-list">
          ${songs.map((song, index) => `
            <li class="modal-song-item">
              <span class="modal-song-track">${index + 1}</span>
              <span class="modal-song-title">${escapeHtml(song.title)}</span>
              <span class="modal-song-duration">${formatDuration(song.duration_seconds)}</span>
              ${song.is_explicit ? '<span class="modal-song-explicit">🔞</span>' : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `
  }

  const html = `
    <img src="./${imagePath}" alt="${escapeHtml(album.title)}" class="modal-album-image">
    <h2 class="modal-album-title">${escapeHtml(album.title)}</h2>
    <p class="modal-album-artist">by ${escapeHtml(album.artist)}</p>
    <p class="modal-album-year">${album.year || 'N/A'}</p>
    <p class="modal-album-price">$${parseFloat(album.price).toFixed(2)}</p>
    
    <div>
      ${album.genre ? `<span class="modal-album-genre">${escapeHtml(album.genre)}</span>` : ''}
      <span class="modal-album-type">${album.type || 'Product'}</span>
    </div>

    ${songsHTML}

    <button class="modal-add-cart-btn" data-album-id="${album.id}">Add to Cart</button>
  `

  modalBody.innerHTML = html

  // Attach add to cart listener
  const addCartBtn = modalBody.querySelector('.modal-add-cart-btn')
  addCartBtn.addEventListener('click', () => addAlbumToCart(album.id))
}

// ===== Add to Cart =====
async function addAlbumToCart(albumId) {
  try {
    const res = await fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ productId: albumId })
    })

    if (!res.ok) {
      // Not logged in, redirect to login
      window.location.href = '/login.html'
      return
    }

    // Close modal and show success
    closeModal()
    alert('Album added to cart!')
  } catch (err) {
    console.error('Error adding to cart:', err)
    alert('Error adding album to cart')
  }
}

// ===== Modal Controls =====
function openModal(album) {
  renderAlbumDetails(album)
  modalOverlay.classList.add('active')
  document.body.style.overflow = 'hidden' // Prevent scrolling
}

function closeModal() {
  modalOverlay.classList.remove('active')
  document.body.style.overflow = 'auto'
  modalBody.innerHTML = ''
}

// ===== Event Listeners =====
modalClose.addEventListener('click', closeModal)

// Close on overlay click (not modal content)
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    closeModal()
  }
})

// Close on ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
    closeModal()
  }
})

// ===== Attach Click Listeners to Product Cards =====
export function initAlbumModal() {
  // Use event delegation to handle dynamically loaded products
  document.addEventListener('click', async (e) => {
    // Only handle clicks on IMG elements in product cards
    if (e.target.tagName !== 'IMG') return
    
    const productCard = e.target.closest('.product-card')
    if (!productCard) return

    // Get album ID from the add-btn in this card
    const addBtn = productCard.querySelector('.add-btn')
    if (!addBtn) return

    const albumId = parseInt(addBtn.dataset.id, 10)
    if (isNaN(albumId)) return

    // Fetch and display album details
    const album = await fetchAlbumDetails(albumId)
    if (album) {
      openModal(album)
    }
  })
}

// Export for external use
window.openAlbumModal = openModal
window.closeAlbumModal = closeModal
