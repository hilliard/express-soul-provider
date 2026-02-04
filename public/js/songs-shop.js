import { checkAuth, renderGreeting, showHideMenuItems } from './authUI.js'
import { logout } from './logout.js'

// ===== Menu Toggle =====
const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('.header-menu');

toggle.addEventListener('click', () => {
  menu.classList.toggle('open');
});

// ===== Song Fetching =====
/**
 * Fetches songs from the backend API
 * @param {object} filters - Optional filters like { search: 'term', genre: 'Soul' }
 * @returns {Promise<Array>} A promise that resolves to an array of songs
 */
async function getSongs(filters = {}) {
  try {
    const queryParams = new URLSearchParams(filters);
    const response = await fetch(`/api/songs?${queryParams}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch songs:', error);
    return [];
  }
}

// ===== Genre Fetching =====
/**
 * Get all unique genres from songs
 */
async function getGenres() {
  try {
    const songs = await getSongs();
    const genres = new Set();
    
    songs.forEach(song => {
      if (song.genre) {
        genres.add(song.genre);
      }
    });
    
    return Array.from(genres).sort();
  } catch (error) {
    console.error('Failed to fetch genres:', error);
    return [];
  }
}

// ===== Song Rendering =====
/**
 * Renders songs to the DOM
 * @param {Array} songs - The array of songs to display
 */
function renderSongs(songs) {
  const container = document.getElementById('songs-container');
  
  if (!songs || songs.length === 0) {
    container.innerHTML = '<p>No songs found.</p>';
    return;
  }

  const cards = songs
    .map((song) => {
      // Format duration
      const duration = song.duration_seconds ? formatDuration(song.duration_seconds) : 'N/A';
      
      // Get artist name
      const artist = song.artist_stage_name || song.artist_full_name || 'Unknown Artist';
      
      // Get album info
      const albumInfo = song.albums && song.albums.length > 0 
        ? `From: ${song.albums[0].title}`
        : 'Single Track';
      
      // Format price
      const price = song.individual_price ? `$${parseFloat(song.individual_price).toFixed(2)}` : 'Free';
      
      return `
        <div class="song-card">
          <div class="genre-label">${song.genre || 'Music'}</div>
          <h3>${escapeHtml(song.title)}</h3>
          <p class="artist">by ${escapeHtml(artist)}</p>
          <p class="meta">⏱️ ${duration}</p>
          <p class="album-info">${escapeHtml(albumInfo)}</p>
          ${song.is_explicit ? '<p class="meta">🔞 Explicit</p>' : ''}
          <p class="price">${price}</p>
          <button class="add-btn" data-song-id="${song.id}">Add to Cart</button>
        </div>
      `;
    })
    .join('');

  container.innerHTML = cards;
  
  // Attach event listeners
  attachCartButtonListeners();
}

// ===== Helper Functions =====
/**
 * Format seconds into MM:SS format
 */
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Add to Cart Functionality =====
/**
 * Attaches event listeners to all "Add to Cart" buttons
 */
function attachCartButtonListeners() {
  document.querySelectorAll('.add-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      const songId = event.currentTarget.dataset.songId;

      try {
        const res = await fetch('/api/cart/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            songId: parseInt(songId, 10)
          })
        });

        if (!res.ok) {
          // User not logged in, redirect to login
          window.location.href = '/login.html';
          return;
        }

        await updateCartIcon();
      } catch (err) {
        console.error('Error adding to cart:', err);
      }
    });
  });
}

// ===== Update Cart Icon =====
/**
 * Updates the cart icon badge with the current item count
 */
async function updateCartIcon() {
  try {
    const user = await checkAuth();
    
    if (!user) {
      document.getElementById('cart-banner').innerHTML = '';
      return;
    }
    
    const res = await fetch('/api/cart/cart-count', {
      credentials: 'include'
    });
    
    if (!res.ok) {
      document.getElementById('cart-banner').innerHTML = '';
      return;
    }
    
    const obj = await res.json();
    const totalItems = obj.totalItems;

    document.getElementById('cart-banner').innerHTML =
      totalItems > 0
        ? `<a href="/cart.html"><img src="images/cart.png" alt="cart">${totalItems}</a>`
        : '';
  } catch (err) {
    console.error('Error updating cart icon:', err);
    document.getElementById('cart-banner').innerHTML = '';
  }
}

// ===== Genre Dropdown =====
/**
 * Populates the genre dropdown with available genres
 */
async function populateGenreSelect() {
  try {
    const genres = await getGenres();
    const select = document.getElementById('genre-select');

    genres.forEach((genre) => {
      const option = document.createElement('option');
      option.value = genre;
      option.textContent = genre;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to populate genres:', error);
  }
}

// ===== Filter Handling =====
/**
 * Applies genre filter to songs
 */
async function applyGenreFilter() {
  const genre = document.getElementById('genre-select').value;
  const filters = genre ? { genre } : {};
  
  const songs = await getSongs(filters);
  renderSongs(songs);
}

// ===== Setup Event Listeners =====
function setupEventListeners() {
  const genreSelect = document.getElementById('genre-select');
  if (genreSelect) {
    genreSelect.addEventListener('change', applyGenreFilter);
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

// ===== Initial Page Load =====
/**
 * Initializes the page
 */
async function init() {
  // Check auth status and update UI
  const user = await checkAuth();
  renderGreeting(user);
  showHideMenuItems(user);
  
  // Only update cart icon if user is logged in
  if (user) {
    await updateCartIcon();
  }
  
  // Setup event listeners
  setupEventListeners();
  
  await populateGenreSelect();
  const songs = await getSongs();
  renderSongs(songs);
}

// Run initialization when script loads
init();
