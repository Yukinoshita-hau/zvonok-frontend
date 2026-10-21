import type { Middleware } from "@reduxjs/toolkit";
export const websocketMiddleware: Middleware = () => (next) => (action) =>
  next(action);
