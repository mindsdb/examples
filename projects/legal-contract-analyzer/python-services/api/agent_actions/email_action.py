"""
Email Action Routes for Legal Contract Analyzer
Handles sending and scheduling emails through MindsDB email integration
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
import logging
from mindsdb_manager import MindsDBManager
import uuid

logger = logging.getLogger(__name__)

# Create router for email actions
router = APIRouter(prefix="/actions/email", tags=["email-actions"])

# Global MindsDB manager instance (will be set by main.py)
mindsdb_manager: Optional[MindsDBManager] = None


def set_manager(manager):
    """Set the MindsDB manager instance from main.py"""
    global mindsdb_manager
    mindsdb_manager = manager


class EmailSendRequest(BaseModel):
    """Request model for sending emails"""
    recipients: List[EmailStr]
    subject: str
    body: str


class EmailScheduleRequest(BaseModel):
    """Request model for scheduling emails"""
    recipients: List[EmailStr]
    subject: str
    body: str
    datetime: datetime


@router.post("/send")
async def send_email(request: EmailSendRequest):
    """
    Send email immediately to recipients

    Args:
        request: EmailSendRequest containing recipients, subject, and body

    Returns:
        Status of email sending operation
    """
    try:
        logger.info(f"Sending email to {len(request.recipients)} recipients")
        logger.info(f"Subject: {request.subject}")

        recipients_str = ", ".join(request.recipients)

        # Escape single quotes in email content to prevent SQL injection
        escaped_subject = request.subject.replace("'", "''")
        escaped_body = request.body.replace("'", "''")

        send_email_query = f"""
            INSERT INTO legal_contracts_ai_mailer.emails (to_field, subject, body)
            VALUES ('{recipients_str}', '{escaped_subject}', '{escaped_body}')
        """
        result = mindsdb_manager.server.query(send_email_query)
        result.fetch()

        return {
            "status": "success",
            "message": f"Email sent to {len(request.recipients)} recipients",
            "recipients": request.recipients,
            "subject": request.subject
        }

    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to send email: {str(e)}")


@router.post("/schedule")
async def schedule_email(request: EmailScheduleRequest):
    """
    Schedule email to be sent at specified datetime

    Args:
        request: EmailScheduleRequest containing recipients, subject, body, and datetime

    Returns:
        Status of email scheduling operation
    """
    try:
        logger.info(
            f"Scheduling email to {len(request.recipients)} recipients")
        logger.info(f"Subject: {request.subject}")
        logger.info(f"Scheduled for: {request.datetime}")

        recipients_str = ", ".join(request.recipients)

        # Generate a valid job name (replace hyphens with underscores)
        job_id = str(uuid.uuid4()).replace('-', '_')
        job_name = f"set_reminder_email_{job_id}"

        # Escape single quotes in email content to prevent SQL injection
        escaped_subject = request.subject.replace("'", "''")
        escaped_body = request.body.replace("'", "''")

        # Parse and format datetime for MindsDB compatibility
        # Convert from ISO format to MindsDB's expected format (YYYY-MM-DD HH:MM:SS)
        try:
            if isinstance(request.datetime, str):
                # Handle various ISO format variations
                datetime_str = request.datetime
                # Remove timezone info if present (MindsDB doesn't handle it well)
                if '+' in datetime_str:
                    datetime_str = datetime_str.split('+')[0]
                elif 'Z' in datetime_str:
                    datetime_str = datetime_str.replace('Z', '')

                # Parse the datetime string
                parsed_datetime = datetime.fromisoformat(datetime_str)
                formatted_datetime = parsed_datetime.strftime(
                    '%Y-%m-%d %H:%M:%S')
            else:
                # If it's already a datetime object
                formatted_datetime = request.datetime.strftime(
                    '%Y-%m-%d %H:%M:%S')

            logger.info(f"Original datetime: {request.datetime}")
            logger.info(
                f"Formatted datetime for MindsDB: {formatted_datetime}")
        except Exception as dt_error:
            logger.error(
                f"Failed to parse datetime {request.datetime}: {dt_error}")
            raise HTTPException(
                status_code=400, detail=f"Invalid datetime format: {request.datetime}")

        send_email_query = f"""
            CREATE JOB {job_name} (
                INSERT INTO legal_contracts_ai_mailer.emails(to_field, subject, body)
                VALUES ('{recipients_str}', '{escaped_subject}', '{escaped_body}')
            )
            START '{formatted_datetime}';
        """
        result = mindsdb_manager.server.query(send_email_query)
        result.fetch()

        return {
            "status": "success",
            "message": f"Email scheduled for {formatted_datetime} to {len(request.recipients)} recipients",
            "recipients": request.recipients,
            "subject": request.subject,
            "scheduled_datetime": formatted_datetime
        }

    except Exception as e:
        logger.error(f"Failed to schedule email: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to schedule email: {str(e)}")
