import type {
  Asset,
  AssetCondition,
  AssetDetail,
  AssetIncident,
  AssetIncidentKind,
  AssetInput,
  AssetOptions,
  AssetRequest,
  AssetRequestType,
  AssetSetup,
  GatePass,
  ImportAssetRow,
  ImportAssetsResult,
  KitCheck,
  MyAssetsOverview,
  StockMoveInput,
  StockMovement,
  StockOverview,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

type ReturnTo = 'idle' | 'in_use_shared' | 'needs_repair';

/**
 * OPS asset manager. Every asset sits in a punch zone and may also be held by
 * one person; lab items are lent with a due date; only flagged categories go
 * out on gate passes. Stock is counted per zone.
 */
export const opsApi = {
  // ── Register ──
  options: async (): Promise<AssetOptions> => (await api.get<AssetOptions>('/assets/options')).data,
  listAssets: async (holderId?: string): Promise<Asset[]> =>
    (await api.get<Asset[]>('/assets', { params: holderId ? { holderId } : {} })).data,
  getAsset: async (id: string): Promise<AssetDetail> =>
    (await api.get<AssetDetail>(`/assets/${id}`)).data,
  createAsset: async (input: AssetInput): Promise<Asset> =>
    (await api.post<Asset>('/assets', input)).data,
  updateAsset: async (id: string, input: Partial<AssetInput>): Promise<Asset> =>
    (await api.patch<Asset>(`/assets/${id}`, input)).data,
  importAssets: async (input: {
    rows: ImportAssetRow[];
    dryRun?: boolean;
  }): Promise<ImportAssetsResult> =>
    (await api.post<ImportAssetsResult>('/assets/import', input)).data,
  issue: async (
    id: string,
    input: { employeeId: string; zoneId?: string; dueOn?: string; note?: string },
  ): Promise<Asset> => (await api.post<Asset>(`/assets/${id}/issue`, input)).data,
  takeBack: async (
    id: string,
    input: { condition: AssetCondition; toStatus?: ReturnTo; note?: string },
  ): Promise<Asset> => (await api.post<Asset>(`/assets/${id}/return`, input)).data,
  transfer: async (
    id: string,
    input: {
      employeeId: string;
      zoneId?: string;
      dueOn?: string;
      condition?: AssetCondition;
      note?: string;
    },
  ): Promise<Asset> => (await api.post<Asset>(`/assets/${id}/transfer`, input)).data,
  move: async (id: string, input: { zoneId: string; note?: string }): Promise<Asset> =>
    (await api.post<Asset>(`/assets/${id}/move`, input)).data,
  setStatus: async (
    id: string,
    input: {
      status: ReturnTo | 'scrapped' | 'gifted';
      giftedTo?: string;
      note?: string;
    },
  ): Promise<Asset> => (await api.post<Asset>(`/assets/${id}/status`, input)).data,
  kitCheck: async (employeeId: string): Promise<KitCheck> =>
    (await api.get<KitCheck>(`/assets/kit-check/${employeeId}`)).data,

  // ── Incidents ──
  incidents: async (): Promise<AssetIncident[]> =>
    (await api.get<AssetIncident[]>('/assets/incidents')).data,
  reportIncident: async (
    assetId: string,
    input: { kind: AssetIncidentKind; description: string },
  ): Promise<AssetDetail> =>
    (await api.post<AssetDetail>(`/assets/${assetId}/incidents`, input)).data,
  closeIncident: async (
    id: string,
    input: { outcome: string; assetLost?: boolean },
  ): Promise<AssetDetail> =>
    (await api.post<AssetDetail>(`/assets/incidents/${id}/close`, input)).data,

  // ── Setup ──
  setup: async (): Promise<AssetSetup> => (await api.get<AssetSetup>('/asset-setup')).data,
  createCategory: async (input: {
    name: string;
    codePrefix: string;
    kind: 'equipment' | 'lab';
    requiresGatePass: boolean;
  }): Promise<AssetSetup> => (await api.post<AssetSetup>('/asset-setup/categories', input)).data,
  updateCategory: async (
    id: string,
    input: Partial<{
      name: string;
      codePrefix: string;
      kind: 'equipment' | 'lab';
      requiresGatePass: boolean;
    }>,
  ): Promise<AssetSetup> =>
    (await api.patch<AssetSetup>(`/asset-setup/categories/${id}`, input)).data,
  putKit: async (input: {
    designation: string;
    items: { categoryId: string; qty: number }[];
  }): Promise<AssetSetup> => (await api.put<AssetSetup>('/asset-setup/kits', input)).data,

  // ── Requests ──
  requestQueue: async (): Promise<AssetRequest[]> =>
    (await api.get<AssetRequest[]>('/asset-requests')).data,
  createRequest: async (input: {
    type: AssetRequestType;
    assetId?: string;
    categoryId?: string;
    note?: string;
  }): Promise<AssetRequest> => (await api.post<AssetRequest>('/asset-requests', input)).data,
  handleRequest: async (
    id: string,
    input: { status: 'in_progress' | 'declined'; note?: string },
  ): Promise<AssetRequest> => (await api.patch<AssetRequest>(`/asset-requests/${id}`, input)).data,
  fulfilRequest: async (
    id: string,
    input: {
      issueAssetId?: string;
      zoneId?: string;
      dueOn?: string;
      returnCondition?: AssetCondition;
      note?: string;
    },
  ): Promise<AssetRequest> =>
    (await api.post<AssetRequest>(`/asset-requests/${id}/fulfil`, input)).data,

  // ── Gate passes ──
  gatePasses: async (): Promise<GatePass[]> => (await api.get<GatePass[]>('/gate-passes')).data,
  requestGatePass: async (input: {
    assetId: string;
    purpose: string;
    destination: string;
    returnOn: string;
    disclaimerAccepted: true;
  }): Promise<GatePass> => (await api.post<GatePass>('/gate-passes', input)).data,
  approvePass: async (id: string): Promise<GatePass> =>
    (await api.post<GatePass>(`/gate-passes/${id}/approve`)).data,
  declinePass: async (id: string, reason: string): Promise<GatePass> =>
    (await api.post<GatePass>(`/gate-passes/${id}/decline`, { reason })).data,
  markPassBack: async (id: string): Promise<GatePass> =>
    (await api.post<GatePass>(`/gate-passes/${id}/back`)).data,

  // ── Stock ──
  stock: async (): Promise<StockOverview> => (await api.get<StockOverview>('/stock')).data,
  createStockItem: async (input: {
    sku: string;
    name: string;
    category?: string;
    unit?: string;
  }): Promise<StockOverview> => (await api.post<StockOverview>('/stock/items', input)).data,
  updateStockItem: async (
    id: string,
    input: Partial<{ name: string; category: string | null; unit: string; active: boolean }>,
  ): Promise<StockOverview> => (await api.patch<StockOverview>(`/stock/items/${id}`, input)).data,
  moveStock: async (input: StockMoveInput): Promise<StockOverview> =>
    (await api.post<StockOverview>('/stock/movements', input)).data,
  stockMovements: async (filter: { itemId?: string } = {}): Promise<StockMovement[]> =>
    (await api.get<StockMovement[]>('/stock/movements', { params: filter })).data,

  // ── Mine ──
  mine: async (): Promise<MyAssetsOverview> => (await api.get<MyAssetsOverview>('/my-assets')).data,
  loanBack: async (assetId: string): Promise<Asset> =>
    (await api.post<Asset>(`/my-assets/loans/${assetId}/back`)).data,
  loanExtend: async (
    assetId: string,
    input: { returnOn: string; reason: string },
  ): Promise<Asset> => (await api.post<Asset>(`/my-assets/loans/${assetId}/extend`, input)).data,
  passBack: async (id: string): Promise<GatePass> =>
    (await api.post<GatePass>(`/my-assets/passes/${id}/back`)).data,
  passExtend: async (id: string, input: { returnOn: string; reason: string }): Promise<GatePass> =>
    (await api.post<GatePass>(`/my-assets/passes/${id}/extend`, input)).data,
  reportMyIncident: async (
    assetId: string,
    input: { kind: AssetIncidentKind; description: string },
  ): Promise<void> => {
    await api.post(`/my-assets/${assetId}/incidents`, input);
  },
};
