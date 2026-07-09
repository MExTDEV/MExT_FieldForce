import { NextResponse } from "next/server";

export type ApiErrorPayload = {
  error: string;
  requestId: string;
  details?: string;
};

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export function badRequest(message: string): never {
  throw new ApiRequestError(message, 400);
}

export function unauthorized(message = "Aanmelden is vereist."): never {
  throw new ApiRequestError(message, 401);
}

export function forbidden(message = "Je hebt onvoldoende rechten."): never {
  throw new ApiRequestError(message, 403);
}

export function notFound(message: string): never {
  throw new ApiRequestError(message, 404);
}

export async function handleApi<T>(
  scope: string,
  action: () => Promise<T>,
  fallbackMessage = "De aanvraag kon niet worden verwerkt."
) {
  const requestId = createRequestId();
  try {
    return NextResponse.json(await action());
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 500;
    const message = error instanceof ApiRequestError ? error.message : fallbackMessage;
    const details =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : undefined;
    console.error(`[${scope}] requestId=${requestId}`, error);
    return NextResponse.json<ApiErrorPayload>(
      { error: message, requestId, ...(details ? { details } : {}) },
      { status }
    );
  }
}

export async function handleApiCreated<T>(
  scope: string,
  action: () => Promise<T>,
  fallbackMessage = "De aanvraag kon niet worden verwerkt."
) {
  const response = await handleApi(scope, action, fallbackMessage);
  if (response.status === 200) {
    const body = await response.json();
    return NextResponse.json(body, { status: 201 });
  }
  return response;
}

function createRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
