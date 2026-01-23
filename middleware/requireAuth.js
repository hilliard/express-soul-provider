import { getDBConnection } from '../db/db.js'

export function requireAuth(req, res, next) {

  if (!req.session.humanId) {

    console.log('Access to protected route blocked')
    return res.status(401).json({ error: 'Unauthorized' })

  }

  next()
}

export function requirePermission(permissionName) {
  return async (req, res, next) => {
    if (!req.session.humanId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    try {
      const db = await getDBConnection()

      // Check if human has the required permission through any role
      const hasPermission = await db.get(
        `SELECT 1 FROM human_site_roles hsr
         JOIN site_role_permissions srp ON hsr.site_role_id = srp.site_role_id
         JOIN permissions p ON srp.permission_id = p.id
         WHERE hsr.human_id = ? 
         AND p.permission_name = ?
         AND (hsr.expires_at IS NULL OR hsr.expires_at > datetime('now'))`,
        [req.session.humanId, permissionName]
      )

      if (!hasPermission) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
      }

      next()
    } catch (err) {
      console.error('Permission check error:', err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}
