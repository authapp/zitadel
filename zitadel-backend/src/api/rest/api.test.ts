import {
  InMemoryApiRouter,
  createApiRouter,
} from './router';
import {
  ApiRequest,
  Route,
  UnauthorizedError,
  ValidationError,
} from './types';

describe('InMemoryApiRouter', () => {
  let router: InMemoryApiRouter;

  beforeEach(() => {
    router = createApiRouter() as InMemoryApiRouter;
  });

  describe('register', () => {
    it('should register route', () => {
      const route: Route = {
        method: 'GET',
        path: '/users',
        handler: async () => ({ success: true, data: [] }),
      };

      router.register(route);

      const routes = router.getRoutes();
      expect(routes.length).toBe(1);
      expect(routes[0].method).toBe('GET');
      expect(routes[0].path).toBe('/users');
    });

    it('should register multiple routes', () => {
      router.register({
        method: 'GET',
        path: '/users',
        handler: async () => ({ success: true }),
      });

      router.register({
        method: 'POST',
        path: '/users',
        handler: async () => ({ success: true }),
      });

      const routes = router.getRoutes();
      expect(routes.length).toBe(2);
    });
  });

  describe('use', () => {
    it('should register global middleware', async () => {
      const middleware = jest.fn(async (_req, next) => next());

      router.use(middleware);

      router.register({
        method: 'GET',
        path: '/test',
        handler: async () => ({ success: true }),
      });

      const request: ApiRequest = {
        method: 'GET',
        path: '/test',
        headers: {},
        query: {},
        body: {},
      };

      await router.handle(request);

      expect(middleware).toHaveBeenCalled();
    });

    it('should execute multiple global middlewares in order', async () => {
      const order: number[] = [];

      router.use(async (_req, next) => {
        order.push(1);
        return next();
      });

      router.use(async (_req, next) => {
        order.push(2);
        return next();
      });

      router.register({
        method: 'GET',
        path: '/test',
        handler: async () => {
          order.push(3);
          return { success: true };
        },
      });

      const request: ApiRequest = {
        method: 'GET',
        path: '/test',
        headers: {},
        query: {},
        body: {},
      };

      await router.handle(request);

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('handle', () => {
    it('should handle request and return response', async () => {
      router.register({
        method: 'GET',
        path: '/users',
        handler: async () => ({
          success: true,
          data: [{ id: '1', name: 'User 1' }],
        }),
      });

      const request: ApiRequest = {
        method: 'GET',
        path: '/users',
        headers: {},
        query: {},
        body: {},
      };

      const response = await router.handle(request);

      expect(response.success).toBe(true);
      expect(response.data).toEqual([{ id: '1', name: 'User 1' }]);
      expect(response.metadata?.requestId).toBeDefined();
      expect(response.metadata?.timestamp).toBeInstanceOf(Date);
    });

    it('should return 404 for non-existent route', async () => {
      const request: ApiRequest = {
        method: 'GET',
        path: '/non-existent',
        headers: {},
        query: {},
        body: {},
      };

      const response = await router.handle(request);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('NOT_FOUND');
    });

    it('should execute route-specific middleware', async () => {
      const middleware = jest.fn(async (_req, next) => next());

      router.register({
        method: 'GET',
        path: '/protected',
        handler: async () => ({ success: true }),
        middlewares: [middleware],
      });

      const request: ApiRequest = {
        method: 'GET',
        path: '/protected',
        headers: {},
        query: {},
        body: {},
      };

      await router.handle(request);

      expect(middleware).toHaveBeenCalled();
    });

    it('should pass request through middleware chain', async () => {
      router.register({
        method: 'GET',
        path: '/test',
        handler: async (req) => ({
          success: true,
          data: (req.context as any)?.userId,
        }),
        middlewares: [
          async (req, next) => {
            (req as any).context = { userId: 'user123' };
            return next();
          },
        ],
      });

      const request: ApiRequest = {
        method: 'GET',
        path: '/test',
        headers: {},
        query: {},
        body: {},
      };

      const response = await router.handle(request);

      expect(response.data).toBe('user123');
    });

    it('should handle errors and convert to response', async () => {
      router.register({
        method: 'GET',
        path: '/error',
        handler: async () => {
          throw new UnauthorizedError('Access denied');
        },
      });

      const request: ApiRequest = {
        method: 'GET',
        path: '/error',
        headers: {},
        query: {},
        body: {},
      };

      const response = await router.handle(request);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('UNAUTHORIZED');
      expect(response.error?.message).toBe('Access denied');
    });

    it('should handle validation errors', async () => {
      router.register({
        method: 'POST',
        path: '/users',
        handler: async () => {
          throw new ValidationError('Validation failed', [
            { field: 'email', message: 'Invalid email' },
          ]);
        },
      });

      const request: ApiRequest = {
        method: 'POST',
        path: '/users',
        headers: {},
        query: {},
        body: {},
      };

      const response = await router.handle(request);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('VALIDATION_ERROR');
      expect(response.error?.details).toEqual([
        { field: 'email', message: 'Invalid email' },
      ]);
    });

    it('should add metadata to response', async () => {
      router.register({
        method: 'GET',
        path: '/test',
        handler: async () => ({ success: true }),
      });

      const request: ApiRequest = {
        method: 'GET',
        path: '/test',
        headers: {},
        query: {},
        body: {},
      };

      const response = await router.handle(request);

      expect(response.metadata).toBeDefined();
      expect(response.metadata?.requestId).toBeDefined();
      expect(response.metadata?.timestamp).toBeInstanceOf(Date);
      expect(response.metadata?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle generic errors', async () => {
      router.register({
        method: 'GET',
        path: '/error',
        handler: async () => {
          throw new Error('Something went wrong');
        },
      });

      const request: ApiRequest = {
        method: 'GET',
        path: '/error',
        headers: {},
        query: {},
        body: {},
      };

      const response = await router.handle(request);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('INTERNAL_ERROR');
      expect(response.error?.message).toBe('Something went wrong');
    });

    it('should match routes by method', async () => {
      router.register({
        method: 'GET',
        path: '/users',
        handler: async () => ({ success: true, data: 'GET' }),
      });

      router.register({
        method: 'POST',
        path: '/users',
        handler: async () => ({ success: true, data: 'POST' }),
      });

      const getRequest: ApiRequest = {
        method: 'GET',
        path: '/users',
        headers: {},
        query: {},
        body: {},
      };

      const postRequest: ApiRequest = {
        method: 'POST',
        path: '/users',
        headers: {},
        query: {},
        body: {},
      };

      const getResponse = await router.handle(getRequest);
      const postResponse = await router.handle(postRequest);

      expect(getResponse.data).toBe('GET');
      expect(postResponse.data).toBe('POST');
    });

    it('should stop middleware chain if middleware does not call next', async () => {
      const handler = jest.fn(async () => ({ success: true }));

      router.register({
        method: 'GET',
        path: '/blocked',
        handler,
        middlewares: [
          async () => ({
            success: false,
            error: { code: 'BLOCKED', message: 'Access blocked' },
          }),
        ],
      });

      const request: ApiRequest = {
        method: 'GET',
        path: '/blocked',
        headers: {},
        query: {},
        body: {},
      };

      const response = await router.handle(request);

      expect(response.success).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('getRoutes', () => {
    it('should return registered routes', () => {
      router.register({
        method: 'GET',
        path: '/users',
        handler: async () => ({ success: true }),
      });

      router.register({
        method: 'POST',
        path: '/users',
        handler: async () => ({ success: true }),
      });

      const routes = router.getRoutes();

      expect(routes.length).toBe(2);
      expect(routes[0].method).toBe('GET');
      expect(routes[1].method).toBe('POST');
    });

    it('should return empty array if no routes registered', () => {
      const routes = router.getRoutes();
      expect(routes).toEqual([]);
    });
  });
});
