import { Router } from 'express'
import {
  getSongs,
  getSong,
  createSong,
  updateSong,
  deleteSong,
  linkSongToAlbum,
  unlinkSongFromAlbum
} from '../controllers/songsController.js'

export const songsRouter = Router()

// Get all songs (with optional filters)
songsRouter.get('/', getSongs)

// Get single song
songsRouter.get('/:id', getSong)

// Create new song
songsRouter.post('/', createSong)

// Update song
songsRouter.put('/:id', updateSong)

// Delete song
songsRouter.delete('/:id', deleteSong)

// Link song to album
songsRouter.post('/:id/album/:albumId', linkSongToAlbum)

// Unlink song from album
songsRouter.delete('/:id/album/:albumId', unlinkSongFromAlbum)
