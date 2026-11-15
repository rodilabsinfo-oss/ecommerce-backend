import { Router } from 'express';
import { publicCache } from '../../lib/http-cache.js';
import { validate } from '../../middleware/validate.js';
import { getCategoryTree, getProductBySlug, getProductFacets, listProducts } from './catalog.queries.js';
import {
  type FacetsQuery,
  type ListProductsQuery,
  facetsQuery,
  listProductsQuery,
  slugParams,
} from './catalog.schemas.js';

export const catalogRoutes = Router();

catalogRoutes.get('/categories', publicCache(), async (req, res) => {
  res.json({ data: await getCategoryTree(req.store.id, req.lang) });
});

catalogRoutes.get('/products', publicCache(), validate({ query: listProductsQuery }), async (req, res) => {
  const query = res.locals.input.query as ListProductsQuery;
  res.json(await listProducts(req.store.id, query, req.lang));
});

// Must come before /products/:slug.
catalogRoutes.get('/products/facets', publicCache(), validate({ query: facetsQuery }), async (req, res) => {
  const query = res.locals.input.query as FacetsQuery;
  res.json({ data: await getProductFacets(req.store.id, query) });
});

catalogRoutes.get('/products/:slug', publicCache(), validate({ params: slugParams }), async (req, res) => {
  const { slug } = res.locals.input.params as { slug: string };
  res.json({ data: await getProductBySlug(req.store.id, slug, req.lang) });
});
