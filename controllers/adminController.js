import { getDBConnection } from '../db/db.js'

/**
 * Get all users (humans with their roles)
 * Admin only
 */
export async function getAllUsers(req, res) {
  const db = await getDBConnection()
  try {
    const users = await db.all(`
      SELECT 
        h.id,
        h.first_name,
        h.last_name,
        h.first_name || ' ' || h.last_name AS full_name,
        h.is_active,
        h.phone_number,
        h.created_at,
        GROUP_CONCAT(sr.role_name) as roles,
        c.username as customer_username,
        a.stage_name as artist_stage_name,
        e.job_title,
        eh.email
      FROM humans h
      LEFT JOIN human_site_roles hsr ON h.id = hsr.human_id
      LEFT JOIN site_roles sr ON hsr.site_role_id = sr.id
      LEFT JOIN customers c ON h.id = c.human_id
      LEFT JOIN artists a ON h.id = a.human_id
      LEFT JOIN employees e ON h.id = e.human_id
      LEFT JOIN email_history eh ON h.id = eh.human_id AND eh.effective_to IS NULL
      GROUP BY h.id
      ORDER BY h.created_at DESC
    `)

    res.json(users)
  } catch (err) {
    console.error('Error fetching users:', err)
    res.status(500).json({ error: 'Failed to fetch users' })
  } finally {
    await db.close()
  }
}

/**
 * Get single user details
 */
export async function getUserDetails(req, res) {
  const db = await getDBConnection()
  try {
    const humanId = parseInt(req.params.humanId, 10)

    if (isNaN(humanId)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    const human = await db.get(`
      SELECT 
        h.id,
        h.first_name,
        h.last_name,
        h.phone_number,
        h.is_active,
        h.created_at,
        h.updated_at,
        GROUP_CONCAT(sr.role_name) as roles
      FROM humans h
      LEFT JOIN human_site_roles hsr ON h.id = hsr.human_id
      LEFT JOIN site_roles sr ON hsr.site_role_id = sr.id
      WHERE h.id = ?
      GROUP BY h.id
    `, [humanId])

    if (!human) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get current email
    const email = await db.get(`
      SELECT email FROM email_history
      WHERE human_id = ? AND effective_to IS NULL
    `, [humanId])

    // Get user roles with expiration
    const roleDetails = await db.all(`
      SELECT 
        sr.id,
        sr.role_name,
        hsr.assigned_at,
        hsr.expires_at
      FROM human_site_roles hsr
      JOIN site_roles sr ON hsr.site_role_id = sr.id
      WHERE hsr.human_id = ?
    `, [humanId])

    human.email = email?.email || null
    human.roleDetails = roleDetails
    human.roles = human.roles ? human.roles.split(',') : []

    res.json(human)
  } catch (err) {
    console.error('Error fetching user details:', err)
    res.status(500).json({ error: 'Failed to fetch user details' })
  } finally {
    await db.close()
  }
}

/**
 * Update user info (first_name, last_name, phone_number, is_active)
 */
export async function updateUser(req, res) {
  const db = await getDBConnection()
  try {
    const humanId = parseInt(req.params.humanId, 10)
    const { firstName, lastName, phoneNumber, isActive } = req.body

    if (isNaN(humanId)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    // Verify user exists
    const user = await db.get('SELECT id FROM humans WHERE id = ?', [humanId])
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Build dynamic update query
    const updates = []
    const params = []

    if (firstName !== undefined) {
      updates.push('first_name = ?')
      params.push(firstName.trim())
    }
    if (lastName !== undefined) {
      updates.push('last_name = ?')
      params.push(lastName.trim())
    }
    if (phoneNumber !== undefined) {
      updates.push('phone_number = ?')
      params.push(phoneNumber || null)
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?')
      params.push(isActive ? 1 : 0)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(humanId)

    const query = `UPDATE humans SET ${updates.join(', ')} WHERE id = ?`
    await db.run(query, params)

    res.json({ message: 'User updated successfully' })
  } catch (err) {
    console.error('Error updating user:', err)
    res.status(500).json({ error: 'Failed to update user' })
  } finally {
    await db.close()
  }
}

/**
 * Update user email (creates new email_history record)
 */
export async function updateUserEmail(req, res) {
  const db = await getDBConnection()
  try {
    const humanId = parseInt(req.params.humanId, 10)
    const { email } = req.body

    if (isNaN(humanId)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Verify user exists
    const user = await db.get('SELECT id FROM humans WHERE id = ?', [humanId])
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if email is already in use by another user
    const existingEmail = await db.get(`
      SELECT human_id FROM email_history
      WHERE email = ? AND effective_to IS NULL AND human_id != ?
    `, [email.trim(), humanId])

    if (existingEmail) {
      return res.status(400).json({ error: 'Email already in use' })
    }

    // Mark old email as inactive
    await db.run(`
      UPDATE email_history
      SET effective_to = CURRENT_TIMESTAMP
      WHERE human_id = ? AND effective_to IS NULL
    `, [humanId])

    // Add new email
    await db.run(`
      INSERT INTO email_history (human_id, email, effective_to, change_reason)
      VALUES (?, ?, NULL, 'admin_updated')
    `, [humanId, email.trim()])

    res.json({ message: 'Email updated successfully' })
  } catch (err) {
    console.error('Error updating user email:', err)
    res.status(500).json({ error: 'Failed to update email' })
  } finally {
    await db.close()
  }
}

/**
 * Assign role to user
 */
export async function assignRole(req, res) {
  const db = await getDBConnection()
  try {
    const humanId = parseInt(req.params.humanId, 10)
    const { roleName } = req.body

    if (isNaN(humanId)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    if (!roleName) {
      return res.status(400).json({ error: 'Role name required' })
    }

    // Verify user exists
    const user = await db.get('SELECT id FROM humans WHERE id = ?', [humanId])
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get role ID
    const role = await db.get('SELECT id FROM site_roles WHERE role_name = ?', [roleName])
    if (!role) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    // Check if user already has role
    const existing = await db.get(
      'SELECT * FROM human_site_roles WHERE human_id = ? AND site_role_id = ?',
      [humanId, role.id]
    )

    if (existing) {
      return res.status(400).json({ error: 'User already has this role' })
    }

    // Assign role
    await db.run(
      'INSERT INTO human_site_roles (human_id, site_role_id, assigned_by) VALUES (?, ?, ?)',
      [humanId, role.id, req.session.humanId]
    )

    res.status(201).json({ message: 'Role assigned successfully' })
  } catch (err) {
    console.error('Error assigning role:', err)
    res.status(500).json({ error: 'Failed to assign role' })
  } finally {
    await db.close()
  }
}

/**
 * Revoke role from user
 */
export async function revokeRole(req, res) {
  const db = await getDBConnection()
  try {
    const humanId = parseInt(req.params.humanId, 10)
    const { roleName } = req.body

    if (isNaN(humanId)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    if (!roleName) {
      return res.status(400).json({ error: 'Role name required' })
    }

    // Get role ID
    const role = await db.get('SELECT id FROM site_roles WHERE role_name = ?', [roleName])
    if (!role) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    const result = await db.run(
      'DELETE FROM human_site_roles WHERE human_id = ? AND site_role_id = ?',
      [humanId, role.id]
    )

    if (result.changes === 0) {
      return res.status(404).json({ error: 'User does not have this role' })
    }

    res.json({ message: 'Role revoked successfully' })
  } catch (err) {
    console.error('Error revoking role:', err)
    res.status(500).json({ error: 'Failed to revoke role' })
  } finally {
    await db.close()
  }
}

/**
 * Get all available roles
 */
export async function getAvailableRoles(req, res) {
  const db = await getDBConnection()
  try {
    const roles = await db.all(`
      SELECT id, role_name, description
      FROM site_roles
      ORDER BY role_name
    `)

    res.json(roles)
  } catch (err) {
    console.error('Error fetching roles:', err)
    res.status(500).json({ error: 'Failed to fetch roles' })
  } finally {
    await db.close()
  }
}
