import { addBtnListeners } from './cartService.js'

// ===== Rendering products =====

export function renderProducts(products) {
  const albumsContainer = document.getElementById('products-container')
  const cards = products.map((album) => {
    // Handle image path - if image already includes 'images/', don't add it again
    // Handle image path - if image already includes 'images/' or 'media_assets/', don't add prefix
    const imagePath = album.image.startsWith('images/') || album.image.startsWith('media_assets/') ? album.image : `images/${album.image}`;
    
    // Display 'Merch' for merchandise items instead of null genre
    const displayGenre = album.genre || (album.type === 'Merch' ? 'Merch' : 'Music')
    
    return `
      <div class="product-card">
        <img src="./${imagePath}" alt="${album.title}">
        <h2>${album.title}</h2>
        <h3>${album.artist}</h3>
        <p>$${album.price}</p>
        <button class="main-btn add-btn" data-id="${album.id}">Add to Cart</button>
        <p class="genre-label">${displayGenre}</p>
      </div>
    `
  }).join('')

  albumsContainer.innerHTML = cards
  addBtnListeners()
}

// ===== Handling filtering =====

export async function applySearchFilter() {
  const search = document.getElementById('search-input').value.trim()
  const filters = {}
  if (search) filters.search = search
  const products = await getProducts(filters)
  renderProducts(products)
}

