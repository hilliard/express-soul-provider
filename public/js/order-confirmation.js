import { checkAuth, renderGreeting, showHideMenuItems } from './authUI.js'
import { logout } from './logout.js'
import { showAlert } from './modal.js'

// Get coupon code from URL parameter
const urlParams = new URLSearchParams(window.location.search)
const couponCode = urlParams.get('coupon')

// DOM elements
const loading = document.getElementById('loading')
const orderDetails = document.getElementById('order-details')
const messageDiv = document.getElementById('message')
const orderItemsList = document.getElementById('order-items-list')
const couponSection = document.getElementById('coupon-section')
const couponDescription = document.getElementById('coupon-description')
const discountRow = document.getElementById('discount-row')
const subtotalEl = document.getElementById('subtotal')
const discountEl = document.getElementById('discount')
const taxEl = document.getElementById('tax')
const totalEl = document.getElementById('total')
const backBtn = document.getElementById('back-btn')
const confirmBtn = document.getElementById('confirm-btn')

// Logout
document.getElementById('logout-btn').addEventListener('click', logout)

// Back to cart
backBtn.addEventListener('click', () => {
  window.location.href = '/cart.html'
})

// Confirm order
confirmBtn.addEventListener('click', async () => {
  confirmBtn.disabled = true
  confirmBtn.textContent = 'Processing...'

  try {
    const res = await fetch('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ couponCode })
    })

    const data = await res.json()

    if (res.ok) {
      // Show success modal and redirect
      await showAlert(
        '✓ Order Placed Successfully!',
        `Order ${data.orderNumber} has been placed.\n\nThank you for your purchase!`
      )
      
      window.location.href = '/'
    } else {
      messageDiv.innerHTML = `<div class="message error-message">${data.error || 'Order failed'}</div>`
      confirmBtn.disabled = false
      confirmBtn.textContent = 'Confirm & Place Order'
    }
  } catch (err) {
    console.error('Error creating order:', err)
    messageDiv.innerHTML = `<div class="message error-message">Error processing order. Please try again.</div>`
    confirmBtn.disabled = false
    confirmBtn.textContent = 'Confirm & Place Order'
  }
})

// Load order preview
async function loadOrderPreview() {
  try {
    const res = await fetch('/api/checkout/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ couponCode })
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to load order preview')
    }

    const preview = await res.json()

    // Render order items
    orderItemsList.innerHTML = preview.items.map(item => `
      <li class="order-item">
        <div class="item-details">
          <div class="item-title">${item.title}</div>
          <div class="item-artist">${item.artist || 'Unknown Artist'}</div>
          <div class="item-quantity">Quantity: ${item.quantity}</div>
        </div>
        <div class="item-price">$${(item.price * item.quantity).toFixed(2)}</div>
      </li>
    `).join('')

    // Display coupon info if applied
    if (preview.coupon) {
      couponDescription.textContent = `${preview.coupon.description} (${preview.coupon.code})`
      couponSection.style.display = 'block'
    }

    // Display summary
    subtotalEl.textContent = `$${preview.subtotal.toFixed(2)}`
    taxEl.textContent = `$${preview.tax.toFixed(2)}`
    totalEl.textContent = `$${preview.total.toFixed(2)}`

    if (preview.discount > 0) {
      discountEl.textContent = `-$${preview.discount.toFixed(2)}`
      discountRow.style.display = 'flex'
    }

    // Show order details, hide loading
    loading.style.display = 'none'
    orderDetails.style.display = 'block'

  } catch (err) {
    console.error('Error loading order preview:', err)
    loading.style.display = 'none'
    messageDiv.innerHTML = `<div class="message error-message">${err.message}</div>`
    
    setTimeout(() => {
      window.location.href = '/cart.html'
    }, 2000)
  }
}

// Initialize
async function init() {
  const user = await checkAuth()
  
  if (!user) {
    window.location.href = '/login.html'
    return
  }

  renderGreeting(user)
  showHideMenuItems(user)
  
  await loadOrderPreview()
}

init()
