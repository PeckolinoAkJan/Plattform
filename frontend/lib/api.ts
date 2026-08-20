import axios, { AxiosError, type AxiosResponse } from "axios";
import { removeStoredAuthToken } from "./auth-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

type ApiLogEntry = {
  status: number;
  method: string;
  url: string;
};

export type LogbookEntry = {
  id: string;
  startTs: string;
  createdAt: string;
  game: string;
  cargo: string;
  sourceCity: string;
  destinationCity: string;
  truckModel: string;
  distanceKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  damageDelta: number;
  isWotr: boolean;
  isValidForScore: boolean;
  payload?: {
    distanceKm?: number;
    maxSpeedKmh?: number;
    avgSpeedKmh?: number;
    cargo?: string;
    cargoName?: string;
    sourceCity?: string;
    destinationCity?: string;
    truckModel?: string;
    game?: string;
    createdAt?: string;
  };
};

export type Company = {
  id: string;
  name: string;
  tag?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  avatarUrl?: string | null;
  members?: Array<{
    id: string;
    displayName: string;
    companyRole: string | null;
  }>;
};

export type UserProfile = {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  isPremium: boolean;
  globalRoles: string[];
  companyId: string | null;
  companyRole: string | null;
  profileVisibility: string;
  passwordConfigured?: boolean;
  createdAt: string;
  updatedAt: string;
  stats?: {
    totalDistance: number;
    totalDeliveries: number;
  } | null;
  company?: {
    id: string;
    name: string;
    tag: string | null;
    logoUrl: string | null;
  } | null;
  connectedAccounts?: Array<{
    provider: string;
    connectedAt: string;
  }>;
};

export type AuthProviders = Record<"google" | "discord" | "steam", boolean>;

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    companyRole?: string | null;
  };
};

let hasRedirectedToLogin = false;

function serializeAuthPath(pathname = "", search = "") {
  const returnTo = `${pathname}${search}`;
  if (!returnTo.startsWith("/")) {
    return "/dashboard";
  }

  if (returnTo.startsWith("//") || returnTo.startsWith("/api/")) {
    return "/dashboard";
  }

  return returnTo;
}

function emitAuthExpired() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    removeStoredAuthToken();
    window.dispatchEvent(new Event("vtc:auth-expired"));
  } catch {
    // noop
  }

  if (window.location.pathname !== "/login" && !hasRedirectedToLogin) {
    hasRedirectedToLogin = true;
    const returnTo = serializeAuthPath(
      window.location.pathname,
      window.location.search,
    );
    window.location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
}

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error instanceof AxiosError && error.response?.status === 401) {
      emitAuthExpired();
    }

    return Promise.reject(error);
  },
);

const logApiInteraction = (entry: ApiLogEntry) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.dispatchEvent(new CustomEvent("vtc:api-log", { detail: entry }));
  } catch {
    // no-op
  }
};

export const getLogbookEntries = async () => {
  const response = await api.get<LogbookEntry[]>("/api/logbook");
  logApiInteraction({
    status: response.status,
    method: "GET",
    url: "/api/logbook",
  });
  return response.data;
};

export const getCompanyProfile = async () => {
  const response = await api.get<Company>("/api/company");
  logApiInteraction({
    status: response.status,
    method: "GET",
    url: "/api/company",
  });
  return response.data;
};

export const updateCompanyProfile = async (payload: Partial<Company>) => {
  const response = await api.patch<Company>("/api/company", payload);
  logApiInteraction({
    status: response.status,
    method: "PATCH",
    url: "/api/company",
  });
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get<UserProfile>("/api/users/me");
  logApiInteraction({
    status: response.status,
    method: "GET",
    url: "/api/users/me",
  });
  return response.data;
};

export const updateCurrentUser = async (payload: Partial<UserProfile>) => {
  const response = await api.patch<UserProfile>("/api/users/me", payload);
  logApiInteraction({
    status: response.status,
    method: "PATCH",
    url: "/api/users/me",
  });
  return response.data;
};

export const getAuthProviders = async () => {
  const response = await api.get<AuthProviders>("/api/auth/providers");
  return response.data;
};

export const getProviderLinkUrl = (provider: keyof AuthProviders) => {
  const baseUrl = `${API_BASE_URL}`.replace(/\/$/, "");
  return `${baseUrl}/api/auth/${provider}/link?returnTo=${encodeURIComponent("/dashboard/profile")}`;
};

export const setCurrentUserPassword = async (payload: {
  currentPassword?: string;
  newPassword: string;
}) => {
  const response = await api.patch<{ passwordConfigured: true }>(
    "/api/users/me/password",
    payload,
  );
  return response.data;
};

export const getChatMessages = async (limit = 100) => {
  const response = await api.get<{ companyId: string; messages: ChatMessage[] }>(
    "/api/chat/messages",
    { params: { limit } },
  );
  return response.data;
};

export const sendChatMessage = async (body: string) => {
  const response = await api.post<ChatMessage>("/api/chat/messages", { body });
  return response.data;
};

export const logbookApi = {
  list: getLogbookEntries,
};

export const companyApi = {
  get: getCompanyProfile,
  update: updateCompanyProfile,
};

export const chatApi = {
  list: getChatMessages,
  send: sendChatMessage,
};
