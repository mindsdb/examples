'use client';

import {
  ClauseData,
  RiskDistribution,
  ComparisonRow,
  ExpiryItem,
  EvaluationMetrics
} from '@/lib/types';
import { cn, getBgColorForRisk, getColorForRisk, getColorForCategory, formatDate, getDaysUntil } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { useState } from 'react';

interface RiskGaugeProps {
  score: number;
  level: 'low' | 'medium' | 'high';
  breakdown: RiskDistribution[];
}

export function RiskGauge({ score, level, breakdown }: RiskGaugeProps) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const colorMap = {
    low: 'text-green-600 dark:text-green-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    high: 'text-red-600 dark:text-red-400',
  };

  const strokeColorMap = {
    low: '#16a34a',
    medium: '#ca8a04',
    high: '#dc2626',
  };

  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 p-6 ring-1 ring-slate-200 dark:ring-slate-700">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
        Risk Assessment
      </h3>

      <div className="flex items-center gap-6">
        {/* Circular Gauge */}
        <div className="relative h-32 w-32">
          <svg className="h-32 w-32 -rotate-90 transform">
            <circle
              cx="64"
              cy="64"
              r="45"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-slate-200 dark:text-slate-700"
            />
            <circle
              cx="64"
              cy="64"
              r="45"
              stroke={strokeColorMap[level]}
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={cn('text-3xl font-bold', colorMap[level])}>
              {score}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">
              {level} risk
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {breakdown.map((item) => (
            <div key={item.category} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded"
                  style={{ backgroundColor: getColorForCategory(item.category) }}
                />
                <span className="text-slate-700 dark:text-slate-300 capitalize">
                  {item.category.replace('-', ' ')}
                </span>
              </div>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {item.count} ({item.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface RiskBarProps {
  distribution: RiskDistribution[];
}

export function RiskBar({ distribution }: RiskBarProps) {

  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 p-6 ring-1 ring-slate-200 dark:ring-slate-700">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
        Risk Distribution by Category
      </h3>

      <div className="space-y-4">
        {/* Stacked Bar */}
        <div className="flex h-8 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          {distribution.map((item) => (
            <div
              key={item.category}
              className="group relative flex items-center justify-center text-xs font-medium text-white transition-all hover:opacity-90"
              style={{
                width: `${item.percentage}%`,
                backgroundColor: getColorForCategory(item.category),
              }}
              title={`${item.category}: ${item.count} (${item.percentage}%)`}
            >
              {item.percentage > 10 && (
                <span className="truncate px-1">{item.count}</span>
              )}
            </div>
          ))}
        </div>

        {/* List */}
        <div className="grid grid-cols-2 gap-3">
          {distribution.map((item) => (
            <div key={item.category} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded"
                style={{ backgroundColor: getColorForCategory(item.category) }}
              />
              <span className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                {item.category.replace('-', ' ')}
              </span>
              <span className="ml-auto text-xs font-medium text-slate-900 dark:text-slate-100">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ClauseCardProps {
  clause: ClauseData;
  onExplain?: () => void;
  onCompare?: () => void;
  onDraftFix?: () => void;
}

export function ClauseCard({ clause, onExplain, onCompare, onDraftFix }: ClauseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 p-4 ring-1 ring-slate-200 dark:ring-slate-700">
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex flex-1 items-start gap-3 text-left"
        >
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
          )}
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                {clause.title}
              </h4>
              <span className={cn(
                'rounded px-2 py-0.5 text-xs font-medium uppercase',
                getBgColorForRisk(clause.severity),
                getColorForRisk(clause.severity)
              )}>
                {clause.severity}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{clause.section}</span>
              <span>•</span>
              <span className="capitalize">{clause.category.replace('-', ' ')}</span>
              {clause.confidence && (
                <>
                  <span>•</span>
                  <span>{Math.round(clause.confidence * 100)}% confident</span>
                </>
              )}
            </div>
          </div>
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4 border-t border-slate-200 dark:border-slate-700 pt-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {clause.content}
          </p>

          {clause.sources.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {clause.sources.map((source) => (
                <span
                  key={source.id}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs"
                >
                  <span>📊</span>
                  <span className="text-slate-700 dark:text-slate-300">{source.name}</span>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onExplain}
              className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
            >
              Explain
            </button>
            <button
              onClick={onCompare}
              className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Compare
            </button>
            <button
              onClick={onDraftFix}
              className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Draft fix
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ComparisonTableProps {
  rows: ComparisonRow[];
}

export function ComparisonTable({ rows }: ComparisonTableProps) {
  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 p-6 ring-1 ring-slate-200 dark:ring-slate-700 overflow-x-auto">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
        Clause Comparison
      </h3>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="pb-3 pr-4 text-left font-medium text-slate-700 dark:text-slate-300">
              Clause Type
            </th>
            <th className="pb-3 px-4 text-left font-medium text-slate-700 dark:text-slate-300">
              Contract 1
            </th>
            <th className="pb-3 px-4 text-left font-medium text-slate-700 dark:text-slate-300">
              Contract 2
            </th>
            <th className="pb-3 pl-4 text-left font-medium text-slate-700 dark:text-slate-300">
              Contract 3
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              className="border-b border-slate-100 dark:border-slate-800 last:border-0"
            >
              <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                {row.clauseType}
              </td>
              <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                {row.contract1}
              </td>
              <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                {row.contract2}
              </td>
              <td className="py-3 pl-4 text-slate-600 dark:text-slate-400">
                {row.contract3 || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows[0]?.differences && (
        <div className="mt-4 space-y-2">
          <h4 className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Key Differences
          </h4>
          <ul className="space-y-1 pl-6">
            {rows.flatMap(r => r.differences).map((diff, idx) => (
              <li key={idx} className="list-disc text-xs text-slate-600 dark:text-slate-400">
                {diff}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface ExpiryTimelineProps {
  items: ExpiryItem[];
}

export function ExpiryTimeline({ items }: ExpiryTimelineProps) {
  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 p-6 ring-1 ring-slate-200 dark:ring-slate-700">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
        Contract Expiration Timeline
      </h3>

      <div className="space-y-3">
        {items.map((item) => {
          const daysLeft = getDaysUntil(item.expiryDate);
          const isUrgent = daysLeft < 30;
          const isWarning = daysLeft >= 30 && daysLeft < 90;

          return (
            <div
              key={item.contractId}
              className={cn(
                'flex items-center gap-4 rounded-lg p-3 ring-1',
                isUrgent && 'bg-red-50 dark:bg-red-900/10 ring-red-200 dark:ring-red-800',
                isWarning && 'bg-yellow-50 dark:bg-yellow-900/10 ring-yellow-200 dark:ring-yellow-800',
                !isUrgent && !isWarning && 'bg-slate-50 dark:bg-slate-800/50 ring-slate-200 dark:ring-slate-700'
              )}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    {item.contractName}
                  </h4>
                  {item.autoRenew && (
                    <span className="rounded bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs text-green-700 dark:text-green-400">
                      Auto-renew
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                  <span>{item.party}</span>
                  {item.value && (
                    <>
                      <span>•</span>
                      <span className="font-medium">{item.value}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>Expires {formatDate(item.expiryDate)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className={cn(
                  'text-2xl font-bold',
                  isUrgent && 'text-red-600 dark:text-red-400',
                  isWarning && 'text-yellow-600 dark:text-yellow-400',
                  !isUrgent && !isWarning && 'text-slate-600 dark:text-slate-400'
                )}>
                  {daysLeft}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  days left
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface EvaluationCardProps {
  metrics: EvaluationMetrics;
}

export function EvaluationCard({ metrics }: EvaluationCardProps) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 ring-1 ring-blue-200 dark:ring-blue-800">
      <div className="flex items-center gap-2 mb-4">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Result Quality Metrics
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {(metrics.mrr * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            MRR Score
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {(metrics.hitAt5 * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Hit@5
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {(metrics.relevancy * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Relevancy
          </div>
        </div>
      </div>

      {metrics.explanation && (
        <p className="mt-4 text-xs text-slate-600 dark:text-slate-400 border-t border-blue-200 dark:border-blue-800 pt-3">
          {metrics.explanation}
        </p>
      )}
    </div>
  );
}
