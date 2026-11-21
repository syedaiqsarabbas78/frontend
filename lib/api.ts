export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError("The server could not be reached.", 0, "network_error");
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as { message?: string; code?: string }) : {};
  if (!response.ok) {
    throw new ApiError(data.message ?? "Request failed", response.status, data.code);
  }
  return data as T;
}
