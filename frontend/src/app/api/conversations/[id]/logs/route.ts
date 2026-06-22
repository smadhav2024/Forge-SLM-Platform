import { proxyAuthenticatedGet } from "@/lib/api/proxy-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyAuthenticatedGet<string>(`/models/${id}/logs`);
}