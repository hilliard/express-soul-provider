import { logout } from './logout.js'
import { checkAuth, renderGreeting, showHideMenuItems } from './authUI.js'
import { loadCart, removeItem, removeAll, applyCoupon, checkout } from './cartService.js'
import { showConfirm } from './modal.js'

const dom = {
  checkoutBtn: document.getElementById('checkout-btn'),
  clearCartBtn: document.getElementById('clear-cart-btn'),
  userMessage: document.getElementById('user-message'),
  cartList: document.getElementById('cart-list'),
  subtotalAmount: document.getElementById('subtotal-amount'),
  discountAmount: document.getElementById('discount-amount'),
  discountLine: document.getElementById('discount-line'),
  taxAmount: document.getElementById('tax-amount'),
  totalAmount: document.getElementById('total-amount'),
  couponInput: document.getElementById('coupon-input'),
  applyCouponBtn: document.getElementById('apply-coupon-btn'),
  couponMessage: document.getElementById('coupon-message')
}

document.getElementById('logout-btn').addEventListener('click', logout)

// Remove item from cart
dom.cartList.addEventListener('click', event => {
  if (event.target.matches('.remove-btn')) {
    removeItem(event.target.dataset.id, dom)
  }
})

// Apply coupon
dom.applyCouponBtn.addEventListener('click', () => {
  applyCoupon(dom)
})

// Allow Enter key to apply coupon
dom.couponInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    applyCoupon(dom)
  }
})

// Clear cart
dom.clearCartBtn.addEventListener('click', async () => {
  const confirmed = await showConfirm(
    'Clear Cart',
    'Are you sure you want to remove all items from your cart?'
  )
  if (confirmed) {
    removeAll(dom)
  }
})

// Checkout
dom.checkoutBtn.addEventListener('click', () => {
  checkout(dom)
})

async function init() {
  await loadCart(dom)
  const name = await checkAuth()
  renderGreeting(name)
  showHideMenuItems(name)
} 
 
init()
