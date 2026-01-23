// Check if user is logged in and has permissions
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me')
    const user = await res.json()
    
    if (!user.isLoggedIn) {
      window.location.href = '/login.html'
      return false
    }
    
    return true
  } catch (err) {
    console.error('Auth check failed:', err)
    window.location.href = '/login.html'
    return false
  }
}

// Toggle music-specific fields based on product type
function handleProductTypeChange() {
  const typeSelect = document.getElementById('type')
  const musicFields = document.querySelectorAll('.music-only')
  const yearInput = document.getElementById('year')
  const genreSelect = document.getElementById('genre')
  
  const isMusicProduct = ['Album', 'Single', 'EP'].includes(typeSelect.value)
  
  musicFields.forEach(field => {
    field.style.display = isMusicProduct ? 'flex' : 'none'
  })
  
  // Show/hide songs section
  const songsSection = document.getElementById('songs-section')
  if (songsSection) {
    songsSection.style.display = isMusicProduct ? 'block' : 'none'
  }
  
  // Update required attributes
  if (isMusicProduct) {
    yearInput.required = true
    genreSelect.required = true
  } else {
    yearInput.required = false
    genreSelect.required = false
    yearInput.value = ''
    genreSelect.value = ''
  }
}

// Song management
let songCount = 0

function addSongEntry() {
  songCount++
  const container = document.getElementById('songs-container')
  
  const songDiv = document.createElement('div')
  songDiv.className = 'song-entry'
  songDiv.dataset.songId = songCount
  
  songDiv.innerHTML = `
    <div class="song-entry-header">
      <h4>Track ${songCount}</h4>
      <button type="button" class="remove-song-btn" onclick="removeSong(${songCount})">Remove</button>
    </div>
    <div class="song-fields">
      <div class="form-group">
        <label>Track Number</label>
        <input type="number" name="songs[${songCount}][track_number]" value="${songCount}" min="1" required />
      </div>
      <div class="form-group">
        <label>Song Title *</label>
        <input type="text" name="songs[${songCount}][title]" required placeholder="Song title" />
      </div>
      <div class="form-group">
        <label>Duration (seconds)</label>
        <input type="number" name="songs[${songCount}][duration_seconds]" min="0" placeholder="e.g., 245" />
        <small>Optional - leave blank if unknown</small>
      </div>
      <div class="form-group">
        <label>Price (USD)</label>
        <input type="number" name="songs[${songCount}][individual_price]" step="0.01" value="0.99" min="0" />
      </div>
      <div class="form-group" style="grid-column: 1 / -1;">
        <label>Featured Artist (Optional)</label>
        <input type="text" name="songs[${songCount}][artist_override]" placeholder="e.g., feat. Jay-Z" />
        <small>Leave blank to use album artist</small>
      </div>
    </div>
  `
  
  container.appendChild(songDiv)
}

function removeSong(id) {
  const songEntry = document.querySelector(`[data-song-id="${id}"]`)
  if (songEntry) {
    songEntry.remove()
  }
}

// Make removeSong available globally
window.removeSong = removeSong

// Handle form submission
async function handleSubmit(event) {
  event.preventDefault()
  
  const form = event.target
  const submitBtn = form.querySelector('.submit-btn')
  const messageDiv = document.getElementById('message')
  
  // Disable submit button
  submitBtn.disabled = true
  submitBtn.textContent = 'Adding Product...'
  
  // Get form data
  const formData = new FormData(form)
  const type = formData.get('type')
  
  const productData = {
    title: formData.get('title'),
    artist: formData.get('artist'),
    price: parseFloat(formData.get('price')),
    image: formData.get('image'),
    type: type,
    stock: formData.get('stock') ? parseInt(formData.get('stock'), 10) : 12
  }
  
  // Only add year and genre for music products
  if (['Album', 'Single', 'EP'].includes(type)) {
    productData.year = parseInt(formData.get('year'), 10)
    productData.genre = formData.get('genre')
  }
  
  // Collect song data
  const songs = []
  const songEntries = document.querySelectorAll('.song-entry')
  
  songEntries.forEach((entry, index) => {
    const songId = entry.dataset.songId
    const trackNumber = formData.get(`songs[${songId}][track_number]`)
    const title = formData.get(`songs[${songId}][title]`)
    const durationSeconds = formData.get(`songs[${songId}][duration_seconds]`)
    const individualPrice = formData.get(`songs[${songId}][individual_price]`)
    const artistOverride = formData.get(`songs[${songId}][artist_override]`)
    
    if (title && title.trim()) {
      songs.push({
        track_number: parseInt(trackNumber) || (index + 1),
        title: title.trim(),
        duration_seconds: durationSeconds ? parseInt(durationSeconds) : null,
        individual_price: individualPrice ? parseFloat(individualPrice) : 0.99,
        artist_override: artistOverride && artistOverride.trim() ? artistOverride.trim() : null
      })
    }
  })
  
  if (songs.length > 0) {
    productData.songs = songs
  }
  
  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(productData)
    })
    
    const data = await res.json()
    
    if (res.ok) {
      // Success - show confirmation with product details
      const productType = productData.type
      const songInfo = songs.length > 0 ? ` with ${songs.length} track${songs.length > 1 ? 's' : ''}` : ''
      
      messageDiv.innerHTML = `
        <div class="message success-message">
          <h3 style="margin-top: 0;">✓ Product Successfully Added!</h3>
          <p><strong>${productType}: ${productData.title}</strong></p>
          <p>by ${productData.artist}</p>
          <p>Product ID: ${data.productId}${songInfo}</p>
          <p style="margin-bottom: 0;">Redirecting to home page in 3 seconds...</p>
        </div>
      `
      form.reset()
      
      // Clear songs container
      document.getElementById('songs-container').innerHTML = ''
      songCount = 0
      
      // Scroll to message
      messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      
      // Redirect to home after 3 seconds
      setTimeout(() => {
        window.location.href = '/'
      }, 3000)
    } else {
      // Error from server
      messageDiv.innerHTML = `<div class="message error-message">${data.error || 'Failed to add product'}</div>`
    }
  } catch (err) {
    console.error('Error adding product:', err)
    messageDiv.innerHTML = `<div class="message error-message">Network error. Please try again.</div>`
  } finally {
    submitBtn.disabled = false
    submitBtn.textContent = 'Add Product'
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthenticated = await checkAuth()
  
  if (isAuthenticated) {
    const form = document.getElementById('add-product-form')
    const typeSelect = document.getElementById('type')
    const addSongBtn = document.getElementById('add-song-btn')
    
    form.addEventListener('submit', handleSubmit)
    typeSelect.addEventListener('change', handleProductTypeChange)
    addSongBtn.addEventListener('click', addSongEntry)
    
    // Set initial state
    handleProductTypeChange()
  }
})

