import { NextRequest, NextResponse } from "next/server";
import { backendFetch, backendFetchJson, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";
import { API_URL } from "@/lib/config";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  try {
    const data = await backendFetchJson(`/conversations/${id}/documents`, { token });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof BackendError)
      return NextResponse.json({ message: err.message }, { status: err.status });
    return NextResponse.json({ message: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  // Read chunk params from the incoming client URL
  const url = new URL(req.url);
  const chunkSize = url.searchParams.get("chunk_size") ?? "500";
  const chunkOverlap = url.searchParams.get("chunk_overlap") ?? "50";

  try {
    // Parse multipart from client
    const formData = await req.formData();

    // Forward directly to FastAPI as a fresh FormData —
    // IMPORTANT: do NOT set Content-Type manually; fetch sets it with the correct
    // multipart boundary automatically when body is a FormData instance.
    const upstream = await fetch(
      `${API_URL}/conversations/${id}/documents?chunk_size=${chunkSize}&chunk_overlap=${chunkOverlap}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // No Content-Type here — browser/Node will add multipart + boundary
        },
        body: formData,
        cache: "no-store",
      }
    );

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const message =
        typeof data?.detail === "string"
          ? data.detail
          : data?.message ?? `Upload failed: ${upstream.status}`;
      return NextResponse.json({ message }, { status: upstream.status });
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    if (err instanceof BackendError)
      return NextResponse.json({ message: err.message }, { status: err.status });
    console.error("[documents POST] unexpected error:", err);
    return NextResponse.json({ message: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  try {
    const data = await backendFetchJson(`/conversations/${id}/documents`, {
      method: "DELETE",
      token,
    });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof BackendError)
      return NextResponse.json({ message: err.message }, { status: err.status });
    return NextResponse.json({ message: "Failed to clear documents" }, { status: 500 });
  }
}