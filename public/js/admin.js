import { checkAuth } from './authUI.js'
import { renderNavbar } from './menu.js'

let currentUserId = null
let allUsers = []
let availableRoles = []

// Check if user is admin
async function verifyAdminAccess() {
  const user = await checkAuth()
  if (!user || !user.roles || !user.roles.includes('admin')) {
    window.location.href = '/'
    return false
  }
  return true
}

// Load all users
async function loadUsers() {
  try {
    const res = await fetch('/api/admin/users', { credentials: 'include' })
    
    if (!res.ok) {
      showMessage('Failed to load users', 'error')
      return
    }

    const data = await res.json()
    // API returns array directly, not wrapped in {users: ...}
    const rawUsers = Array.isArray(data) ? data : (data.users || [])
    
    // Transform the data to match expected format
    allUsers = rawUsers.map(user => ({
      humanId: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email || '',
      phoneNumber: user.phone_number || '',
      isActive: user.is_active,
      roles: user.roles ? user.roles.split(',').filter(r => r) : []
    }))
    
    renderUsersTable(allUsers)
  } catch (err) {
    console.error('Error loading users:', err)
    showMessage('Error loading users', 'error')
  }
}

// Load available roles
async function loadAvailableRoles() {
  try {
    const res = await fetch('/api/admin/roles', { credentials: 'include' })
    
    if (!res.ok) {
      console.error('Failed to load roles')
      return
    }

    const data = await res.json()
    availableRoles = data.roles || []
  } catch (err) {
    console.error('Error loading roles:', err)
  }
}

// Render users table
function renderUsersTable(users) {
  const container = document.getElementById('usersContainer')
  
  if (!users || users.length === 0) {
    container.innerHTML = '<div class="no-users">No users found</div>'
    return
  }

  const tableHTML = `
    <table class="users-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Roles</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(user => `
          <tr data-user-id="${user.humanId}">
            <td>${user.firstName} ${user.lastName}</td>
            <td>${user.email}</td>
            <td>
              ${user.roles.map(role => `
                <span class="role-badge role-${role.toLowerCase()}">${role}</span>
              `).join('')}
            </td>
            <td class="${user.isActive ? 'status-active' : 'status-inactive'}">
              ${user.isActive ? 'Active' : 'Inactive'}
            </td>
            <td>
              <button class="btn btn-primary btn-sm edit-user-btn" data-user-id="${user.humanId}">
                Edit
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
  
  container.innerHTML = tableHTML
}

// Open user detail modal
async function openUserDetail(humanId) {
  try {
    const res = await fetch(`/api/admin/users/${humanId}`, { credentials: 'include' })
    
    if (!res.ok) {
      showDetailMessage('Failed to load user details', 'error')
      return
    }

    const data = await res.json()
    // Transform snake_case API response to camelCase
    const user = {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email || '',
      phoneNumber: data.phone_number || '',
      isActive: data.is_active,
      roles: data.roles ? (Array.isArray(data.roles) ? data.roles : data.roles.split(',').filter(r => r)) : []
    }
    
    currentUserId = humanId
    
    // Populate form
    document.getElementById('userDetailName').textContent = `${user.firstName} ${user.lastName}`
    document.getElementById('editFirstName').value = user.firstName
    document.getElementById('editLastName').value = user.lastName
    document.getElementById('editEmail').value = user.email
    document.getElementById('editPhone').value = user.phoneNumber || ''
    document.getElementById('editIsActive').checked = user.isActive
    
    // Populate current roles
    const rolesContainer = document.getElementById('currentRoles')
    rolesContainer.innerHTML = user.roles.map(role => `
      <div class="role-item">
        ${role}
        <span class="remove-role" data-role="${role}">×</span>
      </div>
    `).join('')
    
    // Attach role removal listeners
    rolesContainer.querySelectorAll('.remove-role').forEach(btn => {
      btn.addEventListener('click', () => {
        const role = btn.dataset.role
        revokeRole(currentUserId, role)
      })
    })
    
    // Populate role select (exclude current roles)
    const roleSelect = document.getElementById('roleSelect')
    roleSelect.innerHTML = '<option value="">-- Add Role --</option>'
    
    availableRoles.forEach(role => {
      if (!user.roles.includes(role.roleName)) {
        const option = document.createElement('option')
        option.value = role.roleName
        option.textContent = role.roleName
        roleSelect.appendChild(option)
      }
    })
    
    // Clear messages
    document.getElementById('detailMessage').classList.remove('show', 'success', 'error')
    
    // Show modal
    document.getElementById('userDetailModal').classList.add('active')
  } catch (err) {
    console.error('Error loading user details:', err)
    showMessage('Error loading user details', 'error')
  }
}

// Close modal
function closeUserDetail() {
  document.getElementById('userDetailModal').classList.remove('active')
  currentUserId = null
  document.getElementById('userEditForm').reset()
}

// Update user
async function updateUser(e) {
  e.preventDefault()
  
  if (!currentUserId) return

  const firstName = document.getElementById('editFirstName').value.trim()
  const lastName = document.getElementById('editLastName').value.trim()
  const email = document.getElementById('editEmail').value.trim()
  const phone = document.getElementById('editPhone').value.trim()
  const isActive = document.getElementById('editIsActive').checked

  if (!firstName || !lastName || !email) {
    showDetailMessage('First name, last name, and email are required', 'error')
    return
  }

  try {
    const res = await fetch(`/api/admin/users/${currentUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        firstName,
        lastName,
        phoneNumber: phone,
        isActive
      })
    })

    if (!res.ok) {
      const data = await res.json()
      showDetailMessage(data.error || 'Failed to update user', 'error')
      return
    }

    showDetailMessage('User updated successfully', 'success')
    
    // Update email separately if changed
    const currentUser = allUsers.find(u => u.humanId === currentUserId)
    if (currentUser && currentUser.email !== email) {
      await updateEmail(email)
    } else {
      // Reload users table
      setTimeout(() => {
        closeUserDetail()
        loadUsers()
      }, 1000)
    }
  } catch (err) {
    console.error('Error updating user:', err)
    showDetailMessage('Error updating user', 'error')
  }
}

// Update email
async function updateEmail(newEmail) {
  try {
    const res = await fetch(`/api/admin/users/${currentUserId}/email`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: newEmail })
    })

    if (!res.ok) {
      const data = await res.json()
      showDetailMessage(data.error || 'Failed to update email', 'error')
      return
    }

    showDetailMessage('User and email updated successfully', 'success')
    setTimeout(() => {
      closeUserDetail()
      loadUsers()
    }, 1000)
  } catch (err) {
    console.error('Error updating email:', err)
    showDetailMessage('Error updating email', 'error')
  }
}

// Assign role
async function assignRole() {
  const roleSelect = document.getElementById('roleSelect')
  const role = roleSelect.value.trim()

  if (!role || !currentUserId) {
    showDetailMessage('Please select a role', 'error')
    return
  }

  try {
    const res = await fetch(`/api/admin/users/${currentUserId}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ roleName: role })
    })

    if (!res.ok) {
      const data = await res.json()
      showDetailMessage(data.error || 'Failed to assign role', 'error')
      return
    }

    showDetailMessage('Role assigned successfully', 'success')
    
    // Reload user details
    setTimeout(() => {
      openUserDetail(currentUserId)
      loadUsers()
    }, 800)
  } catch (err) {
    console.error('Error assigning role:', err)
    showDetailMessage('Error assigning role', 'error')
  }
}

// Revoke role
async function revokeRole(userId, roleName) {
  try {
    const res = await fetch(`/api/admin/users/${userId}/roles`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ roleName })
    })

    if (!res.ok) {
      const data = await res.json()
      showDetailMessage(data.error || 'Failed to revoke role', 'error')
      return
    }

    showDetailMessage('Role revoked successfully', 'success')
    
    // Reload user details
    setTimeout(() => {
      openUserDetail(userId)
      loadUsers()
    }, 800)
  } catch (err) {
    console.error('Error revoking role:', err)
    showDetailMessage('Error revoking role', 'error')
  }
}

// Search users
function searchUsers() {
  const searchTerm = document.getElementById('userSearch').value.toLowerCase()
  
  if (!searchTerm) {
    renderUsersTable(allUsers)
    return
  }

  const filtered = allUsers.filter(user => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase()
    const email = user.email.toLowerCase()
    return fullName.includes(searchTerm) || email.includes(searchTerm)
  })

  renderUsersTable(filtered)
}

// Show message in main section
function showMessage(text, type) {
  const msg = document.getElementById('userMessage')
  msg.textContent = text
  msg.className = `message show ${type}`
  
  setTimeout(() => {
    msg.classList.remove('show')
  }, 4000)
}

// Show message in detail modal
function showDetailMessage(text, type) {
  const msg = document.getElementById('detailMessage')
  msg.textContent = text
  msg.className = `message show ${type}`
}

// Initialize
async function init() {
  const isAdmin = await verifyAdminAccess()
  if (!isAdmin) return

  // Render navbar for admin users
  await renderNavbar()

  await loadAvailableRoles()
  await loadUsers()

  // Event listeners
  document.getElementById('closeDetailBtn').addEventListener('click', closeUserDetail)
  document.getElementById('userEditForm').addEventListener('submit', updateUser)
  document.getElementById('addRoleBtn').addEventListener('click', assignRole)
  document.getElementById('userSearch').addEventListener('input', searchUsers)

  // Delegated event listener for edit buttons (more reliable)
  document.getElementById('usersContainer').addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-user-btn')) {
      const userId = parseInt(e.target.dataset.userId, 10)
      openUserDetail(userId)
    }
  })

  // Close modal when clicking outside
  document.getElementById('userDetailModal').addEventListener('click', (e) => {
    if (e.target.id === 'userDetailModal') {
      closeUserDetail()
    }
  })
}

// Start
init()
