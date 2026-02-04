import { checkAuth } from './authUI.js'

// ===== Menu Toggle =====
const toggle = document.querySelector('.menu-toggle')
const menu = document.querySelector('.header-menu')

// Only add listener if elements exist (for pages that have a menu)
if (toggle && menu) {
  toggle.addEventListener('click', () => {
    menu.classList.toggle('open')
  })
}

// ===== Render navbar with admin link for admins =====
export async function renderNavbar() {
  const user = await checkAuth()
  const hasAdminRole = user && user.roles && user.roles.includes('admin')
  
  if (hasAdminRole) {
    // Create admin link in nav
    const nav = document.querySelector('.header-menu')
    if (nav && !nav.querySelector('#admin-dashboard-link')) {
      const adminLink = document.createElement('a')
      adminLink.id = 'admin-dashboard-link'
      adminLink.href = '/admin-dashboard.html'
      adminLink.textContent = 'Admin'
      
      // Insert after Shop Songs
      const shopSongsLink = nav.querySelector('a[href="/songs.html"]')
      if (shopSongsLink) {
        shopSongsLink.parentNode.insertBefore(adminLink, shopSongsLink.nextSibling)
      } else {
        nav.insertBefore(adminLink, nav.firstChild)
      }
    }
  }
}