import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const res = await backendFetch(`/datasets/${id}`, {
      method: "DELETE",
      token,
    });

    if (res.status === 404) {
      return NextResponse.json({ message: "Dataset not found." }, { status: 404 });
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { message: body?.detail ?? body?.message ?? "Delete failed" },
        { status: res.status }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Failed to delete dataset" }, { status: 500 });
  }
}