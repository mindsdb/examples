"""
File Upload Routes for PDF Documents
Handles PDF uploads and integrates them directly into MindsDB Knowledge Base
"""

from mindsdb_manager import MindsDBManager
import os
import sys
import logging
import aiohttp
from typing import Dict, Any, List, Optional
from datetime import datetime
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException, status, UploadFile, File
from pydantic import BaseModel

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/upload", tags=["upload"])

# Global MindsDB manager instance (will be set by main.py)
mindsdb_manager: Optional[MindsDBManager] = None

# Upload directory
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================================
# Request/Response Models
# ============================================================================

class UploadResult(BaseModel):
    """Result of a file upload operation"""
    file_id: str
    filename: str
    original_filename: str
    size: int
    status: str
    table_name: str
    message: str
    upload_time: str
    error_message: Optional[str] = None


class UploadListResponse(BaseModel):
    """Response for listing uploaded files"""
    files: List[UploadResult]
    total: int


# ============================================================================
# Helper Functions
# ============================================================================

def set_manager(manager):
    """Set the MindsDB manager instance from main.py"""
    global mindsdb_manager
    mindsdb_manager = manager


def generate_unique_filename(original_filename: str) -> str:
    """Generate a unique filename to prevent conflicts in MindsDB"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    name, ext = os.path.splitext(original_filename)
    # Clean the name to be safe for MindsDB table names
    safe_name = "".join(c for c in name if c.isalnum()
                        or c in ('-', '_')).rstrip()
    unique_name = f"{safe_name}_{timestamp}{ext}"
    return unique_name


def get_table_name_from_filename(filename: str) -> str:
    """Generate a MindsDB table name from filename"""
    name, _ = os.path.splitext(filename)
    # Convert to valid table name (alphanumeric and underscores only)
    table_name = "".join(c if c.isalnum() else '_' for c in name).lower()
    # Ensure it starts with a letter
    if not table_name[0].isalpha():
        table_name = f"file_{table_name}"
    return table_name


async def upload_file_to_mindsdb(file_path: str, table_name: str) -> Dict[str, Any]:
    """Upload file to MindsDB and insert into knowledge base"""
    try:
        if not mindsdb_manager:
            raise Exception("MindsDB manager not available")

        # Use the MindsDBManager method
        result = await mindsdb_manager.upload_pdf_file(file_path, table_name)
        return result

    except Exception as e:
        logger.error(f"Error uploading file to MindsDB: {str(e)}")
        raise Exception(f"Failed to upload file to MindsDB: {str(e)}")


async def insert_file_into_kb(table_name: str) -> Dict[str, Any]:
    """Insert uploaded file data into the knowledge base"""
    try:
        if not mindsdb_manager:
            raise Exception("MindsDB manager not available")

        # This is now handled by the upload_pdf_file method
        return {
            "status": "success",
            "message": f"Data from {table_name} processed by upload method"
        }

    except Exception as e:
        logger.error(f"Error inserting file into KB: {str(e)}")
        raise Exception(f"Failed to insert file into knowledge base: {str(e)}")


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/pdf", response_model=UploadResult, status_code=status.HTTP_201_CREATED)
async def upload_pdf(file: UploadFile = File(...)):
    """
    Upload a PDF file and add it directly to the knowledge base
    Each file becomes a separate table in MindsDB
    """
    try:
        # Validate that MindsDB is connected
        if not mindsdb_manager:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="MindsDB manager not initialized"
            )

        if not mindsdb_manager.server:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="MindsDB not connected"
            )

        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are supported"
            )

        # Generate unique filename
        unique_filename = generate_unique_filename(file.filename)
        table_name = get_table_name_from_filename(unique_filename)

        # Save file temporarily
        file_path = os.path.join(UPLOAD_DIR, unique_filename)

        try:
            with open(file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)

            file_size = len(content)
            logger.info(
                f"Saved uploaded file: {file_path} ({file_size} bytes)")

            # Validate file content
            if file_size == 0:
                raise ValueError("Uploaded file is empty")

            # Upload to MindsDB and add to KB
            logger.info(f"📄 Starting MindsDB upload for file: {file.filename}")
            upload_result = await upload_file_to_mindsdb(file_path, table_name)
            logger.info(f"✅ MindsDB upload completed: {upload_result}")

            # Additional success logging
            logger.info(
                f"🎉 Successfully processed upload: {file.filename} -> {table_name}")

            # Create response
            result = UploadResult(
                file_id=table_name,
                filename=unique_filename,
                original_filename=file.filename,
                size=file_size,
                status="success",
                table_name=table_name,
                message=upload_result["message"],
                upload_time=datetime.now().isoformat()
            )

            logger.info(
                f"Successfully processed upload: {file.filename} -> {table_name}")
            return result

        except Exception as e:
            # Clean up file on error
            if os.path.exists(file_path):
                os.remove(file_path)
            raise e

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing upload: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process upload: {str(e)}"
        )


@router.post("/url", response_model=UploadResult, status_code=status.HTTP_201_CREATED)
async def upload_pdf_from_url(request: dict):
    """
    Download and upload a PDF from a URL
    """
    try:
        # Validate that MindsDB is connected
        if not mindsdb_manager:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="MindsDB manager not initialized"
            )

        if not mindsdb_manager.server:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="MindsDB not connected"
            )

        # Get URL from request
        url = request.get('url', '').strip()
        if not url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="URL is required"
            )

        # Validate URL format
        try:
            parsed_url = urlparse(url)
            if not all([parsed_url.scheme, parsed_url.netloc]):
                raise ValueError("Invalid URL format")
            if parsed_url.scheme not in ['http', 'https']:
                raise ValueError("Only HTTP/HTTPS URLs are supported")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid URL: {str(e)}"
            )

        # Check if URL appears to be a PDF
        url_lower = url.lower()
        if not (url_lower.endswith('.pdf') or 'pdf' in url_lower):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="URL must point to a PDF file"
            )

        # Download the PDF

        logger.info(f"📥 Downloading PDF from URL: {url}")

        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Failed to download PDF: HTTP {response.status}"
                    )

                # Check content type
                content_type = response.headers.get('content-type', '').lower()
                if 'pdf' not in content_type and not url_lower.endswith('.pdf'):
                    logger.warning(
                        f"Content-Type '{content_type}' doesn't indicate PDF, but proceeding...")

                content = await response.read()

                if len(content) == 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Downloaded file is empty"
                    )

        # Generate filename from URL
        original_filename = os.path.basename(parsed_url.path)
        if not original_filename or not original_filename.lower().endswith('.pdf'):
            original_filename = f"pdf_from_url_{int(datetime.now().timestamp())}.pdf"

        unique_filename = generate_unique_filename(original_filename)
        table_name = get_table_name_from_filename(unique_filename)

        # Save downloaded content to temporary file
        file_path = os.path.join(UPLOAD_DIR, unique_filename)

        try:
            with open(file_path, "wb") as buffer:
                buffer.write(content)

            file_size = len(content)
            logger.info(
                f"Saved downloaded PDF: {file_path} ({file_size} bytes)")

            # Upload to MindsDB and add to KB
            logger.info(
                f"📄 Starting MindsDB upload for downloaded PDF: {original_filename}")
            upload_result = await upload_file_to_mindsdb(file_path, table_name)
            logger.info(f"✅ MindsDB upload completed: {upload_result}")

            # Create response
            result = UploadResult(
                file_id=table_name,
                filename=unique_filename,
                original_filename=original_filename,
                size=file_size,
                status="success",
                table_name=table_name,
                message=f"PDF downloaded from URL and {upload_result['message']}",
                upload_time=datetime.now().isoformat()
            )

            logger.info(
                f"Successfully processed PDF from URL: {url} -> {table_name}")
            return result

        except Exception as e:
            # Clean up file on error
            if os.path.exists(file_path):
                os.remove(file_path)
            raise e

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing PDF URL upload: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process PDF URL: {str(e)}"
        )
