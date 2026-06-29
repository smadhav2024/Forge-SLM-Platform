"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, User, Database, HardDrive, Settings, Key,
  ChevronRight, Save, Loader2, Eye, EyeOff, Copy, Check,
  Plus, Trash2, AlertTriangle, Terminal, RefreshCw, Activity,
  ShieldCheck, Zap,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Tienne } from "next/font/google";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useApiKeys, useCreateApiKey, useRevokeApiKey, useUpdateApiKey,
  type ApiKeyRow,
} from "@/lib/hooks/use-api-keys";

const tienne = Tienne({ subsets: ["latin"], weight: ["400", "700"] });

// ── Sidebar nav ────────────────────────────────────────────────────────────────

const NAV = [
  { id: "profile",  icon: User,      label: "Account" },
  { id: "models",   icon: Database,  label: "Model preferences" },
  { id: "storage",  icon: HardDrive, label: "Storage & paths" },
  { id: "api-keys", icon: Key,       label: "API keys" },
  { id: "general",  icon: Settings,  label: "General" },
] as const;

type Tab = (typeof NAV)[number]["id"];

const SECTION_LABELS: Record<Tab, string> = {
  profile:    "Account",
  models:     "Model preferences",
  storage:    "Storage & paths",
  "api-keys": "API keys",
  general:    "General",
};

// ── Primitives ─────────────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-5 border-b pb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PasswordInput({ placeholder }: { placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} placeholder={placeholder} className="pr-9" />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function SaveRow({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <Button size="sm" onClick={onClick} disabled={saving}>
        {saving ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
        ) : (
          <><Save className="h-3.5 w-3.5" /> Save changes</>
        )}
      </Button>
    </div>
  );
}

function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className={`rounded p-1 transition-colors hover:bg-secondary ${className ?? ""}`}
      title="Copy"
    >
      {copied
        ? <Check className="h-3.5 w-3.5 text-emerald-500" />
        : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ── Usage bar ──────────────────────────────────────────────────────────────────

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (!limit) {
    return (
      <span className="text-[10px] text-muted-foreground">
        {used.toLocaleString()} tokens used · unlimited
      </span>
    );
  }
  const pct = Math.min((used / limit) * 100, 100);
  const color =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-violet-500";
  return (
    <div className="flex flex-col gap-1">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground">
        {used.toLocaleString()} / {limit.toLocaleString()} tokens ({pct.toFixed(1)}%)
      </span>
    </div>
  );
}

// ── Key reveal dialog ──────────────────────────────────────────────────────────

function KeyRevealDialog({
  rawKey,
  onClose,
}: {
  rawKey: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Save your API key
          </DialogTitle>
          <DialogDescription>
            This key is shown <strong>only once</strong>. Copy it now and store
            it in a secure place — you will not be able to see it again.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <code className="flex-1 break-all text-xs text-violet-400 font-mono select-all">
            {rawKey}
          </code>
          <button
            onClick={copy}
            className="shrink-0 rounded p-1.5 hover:bg-secondary transition-colors"
          >
            {copied
              ? <Check className="h-4 w-4 text-emerald-500" />
              : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Use this key in the <code className="font-mono">Authorization</code> header:{" "}
          <code className="font-mono text-violet-400">Bearer {rawKey.slice(0, 16)}…</code>
        </p>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            I&apos;ve saved it — close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Revoke confirm dialog ──────────────────────────────────────────────────────

function RevokeDialog({
  keyName,
  onConfirm,
  onClose,
  loading,
}: {
  keyName: string;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" /> Revoke API key?
          </DialogTitle>
          <DialogDescription>
            Revoking <strong>&ldquo;{keyName}&rdquo;</strong> will immediately
            block all requests using this key. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Revoking…</> : "Revoke key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Developer docs ─────────────────────────────────────────────────────────────

const CODE_CURL = `curl https://YOUR_SERVER/v1/chat/completions \\
  -H "Authorization: Bearer sk-local-YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "model_1",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "max_tokens": 512
  }'`;

const CODE_PYTHON = `from openai import OpenAI

client = OpenAI(
    api_key="sk-local-YOUR_KEY",
    base_url="https://YOUR_SERVER/v1",
)

response = client.chat.completions.create(
    model="model_1",     # use model_<id> from /v1/models
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
)
print(response.choices[0].message.content)`;

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div className="relative rounded-lg border bg-[#0d0d0d] text-xs">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
        <span className="font-mono text-[10px] text-muted-foreground">{lang}</span>
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto p-4 leading-relaxed text-slate-300 font-mono whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

function DevDocs() {
  return (
    <SectionCard
      title="Developer quickstart"
      description="Use your API key to call fine-tuned models from any OpenAI-compatible SDK."
    >
      <div className="flex flex-col gap-3">
        {/* Info pills */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Zap,         label: "Base URL",  value: "YOUR_SERVER/v1" },
            { icon: ShieldCheck, label: "Auth header", value: "Bearer sk-local-…" },
            { icon: Database,    label: "Model ID",   value: "model_<id>" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="h-3 w-3" />
                <span className="text-[10px] font-medium">{label}</span>
              </div>
              <code className="text-xs text-violet-400 font-mono break-all">{value}</code>
            </div>
          ))}
        </div>

        {/* Proxy flow diagram */}
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Request flow
          </p>
          <div className="flex items-center gap-1 flex-wrap text-xs">
            {[
              "Your app",
              "→ API Key auth",
              "→ PII scan",
              "→ Token gate",
              "→ Model router",
              "→ llama.cpp",
            ].map((step, i) => (
              <span
                key={i}
                className={`rounded px-2 py-0.5 font-mono ${
                  i === 0
                    ? "bg-violet-500/20 text-violet-400"
                    : i === 5
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step}
              </span>
            ))}
          </div>
        </div>

        <Tabs defaultValue="curl">
          <TabsList className="w-full">
            <TabsTrigger value="curl" className="flex-1">cURL</TabsTrigger>
            <TabsTrigger value="python" className="flex-1">Python (OpenAI SDK)</TabsTrigger>
          </TabsList>
          <TabsContent value="curl">
            <CodeBlock code={CODE_CURL} lang="shell" />
          </TabsContent>
          <TabsContent value="python">
            <CodeBlock code={CODE_PYTHON} lang="python" />
          </TabsContent>
        </Tabs>

        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">PII protection:</strong> Requests containing
          emails, phone numbers, SSNs, credit cards, or IP addresses are automatically
          blocked before reaching the model.
        </div>
      </div>
    </SectionCard>
  );
}

// ── API Keys section ───────────────────────────────────────────────────────────

function ApiKeysSection() {
  const { data: keys, isLoading, refetch } = useApiKeys();
  const createKey  = useCreateApiKey();
  const revokeKey  = useRevokeApiKey();

  const [newName, setNewName]         = useState("");
  const [tokenLimit, setTokenLimit]   = useState<string>("1000000");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revoking, setRevoking]       = useState<ApiKeyRow | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const limit = tokenLimit && !isNaN(Number(tokenLimit)) ? Number(tokenLimit) : 1_000_000;
    createKey.mutate(
      { name: newName.trim(), token_limit: limit },
      {
        onSuccess: (res) => {
          setNewName("");
          setRevealedKey(res.plain_text_key);
          toast.success(`Key "${res.key.name}" created.`);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleRevoke = () => {
    if (!revoking) return;
    revokeKey.mutate(revoking.id, {
      onSuccess: () => {
        toast.success(`Key "${revoking.name}" revoked.`);
        setRevoking(null);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const formatRelative = (iso: string | null) => {
    if (!iso) return "Never used";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Active keys list */}
      <SectionCard
        title="Active keys"
        description="Each key authorises access to the /v1/chat/completions gateway with its own token budget."
      >
        {isLoading && (
          <div className="flex flex-col gap-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        )}

        {!isLoading && (keys?.length ?? 0) === 0 && (
          <div className="rounded-lg border border-dashed py-8 text-center">
            <Key className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
            <p className="text-xs text-muted-foreground">Create one below to get started.</p>
          </div>
        )}

        {keys && keys.length > 0 && (
          <div className="flex flex-col divide-y rounded-lg border">
            {keys.map((k) => (
              <div key={k.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{k.name}</span>
                      {!k.is_active && (
                        <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">
                          revoked
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <code className="font-mono">{k.prefix}</code>
                      <span>·</span>
                      <span>Created {formatDate(k.created_at)}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {formatRelative(k.last_used_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <CopyButton value={k.prefix.replace("...", "")} />
                    {k.is_active && (
                      <button
                        onClick={() => setRevoking(k)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Revoke key"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Usage bar */}
                <UsageBar used={k.tokens_used} limit={k.token_limit} />
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 self-end text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </SectionCard>

      {/* Create new key */}
      <SectionCard
        title="Create a new key"
        description="The full key is shown exactly once — copy it immediately."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Key name">
            <Input
              placeholder="e.g. Production, CI pipeline"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </Field>
          <Field
            label="Token limit"
            hint="Total tokens this key may consume. Leave at default for 1M."
          >
            <Input
              type="number"
              min="1000"
              step="100000"
              value={tokenLimit}
              onChange={(e) => setTokenLimit(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={createKey.isPending || !newName.trim()}
          >
            {createKey.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</>
              : <><Plus className="h-3.5 w-3.5" /> Create key</>}
          </Button>
        </div>
      </SectionCard>

      {/* Developer docs */}
      <DevDocs />

      {/* Modals */}
      {revealedKey && (
        <KeyRevealDialog rawKey={revealedKey} onClose={() => setRevealedKey(null)} />
      )}
      {revoking && (
        <RevokeDialog
          keyName={revoking.name}
          onConfirm={handleRevoke}
          onClose={() => setRevoking(null)}
          loading={revokeKey.isPending}
        />
      )}
    </div>
  );
}

// ── Other sections (unchanged) ─────────────────────────────────────────────────

function ProfileSection() {
  const [saving, setSaving] = useState(false);
  const save = () => { setSaving(true); setTimeout(() => { setSaving(false); toast.success("Profile saved."); }, 800); };
  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Personal info" description="Your display name and email address.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email"><Input placeholder="you@example.com" /></Field>
          <Field label="Display name"><Input placeholder="Your name" /></Field>
        </div>
      </SectionCard>
      <SectionCard title="Change password" description="Update your login credentials.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password"><PasswordInput placeholder="••••••••" /></Field>
          <Field label="New password"><PasswordInput placeholder="••••••••" /></Field>
        </div>
      </SectionCard>
      <SaveRow saving={saving} onClick={save} />
    </div>
  );
}

function ModelPrefsSection() {
  const [saving, setSaving] = useState(false);
  const save = () => { setSaving(true); setTimeout(() => { setSaving(false); toast.success("Model preferences saved."); }, 800); };
  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Default base model" description="Used when starting a new conversation with no explicit model selected.">
        <Field label="Base model">
          <Select>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select a model" /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Models</SelectLabel>
                <SelectItem value="llama-3.2-1b-instruct">Llama 3.2 1B Instruct</SelectItem>
                <SelectItem value="qwen-2.5-3b-instruct">Qwen 2.5 3B Instruct</SelectItem>
                <SelectItem value="deepseek-r1-distill-1.5b">DeepSeek-R1 Distill 1.5B</SelectItem>
                <SelectItem value="gemma-3-1b-it">Gemma 3 1B IT</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Default system prompt">
          <textarea rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" defaultValue="You are a helpful, respectful, and honest local AI assistant." />
        </Field>
      </SectionCard>
      <SectionCard title="Inference parameters" description="Applied to all conversations unless overridden in the playground sidebar.">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Temperature" hint="Higher values make output more creative and random."><Input type="number" step="0.1" min="0" max="2" defaultValue="0.7" /></Field>
          <Field label="Max tokens" hint="Maximum length of each generated response."><Input type="number" defaultValue="2048" /></Field>
          <Field label="Top-p" hint="Nucleus sampling — lower values focus output."><Input type="number" step="0.05" min="0" max="1" defaultValue="1.0" /></Field>
          <Field label="Context window" hint="Number of tokens retained from conversation history."><Input type="number" defaultValue="4096" /></Field>
        </div>
      </SectionCard>
      <SaveRow saving={saving} onClick={save} />
    </div>
  );
}

function StorageSection() {
  const [saving, setSaving] = useState(false);
  const save = () => { setSaving(true); setTimeout(() => { setSaving(false); toast.success("Paths saved."); }, 800); };
  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Storage paths" description="Directories where Forge writes model adapters, dataset files, and training logs.">
        <div className="flex flex-col gap-4">
          {[
            { label: "Datasets root",    value: "storage/datasets" },
            { label: "Adapters root",    value: "storage/adapters" },
            { label: "Uploaded models",  value: "storage/uploaded_models" },
            { label: "Training logs",    value: "storage/logs" },
            { label: "Base model GGUFs", value: "storage/models" },
          ].map((p) => (
            <Field key={p.label} label={p.label}>
              <Input defaultValue={p.value} className="font-mono text-xs" />
            </Field>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Docker settings" description="Configuration for the llama.cpp inference containers.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Container image" hint="Pulled from ghcr.io by default."><Input defaultValue="ghcr.io/ggml-org/llama.cpp:server" className="font-mono text-xs" /></Field>
          <Field label="Health-check timeout (s)" hint="Seconds to wait for container readiness."><Input type="number" defaultValue="600" /></Field>
        </div>
      </SectionCard>
      <SaveRow saving={saving} onClick={save} />
    </div>
  );
}

function GeneralSection() {
  const [saving, setSaving] = useState(false);
  const save = () => { setSaving(true); setTimeout(() => { setSaving(false); toast.success("Settings saved."); }, 800); };
  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Appearance" description="Choose your preferred interface theme.">
        <Field label="Theme">
          <Select>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select a theme" /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Themes</SelectLabel>
                <SelectItem value="system">System default</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </SectionCard>
      <SectionCard title="Danger zone" description="Irreversible actions — proceed with care.">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="mb-3 text-sm font-medium text-destructive">Delete account</p>
          <p className="mb-4 text-xs text-muted-foreground">
            Permanently removes your account, all models, datasets, and conversations. This cannot be undone.
          </p>
          <Button variant="destructive" size="sm">Delete my account</Button>
        </div>
      </SectionCard>
      <SaveRow saving={saving} onClick={save} />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [active, setActive] = useState<Tab>("profile");

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-sm font-semibold">Settings</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-sm text-muted-foreground">{SECTION_LABELS[active]}</span>
        </div>
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <Image src="/logo.png" alt="Forge Logo" fill sizes="32px" className="object-cover" />
          </div>
          <span className={`${tienne.className} text-xl font-bold uppercase tracking-[0.15em]`}>
            Forge
          </span>
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar py-6">
          <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Settings
          </p>
          <nav className="flex flex-col gap-0.5 px-2">
            {NAV.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                  active === id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-2xl">
            <h1 className="mb-1 text-lg font-semibold">{SECTION_LABELS[active]}</h1>
            <p className="mb-8 text-sm text-muted-foreground">
              {active === "profile"  && "Manage your account credentials and personal information."}
              {active === "models"   && "Configure default models and inference parameters for the playground."}
              {active === "storage"  && "Control where Forge stores files on the server."}
              {active === "api-keys" && "Create and manage API keys for programmatic access to your fine-tuned models."}
              {active === "general"  && "Appearance and account-level actions."}
            </p>
            {active === "profile"  && <ProfileSection />}
            {active === "models"   && <ModelPrefsSection />}
            {active === "storage"  && <StorageSection />}
            {active === "api-keys" && <ApiKeysSection />}
            {active === "general"  && <GeneralSection />}
          </div>
        </main>
      </div>
    </div>
  );
}
