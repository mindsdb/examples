'use client';

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { cn } from '@/lib/utils';

interface ChartProps {
  type: string;
  data: string | any[];
  title?: string;
  width?: number;
  height?: number;
  className?: string;
}

// Parse data if it's a JSON string
const parseData = (data: string | any[]) => {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  return data;
};

export function Chart({ type, data, title, className }: ChartProps) {
  const chartData = parseData(data);

  const containerClass = cn(
    'my-4 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm',
    className
  );

  const colors = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  switch (type) {
    case 'pie':
      return (
        <div className={containerClass}>
          {title && <h3 className="text-lg font-semibold mb-3 text-slate-900 dark:text-slate-100">{title}</h3>}
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((_entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );

    case 'bar':
      return (
        <div className={containerClass}>
          {title && <h3 className="text-lg font-semibold mb-3 text-slate-900 dark:text-slate-100">{title}</h3>}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case 'line':
      return (
        <div className={containerClass}>
          {title && <h3 className="text-lg font-semibold mb-3 text-slate-900 dark:text-slate-100">{title}</h3>}
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );

    default:
      return (
        <div className={cn(containerClass, 'text-red-600 dark:text-red-400')}>
          <p>Unknown chart type: {type}</p>
        </div>
      );
  }
}

interface RiskGaugeProps {
  score: number;
  level: 'low' | 'medium' | 'high';
  title?: string;
}

export function RiskGauge({ score, level, title = 'Risk Assessment' }: RiskGaugeProps) {
  const getColor = () => {
    switch (level) {
      case 'low': return '#10B981';
      case 'medium': return '#F59E0B';
      case 'high': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const data = [
    { name: 'Risk Score', value: score, fill: getColor() },
    { name: 'Remaining', value: 100 - score, fill: '#E5E7EB' }
  ];

  return (
    <div className="my-4 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
      <h3 className="text-lg font-semibold mb-3 text-slate-900 dark:text-slate-100">{title}</h3>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              startAngle={90}
              endAngle={-270}
              innerRadius={30}
              outerRadius={50}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div>
          <div className="text-2xl font-bold" style={{ color: getColor() }}>
            {score}%
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400 capitalize">
            {level} Risk
          </div>
        </div>
      </div>
    </div>
  );
}

interface TimelineProps {
  data: string | any[];
  title?: string;
}

export function Timeline({ data, title = 'Timeline' }: TimelineProps) {
  const timelineData = parseData(data);

  // Transform data for timeline chart visualization
  const chartData = timelineData.map((item: any, index: number) => {
    // Parse date string to create a sortable date value
    const dateStr = item.date || item.time || `2025-${String(index + 1).padStart(2, '0')}-01`;
    const date = new Date(dateStr);

    return {
      date: dateStr,
      dateValue: date.getTime(), // For sorting and X-axis
      value: index + 1, // Y-axis position
      title: item.title || item.name || `Event ${index + 1}`,
      description: item.description || '',
      displayDate: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    };
  }).sort((a: any, b: any) => a.dateValue - b.dateValue); // Sort by date

  // Create a clean timeline visualization
  return (
    <div className="my-4 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
      {title && <h3 className="text-lg font-semibold mb-3 text-slate-900 dark:text-slate-100">{title}</h3>}

      {/* Chart visualization */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="displayDate"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
          />
          <YAxis hide />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload[0]) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{data.title}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{data.displayDate}</p>
                    {data.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{data.description}</p>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3B82F6"
            strokeWidth={3}
            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 6 }}
            activeDot={{ r: 8, fill: '#1D4ED8' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: string;
}

export function MetricCard({ title, value, change, trend, icon }: MetricCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600 dark:text-green-400';
      case 'down': return 'text-red-600 dark:text-red-400';
      default: return 'text-slate-600 dark:text-slate-400';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      default: return '➡️';
    }
  };

  return (
    <div className="my-4 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-600 dark:text-slate-400">{title}</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
          {change && (
            <div className={cn('text-sm flex items-center gap-1', getTrendColor())}>
              <span>{getTrendIcon()}</span>
              <span>{change}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="text-2xl">{icon}</div>
        )}
      </div>
    </div>
  );
}