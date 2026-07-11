import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveRuntimeFile } from "@/lib/audio/runtime-storage";
import type { SourceMaterial, SourceMaterialExtractStatus, SubjectLessonType } from "@/types";

const MAX_EXTRACTED_CHARS = 120_000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function normalizeLessonType(value: unknown): SubjectLessonType {
  return value === "one_off" ? "one_off" : "course";
}

export function normalizeTargetLessonCount(value: unknown, lessonType: SubjectLessonType): number | null {
  const raw = typeof value === "string" && value.trim() === "" ? null : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return lessonType === "one_off" ? 1 : null;
  const count = Math.max(1, Math.min(100, Math.floor(parsed)));
  return lessonType === "one_off" ? Math.max(1, count) : count;
}

export function parseSourceMaterialsJson(value: unknown): SourceMaterial[] {
  if (!value) return [];
  if (Array.isArray(value)) return sanitizeMaterials(value);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? sanitizeMaterials(parsed) : [];
  } catch {
    return [];
  }
}

export function sourceMaterialsToPrompt(materials: SourceMaterial[] | string | null | undefined): string {
  const parsed = typeof materials === "string" ? parseSourceMaterialsJson(materials) : materials ?? [];
  if (parsed.length === 0) return "(none)";
  return parsed
    .map((material, index) => {
      const lines = [
        `SOURCE ${index + 1}: ${material.title}`,
        `Type: ${material.type}`,
        material.url ? `URL: ${material.url}` : "",
        material.file_name ? `File: ${material.file_name}` : "",
        material.extract_status ? `Extraction: ${material.extract_status}` : "",
        material.extract_error ? `Extraction note: ${material.extract_error}` : "",
        material.extracted_text ? `Extracted text:\n${material.extracted_text.slice(0, MAX_EXTRACTED_CHARS)}` : "",
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n\n");
}

export async function buildSourceMaterialsFromFormData(formData: FormData, subjectId: number): Promise<SourceMaterial[]> {
  const createdAt = new Date().toISOString();
  const materials: SourceMaterial[] = [];

  const linkLines = String(formData.get("source_links") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const url of linkLines) {
    materials.push({
      id: `link_${crypto.randomUUID()}`,
      type: "link",
      title: url,
      url,
      created_at: createdAt,
    });
  }

  const inlineText = String(formData.get("source_text") ?? "").trim();
  if (inlineText) {
    materials.push({
      id: `text_${crypto.randomUUID()}`,
      type: "text",
      title: "Additional context",
      extracted_text: inlineText.slice(0, MAX_EXTRACTED_CHARS),
      extract_status: inlineText ? "ok" : "empty",
      created_at: createdAt,
    });
  }

  const files = formData.getAll("source_files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  for (const file of files) {
    materials.push(await materialFromFile(file, subjectId, createdAt));
  }

  const jsonMaterials = parseSourceMaterialsJson(formData.get("source_materials"));
  materials.push(...jsonMaterials);
  return materials;
}

export function buildSourceMaterialsFromJson(body: { source_materials?: unknown; source_links?: unknown; source_text?: unknown }): SourceMaterial[] {
  const createdAt = new Date().toISOString();
  const materials = parseSourceMaterialsJson(body.source_materials);
  if (typeof body.source_links === "string") {
    for (const url of body.source_links.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
      materials.push({ id: `link_${crypto.randomUUID()}`, type: "link", title: url, url, created_at: createdAt });
    }
  }
  if (typeof body.source_text === "string" && body.source_text.trim()) {
    materials.push({
      id: `text_${crypto.randomUUID()}`,
      type: "text",
      title: "Additional context",
      extracted_text: body.source_text.trim().slice(0, MAX_EXTRACTED_CHARS),
      extract_status: "ok",
      created_at: createdAt,
    });
  }
  return materials;
}

async function materialFromFile(file: File, subjectId: number, createdAt: string): Promise<SourceMaterial> {
  const safeName = safeFileName(file.name || "upload");
  const relPath = `runtime_artifacts/uploads/subjects/${subjectId}/${crypto.randomUUID()}-${safeName}`;
  const absPath = resolveRuntimeFile(relPath);
  if (!absPath) {
    return failedFileMaterial(file, createdAt, "failed", "Unable to resolve runtime upload path");
  }

  if (file.size > MAX_FILE_BYTES) {
    return failedFileMaterial(file, createdAt, "too_large", `File exceeds ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB limit`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, buffer);

  const extraction = await extractText(buffer, file.name, file.type);
  return {
    id: `file_${crypto.randomUUID()}`,
    type: "file",
    title: file.name || "Uploaded file",
    file_name: file.name || safeName,
    mime_type: file.type || nullToUndefined(file.type),
    file_size: file.size,
    stored_path: relPath,
    extracted_text: extraction.text ? extraction.text.slice(0, MAX_EXTRACTED_CHARS) : undefined,
    extract_status: extraction.status,
    extract_error: extraction.error,
    created_at: createdAt,
  };
}

async function extractText(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ status: SourceMaterialExtractStatus; text?: string; error?: string }> {
  const lower = fileName.toLowerCase();
  try {
    if (mimeType.startsWith("text/") || /\.(txt|md|markdown|csv|json|log)$/i.test(lower)) {
      const text = buffer.toString("utf8").trim();
      return text ? { status: "ok", text } : { status: "empty", error: "No text found" };
    }
    if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
      const pdfModule = await import("pdf-parse");
      const Parser = (pdfModule as unknown as { PDFParse?: new (options: { data: Buffer }) => { getText: () => Promise<{ text?: string }>; destroy?: () => Promise<void> | void } }).PDFParse;
      if (!Parser) return { status: "failed", error: "pdf-parse PDFParse export was unavailable" };
      const parser = new Parser({ data: buffer });
      const parsed = await parser.getText();
      await parser.destroy?.();
      const text = parsed.text?.trim() ?? "";
      return text ? { status: "ok", text } : { status: "empty", error: "No PDF text found" };
    }
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lower.endsWith(".docx")
    ) {
      const mammoth = await import("mammoth");
      const parsed = await mammoth.extractRawText({ buffer });
      const text = parsed.value?.trim() ?? "";
      return text ? { status: "ok", text } : { status: "empty", error: "No DOCX text found" };
    }
    if (lower.endsWith(".doc")) {
      return {
        status: "unsupported",
        error: "Legacy .doc files are stored for reference, but only DOCX text extraction is supported",
      };
    }
    return { status: "unsupported", error: "Unsupported file type for text extraction" };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}

function failedFileMaterial(
  file: File,
  createdAt: string,
  status: SourceMaterialExtractStatus,
  error: string
): SourceMaterial {
  return {
    id: `file_${crypto.randomUUID()}`,
    type: "file",
    title: file.name || "Uploaded file",
    file_name: file.name || "upload",
    mime_type: file.type || undefined,
    file_size: file.size,
    extract_status: status,
    extract_error: error,
    created_at: createdAt,
  };
}

function sanitizeMaterials(values: unknown[]): SourceMaterial[] {
  return values
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value))
    .map((value) => ({
      id: typeof value.id === "string" ? value.id : `material_${crypto.randomUUID()}`,
      type: value.type === "link" || value.type === "file" || value.type === "text" ? value.type : "text",
      title: String(value.title ?? value.file_name ?? value.url ?? "Source material").slice(0, 240),
      url: typeof value.url === "string" ? value.url : undefined,
      file_name: typeof value.file_name === "string" ? value.file_name : undefined,
      mime_type: typeof value.mime_type === "string" ? value.mime_type : undefined,
      file_size: typeof value.file_size === "number" ? value.file_size : undefined,
      stored_path: typeof value.stored_path === "string" ? value.stored_path : undefined,
      extracted_text: typeof value.extracted_text === "string" ? value.extracted_text.slice(0, MAX_EXTRACTED_CHARS) : undefined,
      extract_status:
        value.extract_status === "ok" ||
        value.extract_status === "empty" ||
        value.extract_status === "unsupported" ||
        value.extract_status === "failed" ||
        value.extract_status === "too_large"
          ? value.extract_status
          : undefined,
      extract_error: typeof value.extract_error === "string" ? value.extract_error.slice(0, 500) : undefined,
      created_at: typeof value.created_at === "string" ? value.created_at : new Date().toISOString(),
    }));
}

function safeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "upload";
}

function nullToUndefined(value: string | null | undefined): string | undefined {
  return value || undefined;
}
