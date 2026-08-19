/**
 * 병원 서버 전용 API 클라이언트.
 *
 * 요청은 브라우저 fetch 가 아니라 Tauri HTTP 플러그인으로 내보낸다.
 * 웹뷰를 거치지 않으므로 preflight/CORS 자체가 발생하지 않는다.
 * (맨 fetch 를 쓰면 번들 앱 origin 이 tauri://localhost 라 서버가 403 을 준다.)
 *
 * Towercrane 토큰 키를 쓰지 않도록 저장소 키에 병원 접두사를 붙인다.
 */
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

// 당분간 병원 서버와 API 프로세스를 함께 사용한다. 필요하면 나중에 Study 서버로 분리한다.
const LOCAL_API_BASE = "http://localhost:4301";
const DEPLOY_API_BASE = import.meta.env.VITE_API_BASE ?? "https://dxline-tallent.com";

const ACCESS_KEY = "tuntun.devstudy.accessToken";
const REFRESH_KEY = "tuntun.devstudy.refreshToken";
const API_TARGET_KEY = "tuntun.devstudy.apiTarget";

export type ApiTarget = "local" | "deploy";

function isApiTarget(value: string | null): value is ApiTarget {
  return value === "local" || value === "deploy";
}

export function getApiTarget(): ApiTarget {
  const saved = localStorage.getItem(API_TARGET_KEY);
  if (isApiTarget(saved)) return saved;
  // 개발 중에는 로컬 서버를, 설치된 앱은 운영 서버를 기본으로 본다.
  return import.meta.env.DEV ? "local" : "deploy";
}

export function setApiTarget(target: ApiTarget) {
  localStorage.setItem(API_TARGET_KEY, target);
}

export function getApiBase() {
  return getApiTarget() === "local" ? LOCAL_API_BASE : DEPLOY_API_BASE;
}

/** 앱 시작 시점 값. 화면 표시에만 쓰고, 실제 요청은 getApiBase() 를 그때그때 읽는다. */
export const API_BASE = getApiBase();

export const tokenStorage = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  save(accessToken: string, refreshToken: string) {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/**
 * 세션이 완전히 끊겼을 때(access 만료 + refresh 재발급 실패) 앱에 알린다.
 * auth-store 가 구독해서 로그인 화면으로 돌려보낸다.
 */
type SessionExpiredHandler = () => void;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(handler: SessionExpiredHandler | null) {
  sessionExpiredHandler = handler;
}

export const SESSION_EXPIRED_MESSAGE = "세션이 만료되었습니다. 다시 로그인해 주세요.";

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  errorMessage?: string;
  /** 401 재시도 루프를 막기 위해 refresh 요청 자신은 이 플래그로 제외한다. */
  skipRefresh?: boolean;
};

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const token = tokenStorage.access();
  return tauriFetch(`${getApiBase()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

/** access token 이 만료됐을 때 한 번만 조용히 재발급한다. 실패하면 로그아웃 상태로 떨군다. */
async function refreshOnce(): Promise<boolean> {
  const refreshToken = tokenStorage.refresh();
  if (!refreshToken) return false;

  const response = await tauriFetch(`${getApiBase()}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    tokenStorage.clear();
    return false;
  }

  const data = (await response.json()) as { accessToken: string; refreshToken: string };
  tokenStorage.save(data.accessToken, data.refreshToken);
  return true;
}

/**
 * 서버는 refresh 할 때마다 refresh token 을 회전시킨다.
 * 화면 여러 개가 동시에 401 을 맞아도 재발급은 한 번만 돌려야 서로의 토큰을 무효화하지 않는다.
 */
let refreshInFlight: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  refreshInFlight ??= refreshOnce()
    .catch(() => {
      tokenStorage.clear();
      return false;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await rawRequest(path, options);

  if (response.status === 401 && !options.skipRefresh) {
    if (await tryRefresh()) {
      response = await rawRequest(path, options);
    }
    // 재발급까지 실패했으면 더 볼 것 없이 세션을 끊고 로그인 화면으로 돌린다.
    if (response.status === 401) {
      tokenStorage.clear();
      sessionExpiredHandler?.();
      throw new ApiError(401, SESSION_EXPIRED_MESSAGE);
    }
  }

  if (!response.ok) {
    let message = options.errorMessage ?? "요청을 처리하지 못했습니다.";
    let raw = "";
    try {
      raw = await response.text();
      const body = JSON.parse(raw);
      if (body?.message) message = body.message;
    } catch {
      // 응답 본문이 JSON이 아니면 기본 메시지를 그대로 쓴다
    }
    // 플러그인 요청은 웹뷰 Network 탭에 안 잡히므로 콘솔에 직접 남긴다.
    console.error(`API ${options.method ?? "GET"} ${getApiBase()}${path} -> ${response.status}`, raw);
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
