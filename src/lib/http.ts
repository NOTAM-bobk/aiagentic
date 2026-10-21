import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export function handleError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.message, error.status, error.code);
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error("[kiln]", error);
  return fail(message, 500);
}

export function requireKey(name: string, value: string | undefined, code: string): string {
  if (!value) {
    throw new ApiError(
      `Missing ${name}. Add it in Vercel → Settings → Environment Variables (or .env.local) and redeploy.`,
      503,
      code,
    );
  }
  return value;
}
