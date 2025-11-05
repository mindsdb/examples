'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Chart, RiskGauge, Timeline, MetricCard } from './MarkdownCharts';

// Example markdown content with embedded components
const exampleContent = `# Contract Risk Analysis

Based on my analysis of your legal contracts, here's what I found:

## Overall Risk Assessment

<riskgauge score="68" level="medium" title="Portfolio Risk Score" />

Your contract portfolio shows **medium risk** with several areas requiring attention.

## Risk Distribution by Category

The following chart shows how risks are distributed across different categories:

\`\`\`chart
{
  "type": "pie", 
  "title": "Risk Categories",
  "data": [
    {"name": "Liability", "value": 35},
    {"name": "Data Privacy", "value": 28},
    {"name": "Termination", "value": 20},
    {"name": "IP Rights", "value": 17}
  ]
}
\`\`\`

## Contract Volume Trends

Here's how your contract additions have trended over the past 6 months:

\`\`\`chart
{
  "type": "line",
  "title": "Monthly Contract Additions", 
  "data": [
    {"name": "Jul", "value": 8},
    {"name": "Aug", "value": 12},
    {"name": "Sep", "value": 15},
    {"name": "Oct", "value": 11},
    {"name": "Nov", "value": 18},
    {"name": "Dec", "value": 22}
  ]
}
\`\`\`

## Key Metrics

<metriccard title="Active Contracts" value="127" change="+15 this month" trend="up" icon="📋" />

<metriccard title="High-Risk Items" value="23" change="+3 flagged" trend="up" icon="⚠️" />

<metriccard title="Avg Processing Time" value="4.2 days" change="-0.8 days" trend="down" icon="⏱️" />

## Upcoming Renewals

\`\`\`timeline
{
  "title": "Q1 2026 Renewal Schedule",
  "data": [
    {
      "title": "Vendor Service Agreement",
      "date": "Jan 15, 2026",
      "description": "Annual renewal - requires 30-day notice"
    },
    {
      "title": "Software Licensing (3 contracts)",
      "date": "Feb 28, 2026", 
      "description": "Multi-year agreements up for renegotiation"
    },
    {
      "title": "Professional Services",
      "date": "Mar 31, 2026",
      "description": "Scope expansion opportunity"
    }
  ]
}
\`\`\`

## Recommendations

1. **Priority:** Address the 23 high-risk contract items, particularly those in the liability category
2. **Timeline:** Begin renewal preparations for Q1 2026 contracts by December 2025  
3. **Process:** Consider implementing automated risk scoring for new contracts
4. **Compliance:** Schedule GDPR compliance reviews for data processing agreements

Would you like me to dive deeper into any specific risk category or provide detailed analysis of particular contracts?`;

export function InteractiveMarkdownDemo() {
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Interactive Markdown Components Demo
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          This demonstrates how AI responses can include interactive charts, gauges, timelines, and metrics embedded directly in markdown.
        </p>
      </div>

      <button
        onClick={() => setShowDemo(!showDemo)}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        {showDemo ? 'Hide Demo' : 'Show Interactive Demo'}
      </button>

      {showDemo && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                // Custom chart components  
                // Handle code blocks for charts
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const lang = match ? match[1] : '';

                  // Handle chart code blocks
                  if (lang === 'chart' || lang === 'riskgauge' || lang === 'timeline' || lang === 'metric') {
                    try {
                      const data = JSON.parse(children?.toString() || '{}');
                      switch (lang) {
                        case 'chart':
                          return <Chart {...data} />;
                        case 'riskgauge':
                          return <RiskGauge {...data} />;
                        case 'timeline':
                          return <Timeline {...data} />;
                        case 'metric':
                          return <MetricCard {...data} />;
                        default:
                          break;
                      }
                    } catch (e) {
                      console.warn('Failed to parse chart data:', e);
                    }
                  }

                  // Default code rendering
                  return (
                    <pre className="rounded-lg p-3 text-sm overflow-x-auto my-2 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  );
                },
              }}
            >
              {exampleContent}
            </ReactMarkdown>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          How to Use
        </h3>
        <p className="text-blue-800 dark:text-blue-200 text-sm">
          Your AI can now generate markdown responses that include interactive components using either HTML-like tags or code blocks.
          See the <code>INTERACTIVE_COMPONENTS_GUIDE.md</code> file for complete documentation and examples.
        </p>
      </div>
    </div>
  );
}