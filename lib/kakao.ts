import { createServiceClient } from "@/lib/supabase/service";
import { SITE_URL } from "@/lib/site";

/*
 * 카톡 알림 — 카카오 '나에게 보내기'. 운영자 본인의 카카오 계정을 한 번 연결해 두면,
 * 사이트가 운영자 카톡 '나와의 채팅'으로 메시지를 보낸다 (강사섭외 의뢰가 들어왔을 때).
 *
 * 준비물 (Vercel 환경 변수): KAKAO_REST_API_KEY (카카오 개발자 앱 '강사잇다'의 REST API 키),
 *   KAKAO_CLIENT_SECRET (앱에서 Client Secret 을 켰을 때만), SUPABASE_SECRET_KEY (토큰 표를 읽고 쓰려고).
 * 카카오 개발자 앱 설정: 카카오 로그인 활성화, Redirect URI = SITE_URL + /api/kakao/callback,
 *   동의항목 '카카오톡 메시지 전송(talk_message)'.
 *
 * 열쇠(토큰) 관리: 접근 토큰은 6시간, 갱신 토큰은 2달쯤 간다. 보낼 때마다 접근 토큰이 임박했으면 갱신하고,
 * 카카오가 새 갱신 토큰을 주면 같이 저장한다. 갱신 토큰까지 만료되면 관리자 화면에서 다시 연결해야 한다.
 */

const AUTH_URL = "https://kauth.kakao.com/oauth/authorize";
const TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const SEND_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send";
const SCOPE = "talk_message";
/** 접근 토큰이 이만큼 안에 만료되면 미리 갱신한다 */
const REFRESH_AHEAD_MS = 10 * 60 * 1000;

export const KAKAO_CALLBACK_PATH = "/api/kakao/callback";
export const KAKAO_STATE_COOKIE = "gs-kakao-state";

export function kakaoRestKey(): string | null {
  return process.env.KAKAO_REST_API_KEY?.trim() || null;
}

function redirectUri() {
  return `${SITE_URL}${KAKAO_CALLBACK_PATH}`;
}

/** 운영자를 카카오 로그인(동의) 화면으로 보낼 주소 */
export function kakaoAuthorizeUrl(state: string): string | null {
  const key = kakaoRestKey();
  if (!key) return null;
  const params = new URLSearchParams({
    client_id: key,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    state,
    // 이미 동의했어도 '나에게 보내기' 권한을 다시 확인한다
    prompt: "consent",
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
};

type TokenRow = {
  access_token: string;
  access_expires_at: string;
  refresh_token: string;
  refresh_expires_at: string;
  connected_at: string;
  last_error: string | null;
};

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const key = kakaoRestKey();
  if (!key) throw new Error("KAKAO_REST_API_KEY 환경 변수가 없어요.");
  const form = new URLSearchParams({ client_id: key, ...body });
  const secret = process.env.KAKAO_CLIENT_SECRET?.trim();
  if (secret) form.set("client_secret", secret);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: form,
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    const code = (data as { error_code?: string }).error_code ?? "";
    throw new Error(`카카오 토큰 오류 ${code} ${data.error ?? res.status}: ${data.error_description ?? ""}`.replace(/\s+/g, " ").trim());
  }
  return data;
}

function serviceClient() {
  const supabase = createServiceClient();
  if (!supabase) throw new Error("SUPABASE_SECRET_KEY 환경 변수가 없어요.");
  return supabase;
}

async function readRow(): Promise<TokenRow | null> {
  const { data, error } = await serviceClient().from("kakao_tokens").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`카톡 연결 정보를 읽지 못했어요: ${error.message}`);
  return (data as TokenRow | null) ?? null;
}

/** 카카오가 준 토큰을 표에 저장한다 (갱신 토큰이 안 왔으면 기존 것을 유지). */
async function saveTokens(t: TokenResponse, previous: TokenRow | null, connectedAt?: string) {
  const now = Date.now();
  const row = {
    id: 1,
    access_token: t.access_token,
    access_expires_at: new Date(now + t.expires_in * 1000).toISOString(),
    refresh_token: t.refresh_token ?? previous?.refresh_token ?? "",
    refresh_expires_at: t.refresh_token
      ? new Date(now + (t.refresh_token_expires_in ?? 60 * 24 * 3600) * 1000).toISOString()
      : (previous?.refresh_expires_at ?? new Date(now).toISOString()),
    connected_at: connectedAt ?? previous?.connected_at ?? new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
    last_error: null,
  };
  const { error } = await serviceClient().from("kakao_tokens").upsert(row);
  if (error) throw new Error(`카톡 연결 정보를 저장하지 못했어요: ${error.message}`);
}

/** 카카오 로그인 뒤 돌아온 code 로 토큰을 받아 저장한다 (연결 완료). */
export async function connectKakao(code: string): Promise<void> {
  const tokens = await postToken({ grant_type: "authorization_code", redirect_uri: redirectUri(), code });
  await saveTokens(tokens, null, new Date().toISOString());
}

/** 연결 끊기: 표의 한 줄을 지운다. (카카오 쪽 연결 해제는 운영자가 카카오 계정 설정에서 한다) */
export async function disconnectKakao(): Promise<void> {
  const { error } = await serviceClient().from("kakao_tokens").delete().eq("id", 1);
  if (error) throw new Error(`연결을 끊지 못했어요: ${error.message}`);
}

/** 쓸 수 있는 접근 토큰. 임박했으면 갱신한다. 연결이 없거나 갱신 토큰이 만료됐으면 null. */
async function getAccessToken(): Promise<string | null> {
  const row = await readRow();
  if (!row) return null;
  if (Date.parse(row.refresh_expires_at) < Date.now()) return null;
  if (Date.parse(row.access_expires_at) - Date.now() > REFRESH_AHEAD_MS) return row.access_token;
  const refreshed = await postToken({ grant_type: "refresh_token", refresh_token: row.refresh_token });
  await saveTokens(refreshed, row);
  return refreshed.access_token;
}

async function recordError(message: string | null) {
  await serviceClient().from("kakao_tokens").update({ last_error: message, updated_at: new Date().toISOString() }).eq("id", 1);
}

/**
 * 운영자 카톡 '나와의 채팅'으로 글 메시지를 보낸다. 버튼을 누르면 url 이 열린다.
 * 실패해도 예외를 던지지 않고 false 를 돌려준다 (의뢰 저장을 막지 않게). 이유는 표의 last_error 에 남긴다.
 */
export async function sendKakaoToMe(text: string, url: string, buttonTitle = "관리자 화면 열기"): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) {
      await recordError("카카오 연결이 없거나 만료됐어요. 관리자 화면에서 다시 연결해 주세요.").catch(() => {});
      return false;
    }
    const template = {
      object_type: "text",
      text: text.slice(0, 200), // 카카오 글 메시지는 200자까지
      link: { web_url: url, mobile_web_url: url },
      button_title: buttonTitle,
    };
    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: new URLSearchParams({ template_object: JSON.stringify(template) }),
    });
    if (!res.ok) {
      const body = await res.text();
      await recordError(`카카오가 거절함 (HTTP ${res.status}) ${body.slice(0, 200)}`);
      return false;
    }
    await recordError(null);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[kakao] 보내기 실패", message);
    await recordError(message.slice(0, 300)).catch(() => {});
    return false;
  }
}

export type KakaoStatus = {
  /** REST API 키가 Vercel 에 들어 있는가 */
  keyConfigured: boolean;
  /** 토큰 표를 읽을 수 있는가 (SUPABASE_SECRET_KEY 와 표가 있는가) */
  storageReady: boolean;
  connected: boolean;
  /** 갱신 토큰 만료 (한국 시각 글자). 지나면 다시 연결 */
  refreshExpiresAt: string | null;
  connectedAt: string | null;
  lastError: string | null;
};

/** 관리자 화면에 보여줄 연결 상태 */
export async function getKakaoStatus(): Promise<KakaoStatus> {
  const status: KakaoStatus = {
    keyConfigured: kakaoRestKey() !== null,
    storageReady: false,
    connected: false,
    refreshExpiresAt: null,
    connectedAt: null,
    lastError: null,
  };
  try {
    const row = await readRow();
    status.storageReady = true;
    if (row) {
      status.connected = Date.parse(row.refresh_expires_at) > Date.now();
      status.refreshExpiresAt = row.refresh_expires_at;
      status.connectedAt = row.connected_at;
      status.lastError = row.last_error;
    }
  } catch (err) {
    status.lastError = err instanceof Error ? err.message : String(err);
  }
  return status;
}
