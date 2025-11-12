"""
Utility functions for generating markdown with embedded interactive components.
These functions help the AI backend create properly formatted markdown responses
that will render interactive charts, gauges, timelines, and metrics in the frontend.
"""

import json
from typing import List, Dict, Any, Union
from dataclasses import dataclass


@dataclass
class ChartData:
    chart_type: str  # 'pie', 'bar', 'line'
    data: List[Dict[str, Any]]
    title: str = None
    width: int = 400
    height: int = 300


@dataclass
class RiskGaugeData:
    score: int  # 0-100
    level: str  # 'low', 'medium', 'high'
    title: str = "Risk Assessment"


@dataclass
class TimelineData:
    # Each item should have 'title', 'date', 'description'
    data: List[Dict[str, str]]
    title: str = "Timeline"


@dataclass
class MetricCardData:
    title: str
    value: Union[str, int, float]
    change: str = None
    trend: str = None  # 'up', 'down', 'neutral'
    icon: str = None


class MarkdownComponentGenerator:
    """Helper class to generate markdown with embedded interactive components."""

    @staticmethod
    def chart(data: ChartData, use_code_block: bool = True) -> str:
        """Generate a chart component in markdown."""
        chart_config = {
            "type": data.chart_type,
            "data": data.data
        }
        if data.title:
            chart_config["title"] = data.title
        if data.width != 400:
            chart_config["width"] = data.width
        if data.height != 300:
            chart_config["height"] = data.height

        if use_code_block:
            return f"```chart\n{json.dumps(chart_config, indent=2)}\n```"
        else:
            data_json = json.dumps(data.data).replace('"', "'")
            title_attr = f' title="{data.title}"' if data.title else ''
            return f'<chart type="{data.chart_type}" data=\'{data_json}\'{title_attr} />'

    @staticmethod
    def risk_gauge(data: RiskGaugeData, use_code_block: bool = True) -> str:
        """Generate a risk gauge component in markdown."""
        gauge_config = {
            "score": data.score,
            "level": data.level,
            "title": data.title
        }

        if use_code_block:
            return f"```riskgauge\n{json.dumps(gauge_config, indent=2)}\n```"
        else:
            return f'<riskgauge score="{data.score}" level="{data.level}" title="{data.title}" />'

    @staticmethod
    def timeline(data: TimelineData, use_code_block: bool = True) -> str:
        """Generate a timeline component in markdown."""
        timeline_config = {
            "title": data.title,
            "data": data.data
        }

        if use_code_block:
            return f"```timeline\n{json.dumps(timeline_config, indent=2)}\n```"
        else:
            data_json = json.dumps(data.data).replace('"', "'")
            return f'<timeline title="{data.title}" data=\'{data_json}\' />'

    @staticmethod
    def metric_card(data: MetricCardData, use_code_block: bool = True) -> str:
        """Generate a metric card component in markdown."""
        metric_config = {
            "title": data.title,
            "value": data.value
        }
        if data.change:
            metric_config["change"] = data.change
        if data.trend:
            metric_config["trend"] = data.trend
        if data.icon:
            metric_config["icon"] = data.icon

        if use_code_block:
            return f"```metric\n{json.dumps(metric_config, indent=2)}\n```"
        else:
            attrs = [f'title="{data.title}"', f'value="{data.value}"']
            if data.change:
                attrs.append(f'change="{data.change}"')
            if data.trend:
                attrs.append(f'trend="{data.trend}"')
            if data.icon:
                attrs.append(f'icon="{data.icon}"')
            return f'<metriccard {" ".join(attrs)} />'
