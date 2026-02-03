import express from 'express'
import { 
  getArtists, 
  getArtist, 
  createArtist, 
  updateArtist, 
  searchArtists 
} from '../controllers/artistsController.js'
import { requirePermission } from '../middleware/requireAuth.js'

export const artistsRouter = express.Router()

// Public routes
artistsRouter.get('/', getArtists)
artistsRouter.get('/search', searchArtists)
artistsRouter.get('/:id', getArtist)

// Protected routes (admin/artist only)
artistsRouter.post('/', requirePermission('artists.create'), createArtist)
artistsRouter.put('/:id', requirePermission('artists.update'), updateArtist)
