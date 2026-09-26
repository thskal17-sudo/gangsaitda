"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import { type BulkResult, createJobsBulk } from "@/lib/admin-job-actions";
import { formatKoreanDate } from "@/lib/date";
import { type ExcelRow, parseJobSheet } from "@/lib/job-excel";

type Stage =
  | { step: "pick"; error?: string }
  | { step: "preview"; fileName: string; rows: ExcelRow[]; error?: string }
  | { step: "done"; rows: ExcelRow[]; results: BulkResult[] };

/**
 * 엑셀 올리기: ① 파일 고르기 → ② 미리보기(줄마다 확인 결과) → ③ 올리기 결과.
 * 파일은 이 컴퓨터 안(브라우저)에서만 읽고, 확인을 통과한 줄의 내용만 서버로 보낸다.
 */
export default function ExcelUpload({ existingTitles }: { existingTitles: string[] }) {
  const existing = useMemo(() => new Set(existingTitles), [existingTitles]);
  const [stage, setStage] = useState<Stage>({ step: "pick" });
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      setStage({ step: "pick", error: "엑셀 파일(.xlsx)만 올릴 수 있어요. 엑셀에서 '다른 이름으로 저장 → Excel 통합 문서'로 저장해 주세요." });
      return;
    }
    setBusy(true);
    try {
      const sheet = await readSheet(file);
      const result = parseJobSheet(sheet as unknown[][], existing);
      setStage("error" in result ? { step: "pick", error: result.error } : { step: "preview", fileName: file.name, rows: result.rows });
    } catch {
      setStage({ step: "pick", error: "파일을 읽지 못했어요. 양식으로 만든 엑셀 파일인지 확인해 주세요." });
    } finally {
      setBusy(false);
    }
  }

  async function upload(rows: ExcelRow[]) {
    const ready = rows.filter((r) => !r.problem);
    setBusy(true);
    try {
      const results = await createJobsBulk(ready.map((r) => r.values));
      if ("error" in results) {
        setStage((s) => (s.step === "preview" ? { ...s, error: results.error } : s));
        return;
      }
      setStage({ step: "done", rows: ready, results });
      window.scrollTo({ top: 0 });
    } catch {
      setStage((s) => (s.step === "preview" ? { ...s, error: "올리지 못했어요. 잠시 뒤에 다시 시도해 주세요." } : s));
    } finally {
      setBusy(false);
    }
  }

  if (stage.step === "done") return <Done rows={stage.rows} results={stage.results} onAgain={() => setStage({ step: "pick" })} />;

  if (stage.step === "preview") {
    const ready = stage.rows.filter((r) => !r.problem);
    const skipped = stage.rows.filter((r) => r.skipped);
    const broken = stage.rows.filter((r) => r.problem && !r.skipped);

    return (
      <div className="flex flex-col gap-4">
        <section className="rounded-card bg-white p-5 md:p-6">
          <p className="text-[13px] font-medium text-muted">{stage.fileName}</p>
          <p className="mt-1 text-[18px] font-bold tracking-tight text-ink">
            <span className="nums text-brand">{ready.length}</span>건을 올릴 수 있어요
          </p>
          <p className="nums mt-1 text-sm text-muted">
            전체 {stage.rows.length}줄 · 고쳐야 할 줄 <span className={broken.length ? "font-semibold text-warn" : ""}>{broken.length}</span> · 건너뛰는 줄 {skipped.length}
          </p>
          {broken.length > 0 && (
            <p className="mt-3 rounded-control bg-warn/8 px-4 py-3 text-sm text-warn">
              빨간 줄은 올라가지 않아요. 엑셀에서 고친 뒤 파일을 다시 고르거나, 그대로 두고 나머지만 올려도 돼요.
            </p>
          )}
          {stage.error && (
            <p role="alert" className="mt-3 rounded-control bg-warn/8 px-4 py-3 text-sm font-medium text-warn">
              {stage.error}
            </p>
          )}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy || ready.length === 0}
              onClick={() => upload(stage.rows)}
              className="flex h-14 items-center justify-center rounded-control bg-brand px-6 text-[16px] font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
            >
              {busy ? "올리는 중… 창을 닫지 마세요" : `${ready.length}건 올리기`}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStage({ step: "pick" })}
              className="flex h-14 items-center justify-center rounded-control bg-bg px-6 text-[16px] font-semibold text-ink transition-colors hover:bg-line disabled:opacity-50"
            >
              다른 파일 고르기
            </button>
          </div>
        </section>

        <section className="rounded-card bg-white p-4 md:p-5">
          <h2 className="text-[17px] font-bold tracking-tight text-ink">미리보기</h2>
          <ul className="mt-2 divide-y divide-line">
            {stage.rows.map((r) => (
              <PreviewRow key={r.line} row={r} />
            ))}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-card bg-white p-5 md:p-6">
        <h2 className="text-[17px] font-bold tracking-tight text-ink">1. 양식 받기</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          첫 번째 시트(공고)의 칸 이름은 그대로 두고, 둘째 줄부터 공고를 한 줄에 하나씩 적어요. 적는 예는 &lsquo;예시&rsquo; 시트에 있어요.
          <br />꼭 적을 칸: 제목·기관명·지역·마감일·수업 일정·상세 내용. 마감일은 2026-10-15 처럼 적어요.
        </p>
        <a
          href="/gangsaitda-job-template.xlsx"
          download
          className="mt-4 inline-flex h-12 items-center rounded-control bg-bg px-5 text-[15px] font-semibold text-ink transition-colors hover:bg-line"
        >
          양식 내려받기 (.xlsx)
        </a>
      </section>

      <section className="rounded-card bg-white p-5 md:p-6">
        <h2 className="text-[17px] font-bold tracking-tight text-ink">2. 파일 고르기</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          고르면 바로 올라가지 않고, 먼저 줄마다 확인한 결과를 보여줘요. 같은 제목의 공고가 이미 있으면 건너뛰어요.
        </p>
        <label className="mt-4 flex h-14 cursor-pointer items-center justify-center rounded-control bg-brand text-[16px] font-semibold text-white transition-colors hover:bg-brand/90">
          {busy ? "읽는 중…" : "엑셀 파일 고르기"}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = ""; // 같은 파일을 고쳐서 다시 골라도 읽히게
            }}
          />
        </label>
        {stage.error && (
          <p role="alert" className="mt-3 rounded-control bg-warn/8 px-4 py-3 text-sm font-medium text-warn">
            {stage.error}
          </p>
        )}
      </section>
    </div>
  );
}

function PreviewRow({ row }: { row: ExcelRow }) {
  const tone = !row.problem
    ? { label: "올릴 수 있음", className: "bg-ok/10 text-ok" }
    : row.skipped
      ? { label: "건너뜀", className: "bg-bg text-muted" }
      : { label: "고쳐야 함", className: "bg-warn/10 text-warn" };
  const { values: v } = row;

  return (
    <li className={`py-3 ${row.skipped ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2 text-[12px]">
        <span className="nums text-muted">{row.line}행</span>
        <span className={`rounded-badge px-2 py-0.5 font-semibold ${tone.className}`}>{tone.label}</span>
      </div>
      <p className="mt-1 truncate text-[15px] font-bold tracking-tight text-ink">{v.title || "(제목 없음)"}</p>
      <p className="nums truncate text-[13px] text-muted">
        {[v.region, v.organization, /^\d{4}-\d{2}-\d{2}$/.test(v.deadline) ? `${formatKoreanDate(v.deadline)} 마감` : v.deadline]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {row.problem && <p className={`mt-1 text-[13px] font-medium ${row.skipped ? "text-muted" : "text-warn"}`}>{row.problem}</p>}
    </li>
  );
}

function Done({ rows, results, onAgain }: { rows: ExcelRow[]; results: BulkResult[]; onAgain: () => void }) {
  const okCount = results.filter((r) => r.ok).length;
  const failed = results.map((r, i) => ({ r, row: rows[i] })).filter(({ r }) => !r.ok);

  return (
    <section role="status" className="rounded-card bg-white p-5 md:p-6">
      <p className="text-[20px] font-bold tracking-tight text-ink">
        <span className="nums text-ok">{okCount}</span>건을 올렸어요
      </p>
      {failed.length > 0 && (
        <div className="mt-3 rounded-control bg-warn/8 px-4 py-3 text-sm text-warn">
          <p className="font-semibold">{failed.length}건은 올리지 못했어요.</p>
          <ul className="mt-1 list-disc pl-5">
            {failed.map(({ r, row }) => (
              <li key={row.line}>
                {row.line}행 {row.values.title} — {!r.ok && r.error}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/admin?filter=today"
          className="flex h-14 items-center justify-center rounded-control bg-brand px-6 text-[16px] font-semibold text-white transition-colors hover:bg-brand/90 sm:flex-1"
        >
          오늘 올린 공고 보기
        </Link>
        <button
          type="button"
          onClick={onAgain}
          className="flex h-14 items-center justify-center rounded-control bg-bg px-6 text-[16px] font-semibold text-ink transition-colors hover:bg-line"
        >
          다른 파일 올리기
        </button>
      </div>
    </section>
  );
}
