import { NextRequest, NextResponse } from "next/server";
import { backendFetch, backendFetchJson, BackendError } from "@/lib/api/backend";
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

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const filename = formData.get("filename") as string;

  if (!file || !filename) {
    return NextResponse.json({ message: "File and filename are required." }, { status: 400 });
  }

  // Rebuild a fresh FormData — avoids multipart boundary corruption
  // when forwarding a parsed FormData through undici/fetch
  const freshForm = new FormData();
  freshForm.append("file", file);
  freshForm.append("filename", filename);

  try {
    const upstream = await backendFetch("/datasets/", {
      method: "POST",
      token,
      body: freshForm,
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { message: data?.detail?.[0]?.msg ?? data?.message ?? "Upload failed" },
        { status: upstream.status }
      );
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Upload failed" }, { status: 500 });
  }
}