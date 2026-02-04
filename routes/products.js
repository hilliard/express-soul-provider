import express from 'express'
import { getGenres, getProducts, getSingleProduct, createProduct, updateProduct, deleteProduct } from '../controllers/productsController.js'
import { requirePermission } from '../middleware/requireAuth.js'

export const productsRouter = express.Router()

productsRouter.get('/genres', getGenres)
productsRouter.get('/', getProducts)
productsRouter.get('/:id', getSingleProduct)
productsRouter.post('/', requirePermission('products.create'), createProduct)
productsRouter.put('/:id', requirePermission('products.update'), updateProduct)
productsRouter.delete('/:id', requirePermission('products.delete'), deleteProduct)