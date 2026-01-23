export function addBtnListeners() {
  document.querySelectorAll('.add-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      const albumId = event.currentTarget.dataset.id

      try {
        const res = await fetch('/api/cart/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ productId: albumId })
        })

        if (!res.ok) {
          return window.location.href = '/login.html'
        }

        await updateCartIcon()
      } catch (err) {
        console.error('Error adding to cart:', err)
      }
    })
  })
}

export async function updateCartIcon() {
  try {
    const res = await fetch('/api/cart/cart-count')
    const obj = await res.json()
    const totalItems = obj.totalItems

    document.getElementById('cart-banner').innerHTML =
      totalItems > 0
        ? `<a href="/cart.html"><img src="images/cart.png" alt="cart">${totalItems}</a>`
        : ''
  } catch (err) {
    console.error('Error updating cart icon:', err)
  }
}

let currentCouponCode = null

export async function loadCart(dom) {
  const { checkoutBtn, userMessage, cartList } = dom

  try {
    const items = await fetchCartItems(dom)
    renderCartItems(items, cartList)
    await updateOrderPreview(dom)
  } catch (err) {
    console.error('Error loading cart:', err)
    cartList.innerHTML = '<li>Error loading cart data.</li>'
  }
}

async function fetchCartItems({ userMessage, checkoutBtn }) {
  const res = await fetch('/api/cart/', { credentials: 'include' })

  if (!res.ok) {
    window.location.href = '/'
    checkoutBtn.disabled = true
    checkoutBtn.classList.add('disabled')
    userMessage.innerHTML = 'Please <a href="login.html">log in</a>.'
    return []
  }

  const { items } = await res.json()
  return items
}

function renderCartItems(items, cartList) {
  cartList.innerHTML = ''

  if (!items || items.length === 0) {
    cartList.innerHTML = '<li class="empty-cart">Your cart is empty</li>'
    return
  }

  items.forEach(item => {
    const li = document.createElement('li')
    li.className = 'cart-item'

    const itemTotal = item.price * item.quantity

    li.innerHTML = `
      <div>
        <strong>${item.title}</strong> by ${item.artist}
        <button data-id="${item.cartItemId}" class="remove-btn">🗑️</button>
      </div>
      <span>× ${item.quantity} = $${itemTotal.toFixed(2)}</span>
    `

    cartList.appendChild(li)
  })
}

async function updateOrderPreview(dom) {
  const { subtotalAmount, discountAmount, discountLine, taxAmount, totalAmount, checkoutBtn } = dom

  try {
    const res = await fetch('/api/checkout/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ couponCode: currentCouponCode })
    })

    if (!res.ok) {
      checkoutBtn.disabled = true
      return
    }

    const preview = await res.json()

    subtotalAmount.textContent = `$${preview.subtotal.toFixed(2)}`
    taxAmount.textContent = `$${preview.tax.toFixed(2)}`
    totalAmount.textContent = `$${preview.total.toFixed(2)}`

    if (preview.discount > 0) {
      discountAmount.textContent = `-$${preview.discount.toFixed(2)}`
      discountLine.style.display = 'flex'
    } else {
      discountLine.style.display = 'none'
    }

    checkoutBtn.disabled = preview.total <= 0

  } catch (err) {
    console.error('Error updating preview:', err)
  }
}

export async function removeItem(itemId, dom) {
  try {
    const res = await fetch(`/api/cart/${itemId}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (res.status === 204) {
      await loadCart(dom)
    } else {
      console.error('Error removing item:', await res.text())
    }
  } catch (err) {
    console.error('Error removing item:', err)
  }
}

export async function removeAll(dom) {
  try {
    const res = await fetch(`/api/cart/all`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (res.status === 204) {
      await loadCart(dom)
    } else {
      console.error('Error clearing cart:', await res.text())
    }
  } catch (err) {
    console.error('Error clearing cart:', err)
  }
}

export async function applyCoupon(dom) {
  const { couponInput, couponMessage, applyCouponBtn } = dom
  const couponCode = couponInput.value.trim().toUpperCase()

  if (!couponCode) {
    couponMessage.textContent = 'Please enter a coupon code'
    couponMessage.className = 'coupon-message error'
    return
  }

  applyCouponBtn.disabled = true
  couponMessage.textContent = 'Validating...'
  couponMessage.className = 'coupon-message'

  try {
    const res = await fetch('/api/checkout/validate-coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ couponCode })
    })

    const data = await res.json()

    if (res.ok) {
      currentCouponCode = couponCode
      couponMessage.textContent = `✓ ${data.description || 'Coupon applied'} (-$${data.discountAmount.toFixed(2)})`
      couponMessage.className = 'coupon-message success'
      couponInput.disabled = true
      applyCouponBtn.textContent = 'Applied'
      await updateOrderPreview(dom)
    } else {
      couponMessage.textContent = data.error || 'Invalid coupon code'
      couponMessage.className = 'coupon-message error'
    }
  } catch (err) {
    console.error('Error applying coupon:', err)
    couponMessage.textContent = 'Error validating coupon'
    couponMessage.className = 'coupon-message error'
  } finally {
    applyCouponBtn.disabled = false
  }
}

export async function checkout(dom) {
  // Redirect to order confirmation page with coupon if applied
  const url = currentCouponCode 
    ? `/order-confirmation.html?coupon=${encodeURIComponent(currentCouponCode)}`
    : '/order-confirmation.html'
  
  window.location.href = url
}
