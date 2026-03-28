import { auth } from "./auth.js";

export async function getSessionFromRequest(request) {
  return auth.api.getSession({
    headers: new Headers(request.headers)
  });
}

export async function requireSession(request, response) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Authentication required." });
    return null;
  }

  return session;
}
