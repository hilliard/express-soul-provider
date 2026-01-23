import { getDBConnection } from '../db/db.js'

export async function getCurrentUser(req, res) {
  try {
    const db = await getDBConnection()

    if (!req.session.humanId) {

      return res.json({ isLoggedIn: false })
      
    }

    const human = await db.get(
      `SELECT first_name || ' ' || last_name AS name 
       FROM humans WHERE id = ?`,
      [req.session.humanId]
    )

    // Get user's roles
    const roles = await db.all(
      `SELECT sr.role_name 
       FROM human_site_roles hsr
       JOIN site_roles sr ON hsr.site_role_id = sr.id
       WHERE hsr.human_id = ?
       AND (hsr.expires_at IS NULL OR hsr.expires_at > datetime('now'))`,
      [req.session.humanId]
    )

    const roleNames = roles.map(r => r.role_name)

    res.json({ isLoggedIn: true, name: human.name, roles: roleNames })

  } catch (err) {
    console.error('getCurrentUser error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
} 