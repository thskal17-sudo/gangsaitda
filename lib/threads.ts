import { createServiceClient } from "@/lib/supabase/service";
import { todayInSeoul } from "@/lib/date";
import { SITE_URL } from "@/lib/site";

/*
 * Threads 자동 게시 — 새 공고가 사이트에 올라가면 운영자 Threads 계정에 '제목 + 링크'를 올린다.
 * 운영자가 관리자 화면(/admin/threads)에서 Threads 계정을 한 번 연결해 두면 된다.
 *
 * 준비물: Threads 앱 ID·시크릿 (Meta 개발자 앱 → 이용 사례 'Threads API 액세스' → 설정).
 *   운영자가 관리자 화면(/admin/threads)에 입력하면 threads_app_keys 표에 보관한다 (사이트 서버만 읽음).
 *   사이트 환경 변수 THREADS_APP_ID·THREADS_APP_SECRET 이 있으면 그 값을 먼저 쓴다.
 *   SUPABASE_SECRET_KEY (표를 읽고 쓰려고)는 사이트 환경 변수에 있어야 한다.
 * Meta 개발자 앱 설정: 사용 사례 'Threads API 액세스', 권한 threads_basic + threads_content_publish,
 *   리디렉션 콜백 URL = SITE_URL + /api/threads/callback, 앱 역할에 운영자 Threads 계정을 'Threads 테스터'로 추가하고 수락.
 *   (본인 계정에만 올리므로 Meta 앱 심사는 필요 없다.)
 *
 * 무엇을 올리나: 공고 제목과 링크만. 기관·지역·마감일·지원 방법 같은 회원 전용 내용은 넣지 않는다.
 *   공고 한 건 → 그 공고 상세 링크. 여러 건이 한꺼번에 올라오면(엑셀·수집) → 제목 몇 개를 묶어 글 하나로, 공고 목록 링크.
 * 같은 공고는 두 번 올리지 않는다 (threads_posts 표). 숨긴 공고, 마감 지난 공고, Threads 를 연결하기 전에 만든 공고는 올리지 않는다.
 * 실패해도 공고 저장은 그대로다 (응답을 보낸 뒤 after 로 올리고, 이유는 표의 last_error 에 남긴다).
 *
 * 열쇠(토큰): 장기 토큰은 60일 간다. 공고를 올릴 때 마지막으로 늘린 지 하루가 지났으면 다시 60일로 늘린다.
 * 60일 동안 한 번도 올리지 않으면 만료되어 관리자 화면에서 다시 연결해야 한다.
 */

const AUTH_URL = "https://threads.com/oauth/authorize";
const GRAPH = "https://graph.threads.com";
const SCOPE = "threads_basic,threads_content_publish";
/** Threads 글은 500자까지. 여유를 둔다 */
const MAX_TEXT = 480;
/** 여러 건을 한 글로 올릴 때 보여줄 제목 수 */
const MAX_TITLES = 5;
/** 제목 하나의 최대 길이 (긴 제목은 줄임) */
const MAX_TITLE_LENGTH = 60;
/** 토큰을 마지막으로 늘린 지 이만큼 지났으면 올리기 전에 늘린다 (Meta 규칙: 받은 지 24시간이 지나야 늘릴 수 있음) */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export const THREADS_CALLBACK_PATH = "/api/threads/callback";
export const THREADS_STATE_COOKIE = "gs-threads-state";

type AppKeys = { id: string; secret: string; source: "env" | "admin" };

/** Threads 앱 ID·시크릿. 환경 변수가 있으면 그것을, 없으면 관리자 화면에서 넣은 값(threads_app_keys 표)을 쓴다. 없으면 null. */
async function appKeys(): Promise<AppKeys | null> {
  const envId = process.env.THREADS_APP_ID?.trim();
  const envSecret = process.env.THREADS_APP_SECRET?.trim();
  if (envId && envSecret) return { id: envId, secret: envSecret, source: "env" };
  const supabase = createServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("threads_app_keys").select("app_id, app_secret").eq("id", 1).maybeSingle();
  if (error || !data) return null;
  const row = data as { app_id: string; app_secret: string };
  return row.app_id && row.app_secret ? { id: row.app_id, secret: row.app_secret, source: "admin" } : null;
}

export async function threadsKeysConfigured(): Promise<boolean> {
  return (await appKeys()) !== null;
}

/** 관리자 화면에서 Threads 앱 ID·시크릿을 저장한다. 값 확인은 부르는 쪽(lib/threads-actions.ts)에서 한다. */
export async function saveThreadsAppKeys(appId: string, appSecret: string): Promise<void> {
  const { error } = await serviceClient()
    .from("threads_app_keys")
    .upsert({ id: 1, app_id: appId, app_secret: appSecret, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Threads 앱 열쇠를 저장하지 못했어요: ${error.message}`);
}

function redirectUri() {
  return `${SITE_URL}${THREADS_CALLBACK_PATH}`;
}

/** 운영자를 Threads 로그인(권한 동의) 화면으로 보낼 주소 */
export async function threadsAuthorizeUrl(state: string): Promise<string | null> {
  const keys = await appKeys();
  if (!keys) return null;
  const params = new URLSearchParams({
    client_id: keys.id,
    redirect_uri: redirectUri(),
    scope: SCOPE,
    response_type: "code",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

type TokenRow = {
  access_token: string;
  expires_at: string;
  user_id: string;
  username: string | null;
  connected_at: string;
  refreshed_at: string;
  last_error: string | null;
};

type GraphError = { error?: { message?: string; code?: number; type?: string }; error_message?: string; error_type?: string };

/** Meta 응답을 읽는다. 실패면 이유를 담아 예외를 던진다 (열쇠 값은 넣지 않는다). */
async function readGraph<T>(res: Response, what: string): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    // JSON 이 아니면 아래에서 글자 그대로 보여준다
  }
  if (!res.ok || data === null) {
    const e = (data ?? {}) as GraphError;
    const why = e.error?.message ?? e.error_message ?? text.slice(0, 150);
    throw new Error(`${what} 실패 (HTTP ${res.status}) ${why}`.replace(/\s+/g, " ").trim());
  }
  return data as T;
}

function serviceClient() {
  const supabase = createServiceClient();
  if (!supabase) throw new Error("SUPABASE_SECRET_KEY 환경 변수가 없어요.");
  return supabase;
}

async function readRow(): Promise<TokenRow | null> {
  const { data, error } = await serviceClient().from("threads_tokens").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Threads 연결 정보를 읽지 못했어요: ${error.message}`);
  return (data as TokenRow | null) ?? null;
}

async function recordError(message: string | null) {
  await serviceClient().from("threads_tokens").update({ last_error: message, updated_at: new Date().toISOString() }).eq("id", 1);
}

type LongToken = { access_token: string; expires_in: number };

/** Threads 로그인 뒤 돌아온 code 로 토큰을 받아(짧은 것 → 60일짜리로 바꿔) 저장한다 (연결 완료). */
export async function connectThreads(rawCode: string): Promise<void> {
  const keys = await appKeys();
  if (!keys) throw new Error("Threads 앱 ID·시크릿이 없어요. 관리자 화면에서 먼저 저장해 주세요.");
  const { id, secret } = keys;
  const code = rawCode.replace(/#_$/, "");

  // 1) code → 짧은 토큰 (1시간)
  const short = await readGraph<{ access_token: string; user_id: number | string }>(
    await fetch(`${GRAPH}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: id, client_secret: secret, code, grant_type: "authorization_code", redirect_uri: redirectUri() }),
    }),
    "Threads 토큰 받기",
  );

  // 2) 짧은 토큰 → 장기 토큰 (60일)
  const long = await readGraph<LongToken>(
    await fetch(`${GRAPH}/access_token?${new URLSearchParams({ grant_type: "th_exchange_token", client_secret: secret, access_token: short.access_token })}`),
    "Threads 장기 토큰 받기",
  );

  // 3) 계정 번호·이름. 번호는 꼭 /me 의 글자(string) 값을 쓴다.
  //    (1단계 응답의 user_id 는 JSON 숫자라 자릿수가 커서 끝자리가 바뀔 수 있다 → '없는 ID' 오류. 11/2 실제로 겪음)
  let username: string | null = null;
  let userId = String(short.user_id);
  try {
    const me = await readGraph<{ id?: string; username?: string }>(
      await fetch(`${GRAPH}/v1.0/me?${new URLSearchParams({ fields: "id,username", access_token: long.access_token })}`),
      "Threads 계정 확인",
    );
    username = me.username ?? null;
    if (me.id) userId = String(me.id);
  } catch (err) {
    console.error("[threads] 계정 확인 실패", err instanceof Error ? err.message : err);
  }

  const now = new Date();
  const { error } = await serviceClient()
    .from("threads_tokens")
    .upsert({
      id: 1,
      access_token: long.access_token,
      expires_at: new Date(now.getTime() + long.expires_in * 1000).toISOString(),
      user_id: userId,
      username,
      connected_at: now.toISOString(),
      refreshed_at: now.toISOString(),
      updated_at: now.toISOString(),
      last_error: null,
    });
  if (error) throw new Error(`Threads 연결 정보를 저장하지 못했어요: ${error.message}`);
}

/** 연결 끊기: 표의 한 줄을 지운다. (Meta 쪽 앱 권한 해제는 운영자가 Threads 설정 → 계정 → 웹사이트 권한에서 한다) */
export async function disconnectThreads(): Promise<void> {
  const { error } = await serviceClient().from("threads_tokens").delete().eq("id", 1);
  if (error) throw new Error(`연결을 끊지 못했어요: ${error.message}`);
}

/** 쓸 수 있는 연결 정보. 하루가 지났으면 토큰을 60일로 다시 늘린다. 연결이 없거나 만료됐으면 null. */
async function getConnection(): Promise<TokenRow | null> {
  const row = await readRow();
  if (!row) return null;
  if (Date.parse(row.expires_at) <= Date.now()) return null;
  if (Date.now() - Date.parse(row.refreshed_at) < REFRESH_AFTER_MS) return row;

  try {
    const refreshed = await readGraph<LongToken>(
      await fetch(`${GRAPH}/refresh_access_token?${new URLSearchParams({ grant_type: "th_refresh_token", access_token: row.access_token })}`),
      "Threads 토큰 늘리기",
    );
    const now = Date.now();
    const next = {
      access_token: refreshed.access_token,
      expires_at: new Date(now + refreshed.expires_in * 1000).toISOString(),
      refreshed_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    };
    await serviceClient().from("threads_tokens").update(next).eq("id", 1);
    return { ...row, ...next };
  } catch (err) {
    // 늘리기에 실패해도 아직 만료 전이면 지금 토큰으로 올린다
    console.error("[threads] 토큰 늘리기 실패", err instanceof Error ? err.message : err);
    return row;
  }
}

/** 연결이 잘 되어 있는지 Threads 에 물어본다 (글은 올리지 않음). 성공하면 계정 이름을 돌려준다. */
export async function checkThreadsConnection(): Promise<{ ok: true; username: string | null } | { ok: false; error: string }> {
  try {
    const row = await getConnection();
    if (!row) return { ok: false, error: "Threads 연결이 없거나 만료됐어요. 다시 연결해 주세요." };
    const me = await readGraph<{ username?: string }>(
      await fetch(`${GRAPH}/v1.0/me?${new URLSearchParams({ fields: "id,username", access_token: row.access_token })}`),
      "Threads 계정 확인",
    );
    const username = me.username ?? row.username;
    await serviceClient().from("threads_tokens").update({ username, last_error: null, updated_at: new Date().toISOString() }).eq("id", 1);
    return { ok: true, username };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordError(message.slice(0, 300)).catch(() => {});
    return { ok: false, error: message };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 글을 올릴 계정 번호. /me 에 물어 글자 그대로 받는다 (표에 잘못 저장된 번호가 있으면 고쳐 둔다).
 * /me 를 못 읽으면 표의 번호를 쓴다.
 */
async function resolveUserId(row: TokenRow): Promise<string> {
  try {
    const me = await readGraph<{ id?: string }>(
      await fetch(`${GRAPH}/v1.0/me?${new URLSearchParams({ fields: "id", access_token: row.access_token })}`),
      "Threads 계정 확인",
    );
    if (me.id && String(me.id) !== row.user_id) {
      await serviceClient().from("threads_tokens").update({ user_id: String(me.id), updated_at: new Date().toISOString() }).eq("id", 1);
    }
    return me.id ? String(me.id) : row.user_id;
  } catch (err) {
    console.error("[threads] 계정 번호 확인 실패", err instanceof Error ? err.message : err);
    return row.user_id;
  }
}

/** Threads 에 글 하나를 올린다: 글 상자(컨테이너) 만들기 → 준비될 때까지 잠깐 기다림 → 게시. 글 번호를 돌려준다. */
async function publishText(row: TokenRow, text: string): Promise<string> {
  const userId = await resolveUserId(row);
  const container = await readGraph<{ id: string }>(
    await fetch(`${GRAPH}/v1.0/${encodeURIComponent(userId)}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ media_type: "TEXT", text, access_token: row.access_token }),
    }),
    "Threads 글 만들기",
  );

  // Meta 는 게시 전에 잠깐 기다리라고 권한다. 글만 있는 글은 보통 바로 준비되므로 상태를 몇 번만 확인한다 (최대 약 10초).
  for (let i = 0; i < 5; i++) {
    await sleep(2000);
    try {
      const s = await readGraph<{ status?: string; error_message?: string }>(
        await fetch(`${GRAPH}/v1.0/${encodeURIComponent(container.id)}?${new URLSearchParams({ fields: "status,error_message", access_token: row.access_token })}`),
        "Threads 글 상태 확인",
      );
      if (s.status === "FINISHED") break;
      if (s.status === "ERROR" || s.status === "EXPIRED") throw new Error(`Threads 글 준비 실패 (${s.status}) ${s.error_message ?? ""}`.trim());
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Threads 글 준비 실패")) throw err;
      // 상태 확인 자체가 안 되면 그냥 게시를 시도한다
      break;
    }
  }

  const published = await readGraph<{ id: string }>(
    await fetch(`${GRAPH}/v1.0/${encodeURIComponent(userId)}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: container.id, access_token: row.access_token }),
    }),
    "Threads 게시",
  );
  return published.id;
}

type NewJob = { id: number; title: string };

const MEMBER_NOTE = "기관·지역·마감일과 지원 방법은 무료 회원가입 후 볼 수 있어요.";

function shortTitle(title: string) {
  const t = title.replace(/\s+/g, " ").trim();
  return t.length > MAX_TITLE_LENGTH ? `${t.slice(0, MAX_TITLE_LENGTH - 1)}…` : t;
}

/** 올릴 글. 한 건이면 그 공고 링크, 여러 건이면 제목 몇 개 + 공고 목록 링크. 500자를 넘지 않게 제목 수를 줄인다. */
export function composeThreadsText(jobs: NewJob[]): string {
  if (jobs.length === 1) {
    const [job] = jobs;
    return [`[강사잇다 새 공고]`, shortTitle(job.title), "", MEMBER_NOTE, `${SITE_URL}/jobs/${job.id}`].join("\n");
  }
  for (let shown = Math.min(MAX_TITLES, jobs.length); shown >= 1; shown--) {
    const rest = jobs.length - shown;
    const lines = [
      `[강사잇다 새 공고 ${jobs.length}건]`,
      ...jobs.slice(0, shown).map((job) => `· ${shortTitle(job.title)}`),
      ...(rest > 0 ? [`외 ${rest}건`] : []),
      "",
      MEMBER_NOTE,
      `${SITE_URL}/jobs`,
    ];
    const text = lines.join("\n");
    if (text.length <= MAX_TEXT) return text;
  }
  return [`[강사잇다 새 공고 ${jobs.length}건]`, "", MEMBER_NOTE, `${SITE_URL}/jobs`].join("\n");
}

type JobRow = { id: number; title: string; created_at: string; hidden_at: string | null; job_details: { deadline: string } | { deadline: string }[] | null };

/**
 * 새로 사이트에 보이게 된 공고들을 Threads 에 올린다. 공고를 저장한 곳에서 after(() => shareNewJobsOnThreads(ids)) 로 부른다.
 * 연결이 없으면 조용히 끝난다. 실패해도 예외를 던지지 않는다 (이유는 last_error 에).
 */
/** 올리기 결과: 올린 공고 수와 실패 이유 (없으면 null) */
export type ShareResult = { posted: number; error: string | null };

export async function shareNewJobsOnThreads(jobIds: (number | string)[], opts: { retry?: boolean } = {}): Promise<ShareResult> {
  const ids = [...new Set(jobIds.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))];
  // Threads 앱 열쇠를 넣지 않았으면 이 기능을 안 쓰는 것 → 아무것도 하지 않는다
  if (ids.length === 0 || !(await threadsKeysConfigured())) return { posted: 0, error: null };
  const supabase = createServiceClient();
  if (!supabase) return { posted: 0, error: "SUPABASE_SECRET_KEY 환경 변수가 없어요." };

  let claimed: number[] = [];
  try {
    const row = await getConnection();
    if (!row) {
      // 연결한 적이 있는데 만료된 경우만 알린다 (연결 안 했으면 이 기능을 안 쓰는 것)
      const expired = "Threads 연결이 만료돼 새 공고를 올리지 못했어요. 관리자 화면에서 다시 연결해 주세요.";
      if (await readRow()) await recordError(expired);
      return { posted: 0, error: expired };
    }

    // 올릴 공고 고르기: 보이는 공고, 마감 전, Threads 를 연결한 뒤에 만든 공고
    const { data, error } = await supabase.from("jobs").select("id, title, created_at, hidden_at, job_details(deadline)").in("id", ids);
    if (error) throw new Error(`공고를 읽지 못했어요: ${error.message}`);
    const today = todayInSeoul();
    const connectedAt = Date.parse(row.connected_at);
    const candidates = ((data ?? []) as JobRow[]).filter((job) => {
      const detail = Array.isArray(job.job_details) ? job.job_details[0] : job.job_details;
      // 다시 올리기(retry)는 연결 시각과 상관없이 올린다 (한 번 올리려다 실패한 공고라서)
      return job.hidden_at === null && detail && detail.deadline >= today && (opts.retry || Date.parse(job.created_at) >= connectedAt);
    });
    if (candidates.length === 0) return { posted: 0, error: null };

    // 같은 공고를 두 번 올리지 않게 먼저 표에 '올리는 중'으로 적는다. 이미 있는 공고는 건너뛴다.
    const { data: inserted, error: claimError } = await supabase
      .from("threads_posts")
      .upsert(candidates.map((job) => ({ job_id: job.id })), { onConflict: "job_id", ignoreDuplicates: true })
      .select("job_id");
    if (claimError) throw new Error(`올린 공고 기록을 쓰지 못했어요: ${claimError.message}`);
    claimed = (inserted ?? []).map((r: { job_id: number }) => Number(r.job_id));
    if (claimed.length === 0) return { posted: 0, error: null };

    const jobs = candidates.filter((job) => claimed.includes(job.id)).sort((a, b) => a.id - b.id);
    const threadId = await publishText(row, composeThreadsText(jobs));

    await supabase.from("threads_posts").update({ status: "올림", thread_id: threadId, posted_at: new Date().toISOString(), error: null }).in("job_id", claimed);
    await recordError(null);
    return { posted: claimed.length, error: null };
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    console.error("[threads] 새 공고 올리기 실패", message);
    await recordError(message).catch(() => {});
    if (claimed.length > 0) {
      await supabase.from("threads_posts").update({ status: "실패", error: message }).in("job_id", claimed).then(undefined, () => {});
    }
    return { posted: 0, error: message };
  }
}

/**
 * 관리자 · '실패한 공고 다시 올리기'. 기록이 '실패'인 공고를 지우고 다시 올린다 (글 하나로 묶음).
 * 숨겼거나 마감이 지난 공고는 올리지 않고 기록만 지운다.
 */
export async function retryFailedThreadsPosts(): Promise<ShareResult & { failed: number }> {
  const supabase = createServiceClient();
  if (!supabase) return { posted: 0, failed: 0, error: "SUPABASE_SECRET_KEY 환경 변수가 없어요." };
  const { data, error } = await supabase.from("threads_posts").select("job_id").eq("status", "실패");
  if (error) return { posted: 0, failed: 0, error: `실패 기록을 읽지 못했어요: ${error.message}` };
  const ids = (data ?? []).map((r: { job_id: number }) => Number(r.job_id));
  if (ids.length === 0) return { posted: 0, failed: 0, error: null };
  const { error: delError } = await supabase.from("threads_posts").delete().in("job_id", ids).eq("status", "실패");
  if (delError) return { posted: 0, failed: ids.length, error: `실패 기록을 지우지 못했어요: ${delError.message}` };
  const result = await shareNewJobsOnThreads(ids, { retry: true });
  return { ...result, failed: ids.length };
}

export type ThreadsStatus = {
  /** 앱 ID·시크릿이 있는가 (환경 변수 또는 관리자 화면에서 저장) */
  keysConfigured: boolean;
  /** 어디에 들어 있나: 환경 변수(env) / 관리자 화면(admin) */
  keysSource: "env" | "admin" | null;
  /** 저장된 앱 ID (화면에 보여줌. 시크릿은 보여주지 않는다) */
  appId: string | null;
  /** 연결 정보 표를 읽을 수 있는가 (SUPABASE_SECRET_KEY 와 표가 있는가) */
  storageReady: boolean;
  connected: boolean;
  username: string | null;
  expiresAt: string | null;
  connectedAt: string | null;
  lastError: string | null;
};

/** 관리자 화면에 보여줄 연결 상태 */
export async function getThreadsStatus(): Promise<ThreadsStatus> {
  const status: ThreadsStatus = {
    keysConfigured: false,
    keysSource: null,
    appId: null,
    storageReady: false,
    connected: false,
    username: null,
    expiresAt: null,
    connectedAt: null,
    lastError: null,
  };
  try {
    const keys = await appKeys();
    status.keysConfigured = keys !== null;
    status.keysSource = keys?.source ?? null;
    status.appId = keys?.id ?? null;
    const row = await readRow();
    status.storageReady = true;
    if (row) {
      status.connected = Date.parse(row.expires_at) > Date.now();
      status.username = row.username;
      status.expiresAt = row.expires_at;
      status.connectedAt = row.connected_at;
      status.lastError = row.last_error;
    }
  } catch (err) {
    status.lastError = err instanceof Error ? err.message : String(err);
  }
  return status;
}

export type ThreadsPostRow = { jobId: number; title: string; status: string; postedAt: string | null; createdAt: string; error: string | null };

/** 관리자 화면 · 최근에 올린(또는 실패한) 공고 10개 */
export async function getRecentThreadsPosts(): Promise<ThreadsPostRow[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("threads_posts")
    .select("job_id, status, posted_at, created_at, error, jobs(title)")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error || !data) return [];
  return (data as unknown as { job_id: number; status: string; posted_at: string | null; created_at: string; error: string | null; jobs: { title: string } | { title: string }[] | null }[]).map((r) => {
    const job = Array.isArray(r.jobs) ? r.jobs[0] : r.jobs;
    return { jobId: Number(r.job_id), title: job?.title ?? "(지운 공고)", status: r.status, postedAt: r.posted_at, createdAt: r.created_at, error: r.error };
  });
}

/** 관리자 화면 · '실패'로 남은 공고 수 (다시 올리기 버튼에 보여줌) */
export async function countFailedThreadsPosts(): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase) return 0;
  const { count, error } = await supabase.from("threads_posts").select("job_id", { count: "exact", head: true }).eq("status", "실패");
  return error ? 0 : (count ?? 0);
}

/* ───────── 올릴 글 (supabase/threads-drafts.sql) ─────────
 * 홍보 담당(예약 작업)이 쓴 Threads 글을 받는 문(/api/threads/drafts)으로 넣으면 '대기'로 쌓인다.
 * 운영자가 관리자 화면에서 글을 읽고(고치고) [올리기]를 눌러야 Threads 에 올라간다. [버리기]는 올리지 않고 치운다.
 * 같은 날짜(for_date) 글은 하나만 받는다. 올리다 실패하면 다시 '대기'로 두고 이유를 error 에 남긴다.
 */

/** Threads 글 최대 글자 수 (Meta 규칙) */
export const THREADS_DRAFT_MAX = 500;

export type ThreadsDraft = {
  id: number;
  body: string;
  forDate: string | null;
  status: "대기" | "올리는 중" | "올림" | "버림";
  threadId: string | null;
  error: string | null;
  createdAt: string;
  decidedAt: string | null;
};

type DraftRow = {
  id: number;
  body: string;
  for_date: string | null;
  status: ThreadsDraft["status"];
  thread_id: string | null;
  error: string | null;
  created_at: string;
  decided_at: string | null;
};

function toDraft(r: DraftRow): ThreadsDraft {
  return {
    id: Number(r.id),
    body: r.body,
    forDate: r.for_date,
    status: r.status,
    threadId: r.thread_id,
    error: r.error,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
  };
}

/** 줄바꿈을 \n 으로 맞추고 앞뒤 빈칸을 지운다. 빈 글이나 500자를 넘으면 null. */
export function cleanDraftBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const body = raw.replace(/\r\n?/g, "\n").trim();
  if (body.length === 0 || body.length > THREADS_DRAFT_MAX) return null;
  return body;
}

/** 받는 문 · 올릴 글 하나를 '대기'로 넣는다. 같은 날짜 글이 이미 있으면 넣지 않고 그 글 번호를 돌려준다. */
export async function addThreadsDraft(body: string, forDate: string | null): Promise<{ id: number; duplicate: boolean }> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("threads_drafts")
    .upsert({ body, for_date: forDate }, { onConflict: "for_date", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`올릴 글을 저장하지 못했어요: ${error.message}`);
  const inserted = (data ?? []) as { id: number }[];
  if (inserted.length > 0) return { id: Number(inserted[0].id), duplicate: false };
  // 같은 날짜 글이 이미 있음
  const { data: existing, error: readError } = await supabase.from("threads_drafts").select("id").eq("for_date", forDate).maybeSingle();
  if (readError || !existing) throw new Error(`올릴 글을 저장하지 못했어요: ${readError?.message ?? "같은 날짜 글을 찾지 못함"}`);
  return { id: Number((existing as { id: number }).id), duplicate: true };
}

/** 관리자 화면 · '대기' 글 전부(오래된 것 먼저) + 최근에 올리거나 버린 글 5개 */
export async function getThreadsDrafts(): Promise<{ waiting: ThreadsDraft[]; done: ThreadsDraft[]; ready: boolean }> {
  const supabase = createServiceClient();
  if (!supabase) return { waiting: [], done: [], ready: false };
  const cols = "id, body, for_date, status, thread_id, error, created_at, decided_at";
  const [waiting, done] = await Promise.all([
    supabase.from("threads_drafts").select(cols).in("status", ["대기", "올리는 중"]).order("created_at", { ascending: true }).limit(30),
    supabase.from("threads_drafts").select(cols).in("status", ["올림", "버림"]).order("decided_at", { ascending: false }).limit(5),
  ]);
  if (waiting.error || done.error) return { waiting: [], done: [], ready: false };
  return { waiting: (waiting.data as DraftRow[]).map(toDraft), done: (done.data as DraftRow[]).map(toDraft), ready: true };
}

/**
 * 관리자 · [올리기]. 고친 글로 바꾼 뒤 Threads 에 올린다.
 * 두 번 눌러도 한 번만 올라가게, 먼저 '대기' → '올리는 중'으로 바꾼 경우에만 올린다.
 */
export async function postThreadsDraft(id: number, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = serviceClient();
  const { data: claimed, error: claimError } = await supabase
    .from("threads_drafts")
    .update({ body, status: "올리는 중", error: null })
    .eq("id", id)
    .eq("status", "대기")
    .select("id");
  if (claimError) return { ok: false, error: `글을 읽지 못했어요: ${claimError.message}` };
  if (!claimed || claimed.length === 0) return { ok: false, error: "이미 올렸거나 버린 글이에요." };

  try {
    const row = await getConnection();
    if (!row) throw new Error("Threads 연결이 없거나 만료됐어요. 위에서 다시 연결해 주세요.");
    const threadId = await publishText(row, body);
    await supabase.from("threads_drafts").update({ status: "올림", thread_id: threadId, decided_at: new Date().toISOString() }).eq("id", id);
    await recordError(null).catch(() => {});
    return { ok: true };
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    console.error("[threads] 올릴 글 게시 실패", message);
    // 다시 누를 수 있게 '대기'로 되돌린다
    await supabase.from("threads_drafts").update({ status: "대기", error: message }).eq("id", id).then(undefined, () => {});
    return { ok: false, error: message };
  }
}

/** 관리자 · [버리기]. 올리지 않고 치운다 (이미 올렸거나 버린 글은 그대로). */
export async function discardThreadsDraft(id: number): Promise<void> {
  const { error } = await serviceClient()
    .from("threads_drafts")
    .update({ status: "버림", decided_at: new Date().toISOString() })
    .eq("id", id)
    // '올리는 중'에서 멈춘 글(서버가 중간에 끊긴 경우)도 치울 수 있게
    .in("status", ["대기", "올리는 중"]);
  if (error) throw new Error(`글을 버리지 못했어요: ${error.message}`);
}
