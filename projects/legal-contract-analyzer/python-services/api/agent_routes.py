"""
AI Agent API Routes
Simplified endpoints for chat interface with automatic KB/Agent updates
Enhanced with interactive markdown components
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import logging
from mindsdb_manager import MindsDBManager
from markdown_components import (
    MarkdownComponentGenerator,
    MetricCardData,
    ChartData,
    RiskGaugeData,
    TimelineData
)
import re
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["AI Agent"])


# Request/Response Models
class ConversationMessage(BaseModel):
    """A single message in the conversation"""
    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")
    timestamp: Optional[str] = Field(None, description="Message timestamp")


class ChatRequest(BaseModel):
    """Request for chatting with the AI agent"""
    message: str = Field(..., description="User message/question")
    conversation_id: Optional[str] = Field(
        None, description="Conversation ID for context")
    conversation_history: Optional[list[ConversationMessage]] = Field(
        None, description="Previous messages in the conversation for context")
    stream: bool = Field(False, description="Enable streaming response")


# Store the manager instance (will be set by main.py)
mindsdb_manager: MindsDBManager = None


def set_manager(manager):
    """Set the MindsDB manager instance"""
    global mindsdb_manager
    mindsdb_manager = manager


def add_emoji_formatting(response: str, user_query_lower: str) -> str:
    """Add emoji formatting to responses that lack visual appeal"""
    lines = response.split('\n')
    enhanced_lines = []

    for line in lines:
        line = line.strip()
        if not line:
            enhanced_lines.append(line)
            continue

        # Add emojis to common contract terms
        if any(keyword in line.lower() for keyword in ['contract type', 'agreement type']):
            if not any(emoji in line for emoji in ['📄', '📋', '📝']):
                line = f"📄 {line}"
        elif any(keyword in line.lower() for keyword in ['parties involved', 'parties:', 'contracting parties']):
            if not any(emoji in line for emoji in ['🤝', '👥']):
                line = f"🤝 {line}"
        elif any(keyword in line.lower() for keyword in ['effective date', 'date:', 'signed on']):
            if not any(emoji in line for emoji in ['📅', '📆']):
                line = f"📅 {line}"
        elif any(keyword in line.lower() for keyword in ['payment', 'invoice', 'billing']):
            if not any(emoji in line for emoji in ['💰', '💵', '💳']):
                line = f"💰 {line}"
        elif any(keyword in line.lower() for keyword in ['penalty', 'fine', 'breach']):
            if not any(emoji in line for emoji in ['⚠️', '🚨']):
                line = f"⚠️ {line}"
        elif any(keyword in line.lower() for keyword in ['force majeure', 'act of god']):
            if not any(emoji in line for emoji in ['🌩️', '🌪️']):
                line = f"🌩️ {line}"
        elif any(keyword in line.lower() for keyword in ['termination', 'end', 'cancel']):
            if not any(emoji in line for emoji in ['🔚', '❌']):
                line = f"🔚 {line}"

        enhanced_lines.append(line)

    return '\n'.join(enhanced_lines)


def enhance_comparison_response(response: str, user_query_lower: str) -> str:
    """Enhance comparison responses with better formatting and structure"""
    if '⚖️' in response:  # Already enhanced
        return response

    lines = response.split('\n')
    enhanced_lines = []

    # Add comparison header if missing
    if not any('comparison' in line.lower() or 'benchmark' in line.lower() for line in lines[:3]):
        enhanced_lines.append("⚖️ **Contract Comparison Analysis**\n")
        enhanced_lines.append("📊 **Industry Benchmarking Results**\n")

    for line in lines:
        line = line.strip()
        if not line:
            enhanced_lines.append(line)
            continue

        # Enhance comparison points
        if any(keyword in line.lower() for keyword in ['payment', 'invoice', 'billing']):
            if not line.startswith('💰'):
                line = f"💰 **Payment Terms Comparison:**\n{line}"
        elif any(keyword in line.lower() for keyword in ['liability', 'indemnif', 'damages']):
            if not line.startswith('⚠️'):
                line = f"⚠️ **Liability Clauses Comparison:**\n{line}"
        elif any(keyword in line.lower() for keyword in ['termination', 'end', 'cancel']):
            if not line.startswith('🔚'):
                line = f"🔚 **Termination Rights Comparison:**\n{line}"
        elif any(keyword in line.lower() for keyword in ['compliance', 'regulation', 'standard']):
            if not line.startswith('✅'):
                line = f"✅ **Compliance Standards Comparison:**\n{line}"

        enhanced_lines.append(line)

    # Add next steps if missing
    response_text = '\n'.join(enhanced_lines)
    if '💡' not in response_text:
        enhanced_lines.append(
            "\n💡 **Next Steps:** Would you like detailed recommendations for improvements or analysis of specific clauses?")

    return '\n'.join(enhanced_lines)


def extract_email_actions_from_response(text: str) -> Optional[list]:
    """Extract email actions from AI response that contains emailactions code blocks"""
    email_actions = []

    # Log the response for debugging
    logger.info(f"Checking for email actions in response: {text[:200]}...")

    # Look for emailactions code blocks with more flexible regex
    # Handle potential whitespace and newlines around the block
    email_action_blocks = re.findall(
        r'```emailactions\s*([\s\S]*?)\s*```', text, re.DOTALL | re.MULTILINE)

    logger.info(f"Found {len(email_action_blocks)} email action blocks")

    for i, block in enumerate(email_action_blocks):
        try:
            # Clean up the block - remove extra whitespace and newlines
            cleaned_block = block.strip()

            logger.info(
                f"Parsing email action block {i+1}: {cleaned_block[:200]}...")

            # Fix JSON formatting issues common in AI-generated content
            # 1. Escape unescaped newlines in string values
            # 2. Handle multiline strings properly

            # Find all string values that span multiple lines and escape them
            def fix_multiline_strings(match):
                content = match.group(1)
                # Escape newlines and other control characters
                content = content.replace('\n', '\\n').replace(
                    '\r', '\\r').replace('\t', '\\t')
                return f'"{content}"'

            # Fix multiline string values in JSON
            # This regex finds strings that contain unescaped newlines
            fixed_block = re.sub(r'"([^"]*(?:\n[^"]*)*)"', fix_multiline_strings,
                                 cleaned_block, flags=re.MULTILINE | re.DOTALL)

            # Parse the JSON content
            actions = json.loads(fixed_block)
            if isinstance(actions, list):
                email_actions.extend(actions)
                logger.info(
                    f"Successfully parsed {len(actions)} email actions from block {i+1}")
            else:
                logger.warning(
                    f"Email actions block {i+1} is not a list: {type(actions)}")
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(
                f"Failed to parse email actions from block {i+1}: {e}")
            logger.warning(f"Block content: {block[:500]}")

            # Try alternative parsing approach for malformed JSON
            try:
                # Attempt to fix common JSON issues and parse again
                alt_block = block.strip()
                # Replace literal newlines with escaped newlines in quoted strings
                alt_block = re.sub(
                    r'("body":\s*"[^"]*?)(\n)([^"]*?")', r'\1\\n\3', alt_block, flags=re.MULTILINE | re.DOTALL)
                alt_block = re.sub(
                    r'("subject":\s*"[^"]*?)(\n)([^"]*?")', r'\1\\n\3', alt_block, flags=re.MULTILINE | re.DOTALL)

                actions = json.loads(alt_block)
                if isinstance(actions, list):
                    email_actions.extend(actions)
                    logger.info(
                        f"Successfully parsed {len(actions)} email actions using alternative method for block {i+1}")
            except Exception as alt_e:
                logger.error(
                    f"Alternative parsing also failed for block {i+1}: {alt_e}")

    logger.info(f"Total email actions extracted: {len(email_actions)}")
    return email_actions if email_actions else None


def clean_email_actions_from_response(text: str) -> str:
    """Remove email action blocks from AI response text to keep chat clean"""
    # Remove emailactions code blocks
    cleaned_text = re.sub(
        r'```emailactions\s*[\s\S]*?\s*```', '', text, flags=re.DOTALL | re.MULTILINE)

    # Clean up any extra whitespace left behind
    # Remove multiple empty lines
    cleaned_text = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_text)
    cleaned_text = cleaned_text.strip()

    return cleaned_text


def enhance_response_with_components(agent_response: str, user_message: str) -> str:
    """
    Analyze the agent response and user message to add appropriate interactive components
    and ensure proper formatting with emojis
    """
    response = agent_response.strip()
    user_msg_lower = user_message.lower()
    response_lower = response.lower()

    generator = MarkdownComponentGenerator()

    try:
        # Add emojis and formatting if response lacks visual appeal
        if not any(emoji in response for emoji in ['📄', '🤝', '📅', '💰', '⚠️', '🌩️', '🔚', '📊', '📋', '⏱️', '✅', '⚖️']):
            response = add_emoji_formatting(response, user_msg_lower)

        # Handle comparison queries specifically
        if any(keyword in user_msg_lower for keyword in ['compare', 'comparison', 'industry standard', 'benchmark', 'vs']):
            response = enhance_comparison_response(response, user_msg_lower)

        # Risk analysis patterns
        if any(keyword in user_msg_lower for keyword in ['risk', 'analyze risk', 'assessment', 'risky']):
            if any(keyword in response_lower for keyword in ['risk', 'high', 'medium', 'low', 'liability', 'compliance']):
                # Extract risk information from response text
                risk_score = extract_risk_score(response)
                risk_level = extract_risk_level(response)

                if risk_score is not None and risk_level:
                    # Add risk gauge
                    risk_gauge = generator.risk_gauge(
                        RiskGaugeData(
                            score=risk_score,
                            level=risk_level,
                            title="Contract Risk Assessment"
                        )
                    )
                    response = f"{response}\n\n## Risk Assessment\n\n{risk_gauge}"

                # Look for risk categories/distributions
                risk_categories = extract_risk_categories(response)
                if risk_categories:
                    risk_chart = generator.chart(
                        ChartData(
                            chart_type="pie",
                            data=risk_categories,
                            title="Risk Distribution by Category"
                        )
                    )
                    response = f"{response}\n\n## Risk Breakdown\n\n{risk_chart}"

        # Contract timeline/expiry patterns
        elif any(keyword in user_msg_lower for keyword in ['expir', 'renewal', 'timeline', 'upcoming', 'deadline']):
            timeline_events = extract_timeline_events(response)
            if timeline_events:
                timeline = generator.timeline(
                    TimelineData(
                        data=timeline_events,
                        title="Contract Timeline"
                    )
                )
                response = f"{response}\n\n## Timeline\n\n{timeline}"

        # Contract metrics/statistics patterns
        elif any(keyword in user_msg_lower for keyword in ['how many', 'count', 'total', 'statistics', 'metrics']):
            metrics = extract_metrics_from_response(response)
            if metrics:
                metrics_section = "\n\n".join([
                    generator.metric_card(metric) for metric in metrics
                ])
                response = f"{response}\n\n## Key Metrics\n\n{metrics_section}"

        # Contract comparison patterns
        elif any(keyword in user_msg_lower for keyword in ['compare', 'comparison', 'versus', 'vs', 'difference']):
            comparison_data = extract_comparison_data(response)
            if comparison_data:
                comparison_chart = generator.chart(
                    ChartData(
                        chart_type="bar",
                        data=comparison_data,
                        title="Contract Comparison"
                    )
                )
                response = f"{response}\n\n## Comparison Chart\n\n{comparison_chart}"

    except Exception as e:
        logger.warning(f"Failed to enhance response with components: {e}")

    return response


def extract_risk_score(text: str) -> Optional[int]:
    """Extract risk score from response text using structured format or patterns"""
    # First try structured format
    risk_score_match = re.search(r'\*\*RISK_SCORE:\*\*\s*(\d+)', text)
    if risk_score_match:
        return int(risk_score_match.group(1))

    # Fallback to original patterns
    patterns = [
        r'risk score[s]?\s*(?:of|is|:)?\s*(\d+)',
        r'(\d+)%?\s*risk',
        r'score[d]?\s*(?:of|is|:)?\s*(\d+)',
        r'(\d+)\s*(?:out of|/)\s*(?:10|100)'
    ]

    for pattern in patterns:
        match = re.search(pattern, text.lower())
        if match:
            score = int(match.group(1))
            # Normalize to 0-100 scale
            if score <= 10:
                score *= 10
            return min(max(score, 0), 100)
    return None


def extract_risk_level(text: str) -> Optional[str]:
    """Extract risk level from response text using structured format or patterns"""
    # First try structured format
    risk_level_match = re.search(r'\*\*RISK_LEVEL:\*\*\s*(\w+)', text)
    if risk_level_match:
        level = risk_level_match.group(1).lower()
        if level in ['low', 'medium', 'high']:
            return level

    # Fallback to original patterns
    text_lower = text.lower()
    if 'high risk' in text_lower or 'high-risk' in text_lower:
        return 'high'
    elif 'medium risk' in text_lower or 'moderate risk' in text_lower:
        return 'medium'
    elif 'low risk' in text_lower or 'minimal risk' in text_lower:
        return 'low'
    return None


def extract_risk_categories(text: str) -> Optional[list]:
    """Extract risk categories from structured format or text analysis"""
    # First try structured format
    categories = []

    # Look for RISK_CATEGORIES section
    risk_categories_match = re.search(
        r'\*\*RISK_CATEGORIES:\*\*\s*(.*?)(?=\*\*|$)', text, re.DOTALL)
    if risk_categories_match:
        categories_text = risk_categories_match.group(1)

        # Parse each category line
        category_lines = re.findall(r'-\s*([^:]+):\s*(\d+)%', categories_text)
        for category_name, percentage in category_lines:
            categories.append({
                "name": category_name.strip(),
                "value": int(percentage)
            })

    # If no structured format found, fall back to keyword analysis
    if not categories:
        text_lower = text.lower()
        risk_keywords = {
            'Liability': ['liability', 'liable', 'indemnification'],
            'Data Privacy': ['data privacy', 'gdpr', 'privacy', 'personal data'],
            'Termination': ['termination', 'terminate', 'end contract'],
            'IP Rights': ['intellectual property', 'ip rights', 'copyright', 'patent'],
            'Compliance': ['compliance', 'regulatory', 'legal requirement'],
            'Financial': ['financial', 'payment', 'monetary', 'cost']
        }

        for category, keywords in risk_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                # Rough scoring based on keyword frequency and context
                score = sum(text_lower.count(keyword)
                            for keyword in keywords) * 10
                if score > 0:
                    categories.append(
                        {"name": category, "value": min(score, 50)})

        # Normalize to 100%
        if categories:
            total = sum(cat["value"] for cat in categories)
            if total > 0:
                for cat in categories:
                    cat["value"] = round((cat["value"] / total) * 100)

    return categories[:6] if categories else None  # Limit to top 6


def extract_timeline_events(text: str) -> Optional[list]:
    """Extract timeline events from structured format or text analysis"""
    events = []

    # First try structured format
    timeline_match = re.search(
        r'\*\*TIMELINE_EVENTS:\*\*\s*(.*?)(?=\*\*|$)', text, re.DOTALL)
    if timeline_match:
        timeline_text = timeline_match.group(1)

        # Parse each event line: - [Contract Name]: [YYYY-MM-DD] - [Description]
        event_lines = re.findall(
            r'-\s*([^:]+):\s*(\d{4}-\d{2}-\d{2})\s*-\s*(.+)', timeline_text)
        for contract_name, date_str, description in event_lines:
            events.append({
                "title": contract_name.strip(),
                "date": date_str.strip(),
                "description": description.strip()
            })

    # Fallback to original date pattern matching
    if not events:
        date_patterns = [
            r'(\d{4}-\d{2}-\d{2})',  # YYYY-MM-DD
            r'(\w+ \d{1,2}, \d{4})',  # Month DD, YYYY
            r'(\d{1,2}/\d{1,2}/\d{4})',  # MM/DD/YYYY
        ]

        lines = text.split('\n')
        for line in lines:
            for pattern in date_patterns:
                match = re.search(pattern, line)
                if match:
                    date_str = match.group(1)
                    # Extract event description (text before or after date)
                    event_text = line.replace(date_str, '').strip()
                    if event_text and len(event_text) > 10:
                        events.append({
                            "title": event_text[:50] + "..." if len(event_text) > 50 else event_text,
                            "date": date_str,
                            "description": event_text
                        })

    return events[:5] if events else None  # Limit to 5 events


def extract_metrics_from_response(text: str) -> Optional[list]:
    """Extract metrics from structured format or text analysis"""
    metrics = []

    # First try structured format
    metrics_match = re.search(
        r'\*\*METRICS:\*\*\s*(.*?)(?=\*\*|$)', text, re.DOTALL)
    if metrics_match:
        metrics_text = metrics_match.group(1)

        # Parse each metric line: - [Metric Name]: [value]
        metric_lines = re.findall(r'-\s*([^:]+):\s*(.+)', metrics_text)
        for metric_name, value in metric_lines:
            # Determine icon based on metric name
            name_lower = metric_name.lower()
            if 'contract' in name_lower:
                icon = '📄'
            elif 'risk' in name_lower:
                icon = '⚠️'
            elif 'time' in name_lower or 'day' in name_lower:
                icon = '⏱️'
            elif 'expir' in name_lower:
                icon = '📅'
            elif 'complian' in name_lower:
                icon = '✅'
            elif 'value' in name_lower or '$' in value:
                icon = '💰'
            else:
                icon = '📊'

            metrics.append(MetricCardData(
                title=metric_name.strip(),
                value=value.strip(),
                icon=icon
            ))

    # Fallback to original pattern matching
    if not metrics:
        metric_patterns = [
            (r'(\d+)\s*contracts?', 'Total Contracts', '📄'),
            (r'(\d+)\s*agreements?', 'Agreements', '📋'),
            (r'(\d+)\s*risks?', 'Risk Items', '⚠️'),
            (r'(\d+)\s*(?:days?|weeks?)', 'Processing Time', '⏱️'),
            (r'\$(\d+(?:,\d{3})*)', 'Contract Value', '💰'),
            (r'(\d+)%', 'Percentage', '📊')
        ]

        for pattern, title, icon in metric_patterns:
            matches = re.findall(pattern, text.lower())
            if matches:
                value = matches[0]
                if pattern.startswith(r'\$'):
                    value = f"${value}"
                elif pattern.endswith(r'%'):
                    value = f"{value}%"

                metrics.append(MetricCardData(
                    title=title,
                    value=value,
                    icon=icon
                ))

    return metrics[:4] if metrics else None  # Limit to 4 metrics


def extract_chart_data(text: str) -> Optional[List[Dict]]:
    """Extract chart data from response text using structured format or patterns"""
    chart_data = []

    # First try structured format - look for CHART_DATA section
    chart_section_match = re.search(
        r'\*\*CHART_DATA:\*\*\s*(.*?)(?=\*\*|$)', text, re.DOTALL)
    if chart_section_match:
        chart_section = chart_section_match.group(1)
        # Parse table format: Type | Count | Value
        lines = chart_section.strip().split('\n')
        for line in lines:
            if '|' in line and not line.strip().startswith('-'):
                parts = [part.strip() for part in line.split('|')]
                if len(parts) >= 3:
                    try:
                        name = parts[0]
                        count = int(
                            re.search(r'\d+', parts[1]).group()) if re.search(r'\d+', parts[1]) else 0
                        value = int(
                            re.search(r'\d+', parts[2]).group()) if re.search(r'\d+', parts[2]) else 0
                        chart_data.append(
                            {"name": name, "count": count, "value": value})
                    except:
                        pass

    # If no structured data found, try pattern matching
    if not chart_data:
        lines = text.split('\n')
        for line in lines:
            # Look for "Type: Count contracts, $Value" patterns
            match = re.search(r'([^:]+):\s*(\d+)[^$]*\$?(\d+)', line)
            if match:
                name = match.group(1).strip()
                count = int(match.group(2))
                value = int(match.group(3))
                chart_data.append(
                    {"name": name, "count": count, "value": value})

    return chart_data if chart_data else None


def extract_comparison_data(text: str) -> Optional[list]:
    """Extract comparison data from structured format or text analysis"""
    comparison_items = []

    # First try structured format
    comparison_match = re.search(
        r'\*\*COMPARISON_DATA:\*\*\s*(.*?)(?=\*\*|$)', text, re.DOTALL)
    if comparison_match:
        comparison_text = comparison_match.group(1)

        # Parse each comparison line: - [Item]: [value]
        comparison_lines = re.findall(r'-\s*([^:]+):\s*(\d+)', comparison_text)
        for item_name, value in comparison_lines:
            comparison_items.append({
                "name": item_name.strip()[:20],  # Limit name length
                "value": int(value)
            })

    # Fallback to original pattern matching
    if not comparison_items:
        lines = text.split('\n')
        for line in lines:
            # Look for "A vs B" or "A: X, B: Y" patterns
            if 'vs' in line.lower() or ':' in line:
                parts = re.split(r'[vs:|,]', line)
                if len(parts) >= 2:
                    name = parts[0].strip()
                    try:
                        value = int(re.search(r'(\d+)', parts[1]).group(1))
                        comparison_items.append(
                            {"name": name[:20], "value": value})
                    except:
                        pass

    return comparison_items[:5] if comparison_items else None


@router.post("/chat")
async def chat_with_agent(request: ChatRequest):
    """
    Chat with the AI agent - main endpoint for conversational interface
    Agent has access to knowledge base and all connected data sources
    Maintains conversation context and supports streaming with thoughts
    """
    try:
        if not mindsdb_manager:
            raise HTTPException(
                status_code=500, detail="MindsDB manager not initialized")

        # Ensure agent is initialized and updated with latest data sources
        if not mindsdb_manager.agent:
            await mindsdb_manager.create_agent()

        logger.info(f"Chat request: {request.message[:100]}...")

        # Format conversation history for context
        conversation_context = []
        if request.conversation_history:
            # Keep last 10 messages for context
            for msg in request.conversation_history[-10:]:
                conversation_context.append({
                    'question' if msg.role == 'user' else 'answer': msg.content,
                    'answer' if msg.role == 'user' else 'question': None
                })

        # Add current message with intelligent query enhancement
        enhanced_message = request.message

        # Detect and enhance queries for better structured responses
        message_lower = request.message.lower()

        if any(keyword in message_lower for keyword in ['risk', 'analyze risk', 'assessment', 'liability', 'compliance']):
            enhanced_message = f"""Analyze the risks in the contracts. {request.message}

IMPORTANT: Please include structured data in your response using this format:

**RISK_SCORE:** [provide a numerical score from 0-100]
**RISK_LEVEL:** [low|medium|high]
**RISK_CATEGORIES:**
- Liability: [percentage]%
- Data Privacy: [percentage]%
- Termination: [percentage]%
- IP Rights: [percentage]%
- Compliance: [percentage]%
- Financial: [percentage]%

**METRICS:**
- Total Contracts: [number]
- High-Risk Items: [number]
- Compliance Rate: [percentage]%

Please also provide your natural language analysis along with these structured sections."""

        elif any(keyword in message_lower for keyword in ['renewal', 'expir', 'deadline', 'timeline', 'upcoming']):
            enhanced_message = f"""Provide timeline analysis for contracts. {request.message}

IMPORTANT: Please include structured data in your response using this format:

**TIMELINE_EVENTS:**
- [Contract Name]: [YYYY-MM-DD] - [Description]
- [Contract Name]: [YYYY-MM-DD] - [Description]
- [Contract Name]: [YYYY-MM-DD] - [Description]

**METRICS:**
- Contracts Expiring Soon: [number]
- Total Renewal Value: [amount]
- Average Notice Period: [days] days

Please also provide your natural language analysis along with these structured sections."""

        elif any(keyword in message_lower for keyword in ['metrics', 'portfolio', 'kpi', 'statistics', 'overview']):
            enhanced_message = f"""Provide key contract portfolio metrics and KPIs. {request.message}

IMPORTANT: Please include structured data in your response using this format:

**METRICS:**
- Total Value: [amount]
- Active Contracts: [number] 
- Success Rate: [percentage]
- Avg Duration: [months/years]

**COMPARISON_DATA:**
- [Category]: [value]
- [Category]: [value]
- [Category]: [value]

**CHART_DATA:**
- Contract Type | Count | Value
- [Type A] | [number] | [amount]
- [Type B] | [number] | [amount]

Please also provide your natural language analysis along with these structured sections."""

        conversation_context.append({
            'question': enhanced_message,
            'answer': None
        })

        response = await mindsdb_manager.query_agent(
            conversation_context=conversation_context,
            stream=request.stream
        )

        # Extract email actions from the AI response FIRST
        email_actions = extract_email_actions_from_response(response['answer'])

        # Clean email actions from the response text to keep chat clean
        cleaned_response = clean_email_actions_from_response(
            response['answer'])

        # Enhance the cleaned response with interactive components
        enhanced_response = enhance_response_with_components(
            cleaned_response,
            request.message
        )

        # Only use AI's intelligent ACTION_SUGGESTIONS - no automatic fallback generation
        # The AI agent has full control over when email actions are appropriate
        if not email_actions:
            logger.info(
                f"No ACTION_SUGGESTIONS found in AI response - agent determined no email actions needed")

        # Prepare response data
        response_data = {
            "success": True,
            "message": request.message,
            "response": enhanced_response,
            "conversation_id": request.conversation_id,
            "streaming": request.stream,
            "context_length": len(conversation_context),
            "enhanced": enhanced_response != cleaned_response
        }

        # Add structured data extraction for enhanced queries
        message_lower = request.message.lower()

        if any(keyword in message_lower for keyword in ['risk', 'analyze risk', 'assessment', 'liability', 'compliance']):
            # Extract risk data similar to /analyze-risks endpoint
            risk_score = extract_risk_score(cleaned_response) or 65
            risk_level = extract_risk_level(cleaned_response) or 'medium'
            risk_categories = extract_risk_categories(cleaned_response)

            response_data["analysis_type"] = "risk_analysis"
            response_data["risk_data"] = {
                "score": risk_score,
                "level": risk_level,
                "categories": risk_categories
            }

        elif any(keyword in message_lower for keyword in ['renewal', 'expir', 'deadline', 'timeline', 'upcoming']):
            # Extract timeline data similar to /contract-timeline endpoint
            timeline_events = extract_timeline_events(cleaned_response)

            response_data["analysis_type"] = "timeline_analysis"
            if timeline_events:
                response_data["timeline_data"] = timeline_events

        elif any(keyword in message_lower for keyword in ['metrics', 'portfolio', 'kpi', 'statistics', 'overview']):
            # Extract metrics data similar to /contract-metrics endpoint
            chart_data = extract_chart_data(cleaned_response)
            metrics = extract_metrics_from_response(cleaned_response)

            response_data["analysis_type"] = "metrics_analysis"
            if chart_data:
                response_data["chart_data"] = chart_data
            if metrics:
                response_data["metrics"] = metrics

        # Add email actions if found
        if email_actions:
            response_data["email_actions"] = email_actions

        return response_data

    except Exception as e:
        logger.error(f"Chat failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync-now")
async def manual_kb_sync():
    """
    Manually trigger immediate KB sync with all connected legal contract data sources
    This is the endpoint called by the "Sync Now" button in the frontend
    """
    try:
        if not mindsdb_manager:
            raise HTTPException(
                status_code=500, detail="MindsDB manager not initialized")

        if not mindsdb_manager.kb_manager:
            raise HTTPException(
                status_code=500, detail="KB manager not initialized")

        logger.info("Manual KB sync triggered from frontend")

        # Perform full sync of all legal contract data sources
        sync_result = await mindsdb_manager.kb_manager.sync_all_sources()

        return {
            "success": True,
            "message": "KB sync completed successfully",
            "sync_result": sync_result
        }

    except Exception as e:
        logger.error(f"Manual KB sync failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kb-status")
async def get_kb_status():
    """
    Get current status of the knowledge base and all tracked data sources
    """
    try:
        if not mindsdb_manager:
            raise HTTPException(
                status_code=500, detail="MindsDB manager not initialized")

        if not mindsdb_manager.kb_manager:
            raise HTTPException(
                status_code=500, detail="KB manager not initialized")

        status = mindsdb_manager.kb_manager.get_kb_status()

        return {
            "success": True,
            "kb_status": status
        }

    except Exception as e:
        logger.error(f"Failed to get KB status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
