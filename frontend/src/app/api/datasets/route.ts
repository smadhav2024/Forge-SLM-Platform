import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";
import { proxyAuthenticatedGet } from "@/lib/api/proxy-helpers";
import type { DatasetSummary } from "@/types/api";

export async function GET() {
  return proxyAuthenticatedGet<DatasetSummary[]>("/datasets/");
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: "Invalid upload form." }, { status: 400 });
  }

  const file = formData.get("file");
  const filenameValue = formData.get("filename");
  const filename = typeof filenameValue === "string" ? filenameValue.trim() : "";

  if (!(file instanceof File) || !filename) {
    return NextResponse.json(
      { message: "File and filename are required." },
      { status: 400 }
    );
  }

  // Rebuild fresh FormData — forwarding a parsed FormData directly
  // corrupts the multipart boundary in Node's fetch implementation
  const freshForm = new FormData();
  freshForm.append("file", file, file.name);
  freshForm.append("filename", filename);

  try {
    const upstream = await backendFetch("/datasets/", {
      method: "POST",
      token,
      body: freshForm,
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      // Surface JSONL validation errors from the backend's 422 detail
      const detail = data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : detail?.message ?? "Upload failed";
      return NextResponse.json({ message }, { status: upstream.status });
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Upload failed" }, { status: 500 });
  }
}
