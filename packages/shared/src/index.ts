export type Role = "client" | "admin";

export type ContractStatus = "active" | "inactive";

export type Money = {
  currency: "RUB";
  amount: number; // minor units not used in demo; in prod use bigint minor units
};

export type RecommendationItem = {
  referredBitrixContactId: string;
  fullName: string;
  contractId: string;
  contractDate: string; // ISO
  reward: Money;
  status: ContractStatus;
  depth: number;
  path: string[]; // chain of Bitrix contact IDs from root->node
};

export type ClientDashboardSummary = {
  directRecommendationsCount: number;
  totalReward: Money;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type ApiError = {
  error: string;
  message: string;
  requestId?: string;
  details?: unknown;
};



