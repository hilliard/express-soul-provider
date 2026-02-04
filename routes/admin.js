import express from 'express'
import { 
  getAllUsers, 
  getUserDetails, 
  updateUser, 
  updateUserEmail,
  assignRole, 
  revokeRole,
  getAvailableRoles 
} from '../controllers/adminController.js'
import { requirePermission } from '../middleware/requireAuth.js'

export const adminRouter = express.Router()

// Middleware: Check if user is admin
const requireAdmin = requirePermission('users.manage')

// Get all users
adminRouter.get('/users', requireAdmin, getAllUsers)

// Get user details
adminRouter.get('/users/:humanId', requireAdmin, getUserDetails)

// Update user info
adminRouter.put('/users/:humanId', requireAdmin, updateUser)

// Update user email
adminRouter.put('/users/:humanId/email', requireAdmin, updateUserEmail)

// Assign role to user
adminRouter.post('/users/:humanId/roles', requireAdmin, assignRole)

// Revoke role from user
adminRouter.delete('/users/:humanId/roles', requireAdmin, revokeRole)

// Get all available roles
adminRouter.get('/roles', requireAdmin, getAvailableRoles)
