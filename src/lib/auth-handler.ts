import { auth } from "./auth";

export const handleAuthRequest = async (request: Request) => {
  return auth.handler(request);
};
