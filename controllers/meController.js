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

    res.json({ isLoggedIn: true, name: human.name})

  } catch (err) {
    console.error('getCurrentUser error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
} 