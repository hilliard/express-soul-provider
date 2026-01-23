// ===== Check if user is signed in =====
export async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me')

    if (!res.ok) {
      console.warn('Unexpected response:', res.status)
      return false
    } 
  
    const user = await res.json()
    if (!user.isLoggedIn) {
      return false
    }
    return { name: user.name, roles: user.roles || [] }

  } catch (err) {
    console.log(err, 'Auth check failed')
    return false 
  }
}

// ===== Greet user or guest =====

export function renderGreeting(user) {
  const greetingEl = document.getElementById('greeting')
  const name = user && user.name ? user.name : (typeof user === 'string' ? user : null)
  
  if (name) {
    greetingEl.textContent = name
  } else {
    greetingEl.textContent = 'Welcome, Guest!'
  }
}

// ===== Only display logout button if logged in, else display log in/sign in options =====

export function showHideMenuItems(user) {
  const isLoggedIn = user && (user.name || typeof user === 'string')
  document.getElementById('login').style.display = isLoggedIn ? 'none' : 'inline'
  document.getElementById('signup').style.display = isLoggedIn ? 'none' : 'inline'
  document.getElementById('logout-btn').style.display = isLoggedIn ? 'inline' : 'none'
}

// ===== Show add product button for admin/artist roles =====

export function showAddProductButton(user) {
  const addProductLink = document.getElementById('add-product-link')
  if (!addProductLink) return
  
  const roles = user && user.roles ? user.roles : []
  const canAddProducts = roles.includes('admin') || roles.includes('artist')
  
  addProductLink.style.display = canAddProducts ? 'inline-block' : 'none'
}
