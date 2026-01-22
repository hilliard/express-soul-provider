export async function logout() {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'GET',
      credentials: 'include'
    })
    
    if (res.ok) {
      window.location.href = '/'
    }
  } catch (err) {
    console.log('failed to log out', err)
    // Redirect anyway to prevent stuck state
    window.location.href = '/'
  }
}