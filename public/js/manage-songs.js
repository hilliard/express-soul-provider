import { checkAuth, renderGreeting, showHideMenuItems } from './authUI.js'

let currentSongId = null
let allSongs = []
let allAlbums = []

// Initialize page
async function init() {
  const user = await checkAuth()
  
  if (!user) {
    window.location.href = '/login.html'
    return
  }
  
  renderGreeting(user)
  showHideMenuItems(user)
  
  await loadAlbums()
  await loadSongs()
  
  // Add event listeners for interactive filtering
  document.getElementById('searchInput').addEventListener('input', loadSongs)
  document.getElementById('filterAlbum').addEventListener('change', loadSongs)
}

// Load all albums for the linking modal
async function loadAlbums() {
  try {
    const res = await fetch('/api/products?type=Album')
    if (!res.ok) throw new Error('Failed to load albums')
    
    allAlbums = await res.json()
    
    // Populate album select in link modal
    const albumSelect = document.getElementById('albumSelect')
    albumSelect.innerHTML = '<option value="">Choose an album...</option>'
    
    allAlbums.forEach(album => {
      const option = document.createElement('option')
      option.value = album.id
      option.textContent = `${album.title} by ${album.artist}`
      albumSelect.appendChild(option)
    })
  } catch (err) {
    console.error('Error loading albums:', err)
  }
}

// Load songs based on filters
async function loadSongs() {
  const searchInput = document.getElementById('searchInput').value
  const filterAlbum = document.getElementById('filterAlbum').value
  
  try {
    let url = '/api/songs'
    const params = new URLSearchParams()
    
    if (searchInput) {
      params.append('search', searchInput)
    }
    
    if (filterAlbum === 'orphaned') {
      params.append('orphaned', 'true')
    }
    
    if (params.toString()) {
      url += '?' + params.toString()
    }
    
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to load songs')
    
    allSongs = await res.json()
    renderSongs()
    updateStats()
  } catch (err) {
    console.error('Error loading songs:', err)
    showMessage('Error loading songs: ' + err.message, 'error')
  }
}

// Render songs table
function renderSongs() {
  const container = document.getElementById('songsContainer')
  
  if (allSongs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📭 No songs found</p>
        <p>Create your first song or adjust your filters</p>
      </div>
    `
    return
  }
  
  const html = `
    <table class="songs-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Duration</th>
          <th>Price</th>
          <th>Albums</th>
          <th>Genre</th>
          <th>Explicit</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${allSongs.map(song => `
          <tr>
            <td><strong>${escapeHtml(song.title)}</strong></td>
            <td>${song.duration_seconds ? formatDuration(song.duration_seconds) : '—'}</td>
            <td>$${song.individual_price?.toFixed(2) || '0.99'}</td>
            <td>
              ${song.albums.length > 0 
                ? song.albums.map(album => `
                  <div class="album-pill">
                    <span>${escapeHtml(album.title)} (Track ${album.trackNumber})</span>
                    <span class="remove-album" onclick="unlinkFromAlbum(${song.id}, ${album.id})">×</span>
                  </div>
                `).join('')
                : '<span class="orphaned-badge">Orphaned</span>'
              }
            </td>
            <td>${song.genre || '—'}</td>
            <td>${song.is_explicit ? '<span class="explicit-badge">Explicit</span>' : '—'}</td>
            <td>
              <div class="song-actions">
                <button class="btn-secondary" onclick="openEditSongModal(${song.id})">Edit</button>
                <button class="btn-secondary" onclick="openLinkAlbumModal(${song.id})">Link Album</button>
                <button class="btn-danger" onclick="deleteSong(${song.id})">Delete</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
  
  container.innerHTML = html
}

// Update stats
function updateStats() {
  const totalSongs = allSongs.length
  const orphanedCount = allSongs.filter(s => s.albums.length === 0).length
  
  document.getElementById('totalSongs').textContent = totalSongs
  document.getElementById('orphanedCount').textContent = orphanedCount
}

// Open add song modal
function openAddSongModal() {
  currentSongId = null
  document.getElementById('modalTitle').textContent = 'Add New Song'
  document.getElementById('songForm').reset()
  document.getElementById('songModal').classList.add('active')
}

// Open edit song modal
async function openEditSongModal(songId) {
  try {
    const res = await fetch(`/api/songs/${songId}`)
    if (!res.ok) throw new Error('Failed to load song')
    
    const song = await res.json()
    
    currentSongId = songId
    document.getElementById('modalTitle').textContent = 'Edit Song'
    document.getElementById('songTitle').value = song.title
    document.getElementById('songDuration').value = song.duration_seconds || ''
    document.getElementById('songPrice').value = song.individual_price || 0.99
    document.getElementById('songGenre').value = song.genre || ''
    document.getElementById('songExplicit').checked = song.is_explicit
    
    document.getElementById('songModal').classList.add('active')
  } catch (err) {
    console.error('Error loading song:', err)
    showMessage('Error loading song: ' + err.message, 'error')
  }
}

// Close song modal
function closeSongModal() {
  document.getElementById('songModal').classList.remove('active')
  currentSongId = null
}

// Save song
async function saveSong(event) {
  event.preventDefault()
  
  const title = document.getElementById('songTitle').value.trim()
  const duration_seconds = parseInt(document.getElementById('songDuration').value) || null
  const individual_price = parseFloat(document.getElementById('songPrice').value) || 0.99
  const genre = document.getElementById('songGenre').value || null
  const is_explicit = document.getElementById('songExplicit').checked ? 1 : 0
  
  if (!title) {
    showMessage('Song title is required', 'error')
    return
  }
  
  try {
    const method = currentSongId ? 'PUT' : 'POST'
    const url = currentSongId ? `/api/songs/${currentSongId}` : '/api/songs'
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title,
        duration_seconds,
        individual_price,
        genre,
        is_explicit
      })
    })
    
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to save song')
    }
    
    showMessage(currentSongId ? 'Song updated successfully!' : 'Song created successfully!', 'success')
    closeSongModal()
    await loadSongs()
  } catch (err) {
    console.error('Error saving song:', err)
    showMessage('Error: ' + err.message, 'error')
  }
}

// Open link to album modal
function openLinkAlbumModal(songId) {
  currentSongId = songId
  document.getElementById('linkForm').reset()
  document.getElementById('trackNumber').value = 1
  document.getElementById('discNumber').value = 1
  document.getElementById('linkAlbumModal').classList.add('active')
}

// Close link modal
function closeLinkModal() {
  document.getElementById('linkAlbumModal').classList.remove('active')
  currentSongId = null
}

// Link song to album
async function linkSongToAlbum(event) {
  event.preventDefault()
  
  const albumId = document.getElementById('albumSelect').value
  const track_number = parseInt(document.getElementById('trackNumber').value) || 1
  const disc_number = parseInt(document.getElementById('discNumber').value) || 1
  
  if (!albumId) {
    showMessage('Please select an album', 'error')
    return
  }
  
  try {
    const res = await fetch(`/api/songs/${currentSongId}/album/${albumId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        track_number,
        disc_number
      })
    })
    
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to link song to album')
    }
    
    showMessage('Song linked to album successfully!', 'success')
    closeLinkModal()
    await loadSongs()
  } catch (err) {
    console.error('Error linking song:', err)
    showMessage('Error: ' + err.message, 'error')
  }
}

// Unlink song from album
async function unlinkFromAlbum(songId, albumId) {
  if (!confirm('Remove this song from the album?')) return
  
  try {
    const res = await fetch(`/api/songs/${songId}/album/${albumId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    
    if (res.status !== 204) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to unlink song')
    }
    
    showMessage('Song removed from album', 'success')
    await loadSongs()
  } catch (err) {
    console.error('Error unlinking song:', err)
    showMessage('Error: ' + err.message, 'error')
  }
}

// Delete song
async function deleteSong(songId) {
  if (!confirm('Are you sure you want to delete this song? This cannot be undone.')) return
  
  try {
    const res = await fetch(`/api/songs/${songId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    
    if (res.status !== 204) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to delete song')
    }
    
    showMessage('Song deleted successfully', 'success')
    await loadSongs()
  } catch (err) {
    console.error('Error deleting song:', err)
    showMessage('Error: ' + err.message, 'error')
  }
}

// Utility: Format duration in seconds to mm:ss
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Utility: Escape HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

// Show message
function showMessage(text, type = 'info') {
  const messageDiv = document.getElementById('message')
  messageDiv.innerHTML = `<div class="message ${type}">${text}</div>`
  setTimeout(() => {
    messageDiv.innerHTML = ''
  }, 5000)
}

// Make functions globally available
window.openAddSongModal = openAddSongModal
window.openEditSongModal = openEditSongModal
window.closeSongModal = closeSongModal
window.saveSong = saveSong
window.openLinkAlbumModal = openLinkAlbumModal
window.closeLinkModal = closeLinkModal
window.linkSongToAlbum = linkSongToAlbum
window.unlinkFromAlbum = unlinkFromAlbum
window.deleteSong = deleteSong
window.loadSongs = loadSongs

// Initialize on page load
init()
