// ===== Menu Toggle =====
const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('.header-menu');

toggle.addEventListener('click', () => {
  menu.classList.toggle('open');
});

// ===== Product Fetching (API Bridge) =====
/**
 * Fetches products from the backend API.
 * This is the ONLY place that should communicate with the server.
 * @param {object} filters - Optional filters like { search: 'term', genre: 'RnB' }
 * @returns {Promise<Array>} A promise that resolves to an array of products.
 */
async function getProducts(filters = {}) {
  try {
    const queryParams = new URLSearchParams(filters);
    const response = await fetch(`/api/products?${queryParams}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch products:', error);
    // Return an empty array in case of an error so the UI doesn't break
    return [];
  }
}

// ===== Product Rendering =====
/**
 * Renders an array of product objects to the DOM.
 * @param {Array} products - The array of products to display.
 */
function renderProducts(products) {
  const albumsContainer = document.getElementById('products-container');
  if (!products || products.length === 0) {
    albumsContainer.innerHTML = '<p>No products found.</p>';
    return;
  }

  const cards = products
    .map((album) => {
      return `
      <div class="product-card">
        <img src="./images/${album.image}" alt="${album.title}">
        <h2>${album.title}</h2>
        <h3>${album.artist}</h3>
        <p>$${album.price}</p>
        <button class="add-btn" data-product-id="${album.id}">Add to Cart</button>
        <p class="genre-label">${album.genre}</p>
      </div>
    `;
    })
    .join('');

  albumsContainer.innerHTML = cards;
}

// ===== Genre Dropdown =====
/**
 * Populates the genre dropdown with available genres from the API.
 */
async function populateGenreSelect() {
  try {
    const response = await fetch('/api/products/genres');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const genres = await response.json();
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
 * Fetches and renders products based on the current search input.
 */
async function applySearchFilter() {
  const search = document.getElementById('search-input').value.trim();
  const filters = {};
  if (search) {
    filters.search = search;
  }

  const products = await getProducts(filters);
  renderProducts(products);
}

// ===== Event Listeners =====
document.getElementById('search-input').addEventListener('input', applySearchFilter);

document.querySelector('form').addEventListener('submit', (e) => {
  e.preventDefault();
  applySearchFilter();
});

document.getElementById('genre-select').addEventListener('change', async (e) => {
  const genre = e.target.value;
  // If the genre is empty (e.g., "All Genres" is selected), fetch all products
  const filters = genre ? { genre } : {};
  const products = await getProducts(filters);
  renderProducts(products);
});

// ===== Initial Page Load =====
/**
 * Fetches and displays all products on initial page load.
 */
async function init() {
  await populateGenreSelect();
  const products = await getProducts();
  renderProducts(products);
}

// Run the initialization function when the script loads
init();
