import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import {
  Loader2,
  RefreshCcw,
  TrendingUp,
  PackageOpen,
  Users,
  ClipboardList,
  Gauge,
  Sparkles,
  ChevronDown,
  CheckCircle2,
  Circle,
  Layers,
  History,
  AlertTriangle,
} from 'lucide-react';

type MetricSnapshot = {
  revenue: number;
  orders: number;
  activeSuppliers: number;
  pendingTasks: number;
  performanceIndex: number;
};

type RevenuePoint = { month: string; value: number };
type SupplierPoint = { supplier: string; engagement: number };
type ProductivityPoint = { period: string; value: number };
type PurchaseExpenseRatio = { purchases: number; expenses: number };

type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  actionLabel?: string;
  linkedEntity?: {
    entityId: string;
    domainId?: string;
    domainName?: string;
  } | null;
};

type EntityCoverage = {
  entityId: string;
  label: string;
  count: number;
  lastUpdated?: string | null;
  domainId: string;
  domainName: string;
};

type DomainStat = {
  domainId: string;
  domainName: string;
  totalEntities: number;
  populatedEntities: number;
  totalRecords: number;
  entities?: EntityCoverage[];
};

type DataHealth = {
  totalEntities: number;
  populatedEntities: number;
  totalRecords: number;
  overallScore: number;
  lastUpdated?: string | null;
};

type RecentActivityItem = {
  type: string;
  description: string;
  timestamp: string;
  meta?: Record<string, unknown>;
};

type OverviewPayload = {
  topMetrics: MetricSnapshot;
  monthlyRevenue: RevenuePoint[];
  supplierEngagement: SupplierPoint[];
  purchaseExpenseRatio: PurchaseExpenseRatio;
  productivityTrend: ProductivityPoint[];
  aiSummary: string | null;
  onboardingChecklist?: ChecklistItem[];
  entityStats?: DomainStat[];
  domainCoverage?: DomainStat[];
  dataHealth?: DataHealth;
  recentActivity?: RecentActivityItem[];
  sourcingActivity?: {
    rfqOpen: number;
    rfqTotal: number;
    rfpOpen: number;
    rfpTotal: number;
  };
};

const CHART_COLORS = {
  primary: '#2563eb',
  accent: '#818cf8',
  bar: '#38bdf8',
  barSecondary: '#0ea5e9',
  pie: ['#2563eb', '#f97316'],
  areaStroke: '#22c55e',
  areaFill: 'rgba(34, 197, 94, 0.18)',
};

const DEFAULT_DATA_HEALTH: DataHealth = {
  totalEntities: 0,
  populatedEntities: 0,
  totalRecords: 0,
  overallScore: 0,
  lastUpdated: undefined,
};

const DEFAULT_OVERVIEW: OverviewPayload = {
  topMetrics: {
    revenue: 0,
    orders: 0,
    activeSuppliers: 0,
    pendingTasks: 0,
    performanceIndex: 0,
  },
  monthlyRevenue: [],
  supplierEngagement: [],
  purchaseExpenseRatio: { purchases: 0, expenses: 0 },
  productivityTrend: [],
  aiSummary: null,
  sourcingActivity: {
    rfqOpen: 0,
    rfqTotal: 0,
    rfpOpen: 0,
    rfpTotal: 0,
  },
  onboardingChecklist: [],
  entityStats: [],
  domainCoverage: [],
  dataHealth: DEFAULT_DATA_HEALTH,
  recentActivity: [],
};

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() ?? '';
  }
  return '';
};

const formatCurrency = (value: number) =>
  value
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: value >= 100000 ? 0 : 2,
      }).format(value)
    : '$0';

const formatNumber = (value: number) => value.toLocaleString('en-US');

const formatPercent = (value: number) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : '—';

const TooltipContent = ({ label, payload }: TooltipProps<ValueType, NameType>) => {
  if (!payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      {payload.map((entry, idx) => {
        if (!entry || entry.value == null) return null;
        return (
          <p key={idx} className="text-sm text-slate-700">
            {entry.name}: <span className="font-semibold">{entry.value}</span>
          </p>
        );
      })}
    </div>
  );
};

const ChartCard = ({
  title,
  description,
  empty,
  children,
}: {
  title: string;
  description?: string;
  empty: boolean;
  children: ReactNode;
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-6 flex flex-col gap-1">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      {description ? <p className="text-sm text-slate-400">{description}</p> : null}
    </div>
    <div className="h-64">
      {empty ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">No data available yet.</div>
      ) : (
        children
      )}
    </div>
  </div>
);

interface ERPOverviewProps {
  onNavigateWorkspace?: () => void;
  onInspectEntity?: (entityId: string, domainId?: string | null) => void;
}

const ERPOverview: React.FC<ERPOverviewProps> = ({
  onNavigateWorkspace = () => {},
  onInspectEntity = () => {},
}) => {
  const [data, setData] = useState<OverviewPayload>(DEFAULT_OVERVIEW);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);

  const fetchOverview = useCallback(async (withSpinner = true) => {
    if (withSpinner) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const headers: Record<string, string> = {};
      const erpUserId = getCookie('versatileErpUserId');
      if (erpUserId) {
        headers['X-User-ID'] = erpUserId;
      }

      const response = await fetch('/api/erp/overview', {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to load overview (${response.status})`);
      }

      const payload = (await response.json()) as OverviewPayload;
      const merged: OverviewPayload = {
        ...DEFAULT_OVERVIEW,
        ...payload,
        topMetrics: { ...DEFAULT_OVERVIEW.topMetrics, ...payload.topMetrics },
        dataHealth: { ...DEFAULT_DATA_HEALTH, ...(payload.dataHealth ?? {}) },
        sourcingActivity: {
          ...DEFAULT_OVERVIEW.sourcingActivity!,
          ...(payload.sourcingActivity ?? {}),
        },
      };
      merged.onboardingChecklist = payload.onboardingChecklist ?? [];
      merged.entityStats = payload.entityStats ?? [];
      merged.domainCoverage = payload.domainCoverage ?? merged.entityStats ?? [];
      merged.recentActivity = payload.recentActivity ?? [];
      setData(merged);
    } catch (err) {
      console.error('Overview load failed', err);
      setError(err instanceof Error ? err.message : 'Unable to load overview data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview(true);
  }, [fetchOverview]);

  const dataHealth = useMemo(
    () => ({ ...DEFAULT_DATA_HEALTH, ...(data.dataHealth ?? DEFAULT_DATA_HEALTH) }),
    [data.dataHealth],
  );

  const topCards = useMemo(
    () => [
      {
        key: 'revenue',
        label: 'Revenue',
        value: formatCurrency(data.topMetrics.revenue ?? 0),
        icon: <TrendingUp className="h-5 w-5 text-indigo-600" />,
        accent: 'bg-indigo-50',
      },
      {
        key: 'orders',
        label: 'Orders',
        value: formatNumber(data.topMetrics.orders ?? 0),
        icon: <PackageOpen className="h-5 w-5 text-sky-600" />,
        accent: 'bg-sky-50',
      },
      {
        key: 'activeSuppliers',
        label: 'Active Suppliers',
        value: formatNumber(data.topMetrics.activeSuppliers ?? 0),
        icon: <Users className="h-5 w-5 text-emerald-600" />,
        accent: 'bg-emerald-50',
      },
      {
        key: 'pendingTasks',
        label: 'Pending Tasks',
        value: formatNumber(data.topMetrics.pendingTasks ?? 0),
        icon: <ClipboardList className="h-5 w-5 text-amber-600" />,
        accent: 'bg-amber-50',
      },
      {
        key: 'performanceIndex',
        label: 'Performance Index',
        value:
          data.topMetrics.performanceIndex > 0
            ? `${Number(data.topMetrics.performanceIndex).toFixed(1)}`
            : '—',
        icon: <Gauge className="h-5 w-5 text-fuchsia-600" />,
        accent: 'bg-fuchsia-50',
      },
      {
        key: 'dataCoverage',
        label: 'Data Coverage',
        value: `${Math.round(dataHealth.overallScore ?? 0)}%`,
        icon: <Layers className="h-5 w-5 text-violet-600" />,
        accent: 'bg-violet-50',
      },
    ],
    [data.topMetrics, dataHealth.overallScore],
  );

  const purchaseExpenseChartData = useMemo(() => {
    const purchases = data.purchaseExpenseRatio?.purchases ?? 0;
    const expenses = data.purchaseExpenseRatio?.expenses ?? 0;
    if (!purchases && !expenses) return [];
    return [
      { name: 'Purchases', value: Number(purchases) },
      { name: 'Expenses', value: Number(expenses) },
    ];
  }, [data.purchaseExpenseRatio]);

  const checklistItems = data.onboardingChecklist ?? [];
  const completedChecklist = checklistItems.filter((item) => item.completed).length;

  const orderedChecklist = useMemo(
    () => checklistItems.slice().sort((a, b) => Number(a.completed) - Number(b.completed)),
    [checklistItems],
  );

  const displayChecklist = orderedChecklist.slice(0, 6);

  const domainCoverage = useMemo(
    () => data.domainCoverage ?? data.entityStats ?? [],
    [data.domainCoverage, data.entityStats],
  );

  const coverageByDomain = useMemo(
    () => domainCoverage.filter((domain) => domain.totalEntities > 0),
    [domainCoverage],
  );

  const entityMap = useMemo(() => {
    const map: Record<string, { domainId: string; domainName: string }> = {};
    (data.entityStats ?? []).forEach((domain) => {
      (domain.entities ?? []).forEach((entity) => {
        map[entity.entityId] = { domainId: entity.domainId, domainName: entity.domainName };
      });
    });
    return map;
  }, [data.entityStats]);

  const recentActivity = data.recentActivity ?? [];

  const formatTimestamp = useCallback((value?: string | null) => {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(value));
    } catch {
      return value;
    }
  }, []);

  const handleChecklistAction = useCallback(
    (item: ChecklistItem) => {
      if (item.completed) return;
      onNavigateWorkspace();
      const entityId = item.linkedEntity?.entityId;
      const domainId = item.linkedEntity?.domainId ?? (entityId ? entityMap[entityId]?.domainId : undefined);
      if (entityId) {
        setTimeout(() => onInspectEntity(entityId, domainId), 160);
      }
    },
    [entityMap, onInspectEntity, onNavigateWorkspace],
  );

  const activityIcon = useCallback((type: string) => {
    switch (type) {
      case 'order':
        return <PackageOpen className="h-4 w-4 text-sky-500" />;
      case 'rfq':
        return <ClipboardList className="h-4 w-4 text-indigo-500" />;
      case 'rfp':
        return <Sparkles className="h-4 w-4 text-purple-500" />;
      case 'finance':
        return <Gauge className="h-4 w-4 text-emerald-500" />;
      default:
        return <History className="h-4 w-4 text-slate-400" />;
    }
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-500">ERP Overview</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Business Health Dashboard</h2>
          <p className="mt-2 text-sm text-slate-500">
            A unified snapshot of revenue performance, supplier momentum, spend balance, and project execution.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchOverview(false)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            disabled={isRefreshing}
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : <RefreshCcw className="h-4 w-4 text-slate-500" />}
            Refresh data
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          <p className="font-semibold">We hit a snag while loading the dashboard.</p>
          <p className="mt-1 text-rose-600">{error}</p>
          <button
            type="button"
            onClick={() => fetchOverview()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100"
          >
            Try again
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-3 text-slate-500 py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm font-medium">Crunching the latest numbers…</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[3fr_1.15fr]">
          <div className="space-y-8">
            {displayChecklist.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-indigo-500">Getting started</p>
                    <h3 className="text-lg font-semibold text-slate-800">Guide your workspace setup</h3>
                    <p className="text-sm text-slate-500">
                      Complete these steps to unlock full analytics across finance, sourcing, and delivery.
                    </p>
                  </div>
                  <div className="text-sm font-medium text-slate-600">
                    <span className="text-slate-900">{completedChecklist}</span> of {checklistItems.length} complete
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {displayChecklist.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border ${
                        item.completed
                          ? 'border-emerald-100 bg-emerald-50/70'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      } p-4 shadow-sm transition`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-1 inline-flex h-5 w-5 items-center justify-center">
                          {item.completed ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-slate-300" />
                          )}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-700">{item.title}</p>
                          <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                          {item.completed ? (
                            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                              <CheckCircle2 className="h-4 w-4" /> Complete
                            </span>
                          ) : (
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <button
                                type="button"
                                onClick={() => handleChecklistAction(item)}
                                className="btn-primary-sm text-sm"
                              >
                                {item.actionLabel ?? 'Add data'}
                              </button>
                              {item.linkedEntity?.domainName ? (
                                <span>{item.linkedEntity.domainName}</span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {orderedChecklist.length > displayChecklist.length ? (
                  <p className="mt-4 text-xs text-slate-400">
                    {orderedChecklist.length - displayChecklist.length} additional checklist item(s) available inside the workspace.
                  </p>
                ) : null}
              </section>
            )}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {topCards.map((card) => (
                <div
                  key={card.key}
                  className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${card.accent}`} />
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-slate-50 p-2">{card.icon}</span>
                    <Sparkles className="h-4 w-4 text-slate-200 opacity-0 transition-opacity group-hover:opacity-80" />
                  </div>
                  <p className="mt-4 text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{card.value}</p>
                </div>
              ))}
            </section>

            {coverageByDomain.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-indigo-500">Data coverage</p>
                    <h3 className="text-lg font-semibold text-slate-800">Where records live today</h3>
                    <p className="text-sm text-slate-500">
                      Populated domains out of {dataHealth.totalEntities} tracked entities.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Layers className="h-5 w-5 text-indigo-500" />
                    <span>
                      {dataHealth.populatedEntities} / {dataHealth.totalEntities} entities populated
                    </span>
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  {coverageByDomain.map((domain) => {
                    const ratio = domain.totalEntities ? (domain.populatedEntities / domain.totalEntities) * 100 : 0;
                    return (
                      <div key={domain.domainId}>
                        <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                          <span>{domain.domainName}</span>
                          <span className="text-slate-500">
                            {domain.populatedEntities}/{domain.totalEntities}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${Math.min(100, Math.round(ratio))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Monthly Revenue Growth"
                description="How booking volume evolved over time for the past periods."
                empty={!data.monthlyRevenue.length}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <RechartsTooltip content={TooltipContent} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      name="Revenue"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Supplier Engagement"
                description="Top suppliers ranked by recent order touchpoints."
                empty={!data.supplierEngagement.length}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.supplierEngagement}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" />
                    <XAxis dataKey="supplier" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                    <RechartsTooltip formatter={(value: number) => formatNumber(value)} />
                    <Bar dataKey="engagement" fill={CHART_COLORS.bar} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
              <ChartCard
                title="Purchase vs Expense Ratio"
                description="Spend distribution between purchasing activity and operational expenses."
                empty={!purchaseExpenseChartData.length}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={purchaseExpenseChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      nameKey="name"
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {purchaseExpenseChartData.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS.pie[index % CHART_COLORS.pie.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Productivity / Completion Trend"
                description="Share of projects or orders that closed successfully each period."
                empty={!data.productivityTrend.length}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.productivityTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" />
                    <XAxis dataKey="period" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} tickFormatter={formatPercent} />
                    <RechartsTooltip formatter={(value: number) => formatPercent(value)} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={CHART_COLORS.areaStroke}
                      fill={CHART_COLORS.areaFill}
                      strokeWidth={2}
                      name="Completion"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-indigo-500">Recent activity</p>
                  <h3 className="text-lg font-semibold text-slate-800">Latest ERP updates</h3>
                </div>
                {recentActivity.length === 0 ? (
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    <AlertTriangle className="h-4 w-4" /> Waiting for first records
                  </span>
                ) : null}
              </div>
              <div className="mt-5 space-y-4">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity, idx) => (
                    <div key={`${activity.type}-${idx}`} className="flex items-start gap-3">
                      <div className="rounded-full bg-slate-100 p-2">{activityIcon(activity.type)}</div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">{activity.description}</p>
                        {typeof activity.meta?.amount === 'number' ? (
                          <p className="text-xs text-slate-500">Value {formatCurrency(Number(activity.meta.amount))}</p>
                        ) : null}
                        <p className="text-xs text-slate-400">{formatTimestamp(activity.timestamp)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No activity yet. Add records to your workspace to see updates here.</p>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-600">Data health</h3>
                <Gauge className="h-4 w-4 text-indigo-500" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{Math.round(dataHealth.overallScore ?? 0)}%</p>
              <p className="text-xs text-slate-400">
                {dataHealth.populatedEntities} of {dataHealth.totalEntities} entities populated
              </p>
              <div className="mt-4 space-y-2 text-xs text-slate-500">
                <div className="flex items-center justify-between">
                  <span>Total records</span>
                  <span className="font-medium text-slate-700">{formatNumber(dataHealth.totalRecords ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last update</span>
                  <span>{formatTimestamp(dataHealth.lastUpdated)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setIsSummaryOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="rounded-lg bg-indigo-50 p-2">
                    <Sparkles className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600">AI Health Brief</p>
                    <p className="text-xs text-slate-400">Automated insights distilled from the latest metrics.</p>
                  </div>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-slate-400 transition-transform ${isSummaryOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isSummaryOpen ? (
                <div className="border-t border-slate-100 px-5 py-5">
                  {data.aiSummary ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{data.aiSummary}</p>
                  ) : (
                    <div className="space-y-3 text-sm text-slate-400">
                      <p>Summary not available yet. Refresh the dashboard to request a new analysis.</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            {data.sourcingActivity ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-600">Sourcing Pipeline</h3>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-slate-600">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">RFQs Open</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{formatNumber(data.sourcingActivity.rfqOpen ?? 0)}</p>
                    <p className="text-xs text-slate-400">Total RFQs: {formatNumber(data.sourcingActivity.rfqTotal ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">RFPs Open</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{formatNumber(data.sourcingActivity.rfpOpen ?? 0)}</p>
                    <p className="text-xs text-slate-400">Total RFPs: {formatNumber(data.sourcingActivity.rfpTotal ?? 0)}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-600">Data freshness</h3>
              <p className="mt-2 text-sm text-slate-500">
                This overview pulls metrics from <span className="font-medium text-slate-700">business_metrics</span> and{' '}
                <span className="font-medium text-slate-700">orders</span>, plus RFQ/RFP sync tables in your Supabase workspace.
                Refresh after new transactions to keep insights current.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default ERPOverview;
