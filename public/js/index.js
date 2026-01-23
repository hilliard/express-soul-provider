import { checkAuth, renderGreeting, showHideMenuItems, showAddProductButton, showManageProductsButton } from './authUI.js'
import { logout } from './logout.js'

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
      // Handle image path - if image already includes 'images/', don't add it again
      const imagePath = album.image.startsWith('images/') ? album.image : `images/${album.image}`;
      
      // Display 'Merch' for merchandise items instead of null genre
      const displayGenre = album.genre || (album.type === 'Merch' ? 'Merch' : 'Music');
      
      return `
      <div class="product-card">
        <img src="./${imagePath}" alt="${album.title}">
        <h2>${album.title}</h2>
        <h3>${album.artist}</h3>
        <p>$${album.price}</p>
        <button class="add-btn" data-product-id="${album.id}">Add to Cart</button>
        <p class="genre-label">${displayGenre}</p>
      </div>
    `;
    })
    .join('');

  albumsContainer.innerHTML = cards;
  
  // Attach event listeners to "Add to Cart" buttons
  attachCartButtonListeners();
}

// ===== Add to Cart Functionality =====
/**
 * Attaches event listeners to all "Add to Cart" buttons.
 */
function attachCartButtonListeners() {
  document.querySelectorAll('.add-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      const productId = event.currentTarget.dataset.productId;

      try {
        const res = await fetch('/api/cart/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ productId })
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
 * Updates the cart icon badge with the current item count.
 * Only makes the request if the user is logged in.
 */
async function updateCartIcon() {
  try {
    // Check if user is logged in first
    const user = await checkAuth()
    
    if (!user) {
      // Not logged in - clear cart icon
      document.getElementById('cart-banner').innerHTML = ''
      return
    }
    
    const res = await fetch('/api/cart/cart-count', {
      credentials: 'include'
    })
    
    if (!res.ok) {
      // Session expired or other error - clear cart icon
      document.getElementById('cart-banner').innerHTML = ''
      return
    }
    
    const obj = await res.json();
    const totalItems = obj.totalItems;

    document.getElementById('cart-banner').innerHTML =
      totalItems > 0
        ? `<a href="/cart.html"><img src="images/cart.png" alt="cart">${totalItems}</a>`
        : '';
  } catch (err) {
    console.error('Error updating cart icon:', err);
    document.getElementById('cart-banner').innerHTML = ''
  }
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
    
    // Add Merchandise option at the end
    const merchOption = document.createElement('option');
    merchOption.value = 'type:Merch';
    merchOption.textContent = 'Merchandise';
    select.appendChild(merchOption);
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
  const value = e.target.value;
  
  // Check if this is a type filter (for Merchandise)
  if (value.startsWith('type:')) {
    const type = value.replace('type:', '');
    console.log('Filtering by type:', type);
    const products = await getProducts({ type });
    console.log('Products returned:', products.length);
    renderProducts(products);
  } else {
    // Regular genre filter
    const filters = value ? { genre: value } : {};
    const products = await getProducts(filters);
    renderProducts(products);
  }
});

// ===== Logout =====
const logoutBtn = document.getElementById('logout-btn')
if (logoutBtn) {
  logoutBtn.addEventListener('click', logout)
}

// ===== Initial Page Load =====
/**
 * Fetches and displays all products on initial page load.
 */
async function init() {
  // Check auth status and update UI
  const user = await checkAuth()
  renderGreeting(user)
  showHideMenuItems(user)
  showAddProductButton(user)
  showManageProductsButton(user)
  
  // Only update cart icon if user is logged in
  if (user) {
    await updateCartIcon()
  }
  
  await populateGenreSelect();
  const products = await getProducts();
  renderProducts(products);
}

// Run the initialization function when the script loads
init();
