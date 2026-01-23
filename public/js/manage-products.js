import { checkAuth, renderGreeting, showHideMenuItems } from './authUI.js'
import { logout } from './logout.js'
import { showConfirm, showAlert } from './modal.js'

document.getElementById('logout-btn').addEventListener('click', logout)

const searchInput = document.getElementById('search-input')
const typeFilter = document.getElementById('type-filter')
const productsList = document.getElementById('products-list')
const messageDiv = document.getElementById('message')

// Debounce search input
let searchTimeout
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => loadProducts(), 300)
})

typeFilter.addEventListener('change', () => loadProducts())

// Load and render products
async function loadProducts() {
  const search = searchInput.value.trim()
  const type = typeFilter.value
  
  const params = new URLSearchParams()
  if (search) params.append('search', search)
  if (type) params.append('type', type)
  
  try {
    const res = await fetch(`/api/products?${params}`)
    if (!res.ok) throw new Error('Failed to fetch products')
    
    const products = await res.json()
    renderProducts(products)
  } catch (err) {
    console.error('Error loading products:', err)
    productsList.innerHTML = `<tr><td colspan="8" class="error-message">Error loading products</td></tr>`
  }
}

function renderProducts(products) {
  if (!products || products.length === 0) {
    productsList.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem;">No products found</td></tr>`
    return
  }
  
  productsList.innerHTML = products.map(product => {
    const imagePath = product.image.startsWith('images/') ? product.image : `images/${product.image}`
    const displayType = product.type || 'Album'
    const displayGenre = product.genre || (product.type === 'Merch' ? 'N/A' : '')
    
    return `
      <tr data-product-id="${product.id}">
        <td>${product.id}</td>
        <td><img src="${imagePath}" alt="${product.title}" class="product-thumbnail"></td>
        <td>
          <strong>${product.title}</strong>
          ${displayGenre ? `<br><small class="genre-tag">${displayGenre}</small>` : ''}
        </td>
        <td>${product.artist}</td>
        <td><span class="type-badge type-${displayType.toLowerCase()}">${displayType}</span></td>
        <td>$${product.price.toFixed(2)}</td>
        <td>${product.stock || 0}</td>
        <td class="actions">
          <button class="btn-edit" data-id="${product.id}" title="Edit product">✏️</button>
          <button class="btn-delete" data-id="${product.id}" title="Delete product">🗑️</button>
        </td>
      </tr>
    `
  }).join('')
  
  attachEventListeners()
}

function attachEventListeners() {
  // Edit buttons
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = e.target.dataset.id
      // For now, redirect to add-product page with edit mode
      // TODO: Create edit functionality in add-product.js
      window.location.href = `/add-product.html?edit=${productId}`
    })
  })
  
  // Delete buttons
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const productId = e.target.dataset.id
      const row = e.target.closest('tr')
      const title = row.querySelector('strong').textContent
      
      await handleDelete(productId, title)
    })
  })
}

async function handleDelete(productId, productTitle) {
  const confirmed = await showConfirm(
    'Delete Product',
    `Are you sure you want to delete "${productTitle}"?\n\nThis action cannot be undone.`
  )
  
  if (!confirmed) return
  
  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    
    if (res.status === 204) {
      await showAlert('Success', `"${productTitle}" has been deleted.`)
      loadProducts() // Refresh list
    } else if (res.status === 403) {
      await showAlert('Permission Denied', 'You do not have permission to delete products.')
    } else if (res.status === 401) {
      await showAlert('Unauthorized', 'Please log in to delete products.')
      window.location.href = '/login.html'
    } else {
      const data = await res.json()
      console.error('Delete error:', data)
      await showAlert('Error', data.error || 'Failed to delete product')
    }
  } catch (err) {
    console.error('Error deleting product:', err)
    await showAlert('Error', `Network error: ${err.message}\n\nPlease check the console for details.`)
  }
}

// Initialize
async function init() {
  const user = await checkAuth()
  
  if (!user) {
    window.location.href = '/login.html'
    return
  }
  
  // Check if user has permission (admin or artist role)
  const roles = user.roles || []
  if (!roles.includes('admin') && !roles.includes('artist')) {
    await showAlert('Access Denied', 'You do not have permission to manage products.')
    window.location.href = '/'
    return
  }
  
  renderGreeting(user)
  showHideMenuItems(user)
  loadProducts()
}

init()
