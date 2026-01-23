import express from 'express'
import { getGenres, getProducts, createProduct } from '../controllers/productsController.js'
import { requirePermission } from '../middleware/requireAuth.js'

export const productsRouter = express.Router()

productsRouter.get('/genres', getGenres)
productsRouter.get('/', getProducts)
productsRouter.post('/', requirePermission('products.create'), createProduct)