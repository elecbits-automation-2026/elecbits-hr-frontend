import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * One chunk per screen: route elements are loaded with a dynamic import so the
 * sign-in screen never pays for the HR consoles. The wait is covered by the
 * Suspense inside RouteScreen.
 */
export const lazyRoute = <T extends ComponentType<Record<string, never>>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> => lazy(factory);
