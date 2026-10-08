import { authRouteHandlers } from '@modules/auth';

// `pg` needs Node APIs. With `cacheComponents` every route runs on Node and the
// `runtime` segment option is rejected, so there is nothing to declare here.
export const { GET, POST } = authRouteHandlers;
