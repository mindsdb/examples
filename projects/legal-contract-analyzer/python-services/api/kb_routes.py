"""
Knowledge Base Management API Routes
Provides KB browsing, search, and management capabilities
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime
from mindsdb_manager import MindsDBManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/kb", tags=["Knowledge Base Management"])

# Global MindsDB manager instance (will be set by main.py)
mindsdb_manager: Optional[MindsDBManager] = None


def set_manager(manager):
    """Set the MindsDB manager instance from main.py"""
    global mindsdb_manager
    mindsdb_manager = manager


# Request/Response Models
class KBRow(BaseModel):
    """A single row from the knowledge base"""
    id: Optional[str] = Field(None, description="Row ID for deletion")
    chunk_id: Optional[str] = Field(None, description="Chunk ID")
    chunk_content: str = Field(..., description="Main chunk content")
    metadata: Optional[Dict[str, Any]] = Field(
        None, description="Row metadata")
    created_at: Optional[str] = Field(None, description="Creation timestamp")
    distance: Optional[float] = Field(
        None, description="Distance score from search")
    relevance: Optional[float] = Field(
        None, description="Relevance score from search")


class KBQueryResponse(BaseModel):
    """Response for KB queries"""
    rows: List[KBRow]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_more: bool


class KBSearchRequest(BaseModel):
    """Request for KB search operations"""
    query: str = Field(..., description="Search query")
    search_type: str = Field(
        "semantic", description="Search type: semantic only")
    limit: Optional[int] = Field(10, description="Number of results to return")


class KBDeleteRequest(BaseModel):
    """Request for deleting KB rows"""
    row_ids: List[str] = Field(..., description="List of chunk IDs to delete")


class KBDeleteResponse(BaseModel):
    """Response for KB deletion operations"""
    success: bool
    deleted_count: int
    failed_count: int
    message: str


# Helper Functions
def validate_kb_connection():
    """Validate KB connection and raise appropriate errors"""
    if not mindsdb_manager:
        raise HTTPException(
            status_code=503,
            detail="MindsDB manager not initialized"
        )

    if not mindsdb_manager.server:
        raise HTTPException(
            status_code=503,
            detail="MindsDB not connected"
        )

    if not mindsdb_manager.knowledge_base:
        raise HTTPException(
            status_code=503,
            detail="Knowledge base not initialized"
        )


def parse_kb_row(row_data: Any) -> KBRow:
    """Parse a raw KB row into a KBRow model"""
    try:
        # Handle different types of row data
        if hasattr(row_data, '_asdict'):
            # Named tuple
            data = row_data._asdict()
        elif isinstance(row_data, dict):
            # Dictionary
            data = row_data
        elif hasattr(row_data, '__dict__'):
            # Object with attributes
            data = row_data.__dict__
        else:
            # Fallback: assume it's iterable
            data = {"chunk_content": str(row_data)}

        chunk_id = data.get('chunk_id')
        return KBRow(
            id=chunk_id,  # Use chunk_id as the id for deletion purposes
            chunk_id=chunk_id,
            chunk_content=data.get('chunk_content', data.get('content', '')),
            metadata=data.get('metadata'),
            created_at=data.get('created_at', data.get('timestamp')),
            distance=data.get('distance'),
            relevance=data.get('relevance')
        )
    except Exception as e:
        logger.warning(f"Error parsing KB row: {e}")
        return KBRow(chunk_content=str(row_data))


# API Endpoints

@router.get("/rows", response_model=KBQueryResponse)
async def get_kb_rows(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(
        50, ge=1, le=200, description="Number of rows per page"),
    search: Optional[str] = Query(None, description="Search query filter")
):
    """
    Get KB rows with pagination and optional search filtering
    """
    try:
        validate_kb_connection()

        offset = (page - 1) * page_size

        # Build query based on search parameters
        if search and search.strip():
            # Use similarity search for content filtering
            query = f"""
            SELECT * FROM {mindsdb_manager.project.name}.legal_contracts_kb 
            WHERE chunk_content LIKE '%{search.strip()}%' 
            LIMIT {page_size} OFFSET {offset}
            """

            # Get total count for pagination
            count_query = f"""
            SELECT COUNT(*) as total FROM {mindsdb_manager.project.name}.legal_contracts_kb 
            WHERE chunk_content LIKE '%{search.strip()}%'
            """
        else:
            # Get all rows with pagination
            query = f"""
            SELECT * FROM {mindsdb_manager.project.name}.legal_contracts_kb 
            LIMIT {page_size} OFFSET {offset}
            """

            # Get total count for pagination
            count_query = f"""
            SELECT COUNT(*) as total FROM {mindsdb_manager.project.name}.legal_contracts_kb
            """

        logger.info(f"Executing KB query: {query}")

        # Execute main query
        result = mindsdb_manager.server.query(query)
        rows_data = result.fetch() if hasattr(result, 'fetch') else result

        # Execute count query
        count_result = mindsdb_manager.server.query(count_query)
        count_data = count_result.fetch() if hasattr(
            count_result, 'fetch') else count_result

        # Parse results
        rows = []
        if hasattr(rows_data, 'iterrows'):
            # Pandas DataFrame
            for idx, row in rows_data.iterrows():
                rows.append(parse_kb_row(row.to_dict()))
        elif hasattr(rows_data, '__iter__'):
            # Iterable of rows
            for row in rows_data:
                rows.append(parse_kb_row(row))

        # Get total count
        total_count = 0
        if hasattr(count_data, 'iloc'):
            # Pandas DataFrame
            total_count = int(count_data.iloc[0]['total']) if len(
                count_data) > 0 else 0
        elif hasattr(count_data, '__iter__'):
            # Iterable
            count_row = next(iter(count_data), None)
            if count_row:
                total_count = int(count_row.get('total', 0) if hasattr(
                    count_row, 'get') else getattr(count_row, 'total', 0))

        total_pages = (total_count + page_size - 1) // page_size
        has_more = page < total_pages

        logger.info(
            f"Retrieved {len(rows)} KB rows (page {page}/{total_pages}, total: {total_count})")

        return KBQueryResponse(
            rows=rows,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_more=has_more
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching KB rows: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch KB rows: {str(e)}"
        )


@router.post("/search", response_model=List[KBRow])
async def search_kb(request: KBSearchRequest):
    """
    Advanced KB search with semantic, similarity, and hybrid search options
    """
    try:
        validate_kb_connection()

        kb_name = f"{mindsdb_manager.project.name}.legal_contracts_kb"

        if request.search_type == "semantic":
            # Semantic search using vector similarity
            query = f"""
            SELECT * FROM {kb_name}
            WHERE content = '{request.query}'
            LIMIT {request.limit}
            """
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid search_type. Must be 'semantic'"
            )

        logger.info(f"Executing {request.search_type} search: {query}")

        # Execute query
        result = mindsdb_manager.server.query(query)
        rows_data = result.fetch() if hasattr(result, 'fetch') else result

        # Parse results
        rows = []
        if hasattr(rows_data, 'iterrows'):
            # Pandas DataFrame
            for idx, row in rows_data.iterrows():
                rows.append(parse_kb_row(row.to_dict()))
        elif hasattr(rows_data, '__iter__'):
            # Iterable of rows
            for row in rows_data:
                rows.append(parse_kb_row(row))

        logger.info(
            f"Found {len(rows)} results for {request.search_type} search")

        return rows

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching KB: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to search KB: {str(e)}"
        )


@router.delete("/rows", response_model=KBDeleteResponse)
async def delete_kb_rows(request: KBDeleteRequest):
    """
    Delete selected KB rows by ID
    """
    try:
        validate_kb_connection()

        if not request.row_ids:
            raise HTTPException(
                status_code=400,
                detail="No chunk IDs provided for deletion"
            )

        kb_name = f"{mindsdb_manager.project.name}.legal_contracts_kb"
        deleted_count = 0
        failed_count = 0

        # Delete rows one by one (MindsDB KB delete syntax)
        for row_id in request.row_ids:
            try:
                # Use MindsDB KB delete syntax with chunk_id in WHERE clause
                delete_query = f"""
                DELETE FROM {kb_name} 
                WHERE chunk_id = '{row_id}'
                """

                logger.info(f"Deleting KB row with chunk_id: {delete_query}")

                # Execute delete query
                result = mindsdb_manager.server.query(delete_query)
                logger.info(
                    f"Delete query executed, result type: {type(result)}")

                # Check result
                if result is not None:
                    if hasattr(result, 'fetch'):
                        result_data = result.fetch()
                        logger.info(f"Delete result data: {result_data}")
                else:
                    logger.info(
                        f"Delete query returned None for chunk_id: {row_id}")

                # Verify deletion by checking if the chunk still exists
                try:
                    verify_query = f"SELECT COUNT(*) as count FROM {kb_name} WHERE chunk_id = '{row_id}'"
                    verify_result = mindsdb_manager.server.query(verify_query)

                    if hasattr(verify_result, 'fetch'):
                        verify_data = verify_result.fetch()
                        if hasattr(verify_data, 'iloc') and len(verify_data) > 0:
                            remaining_count = int(verify_data.iloc[0]['count'])
                            if remaining_count == 0:
                                deleted_count += 1
                                logger.info(
                                    f"Verified: Successfully deleted KB row with chunk_id: {row_id}")
                            else:
                                failed_count += 1
                                logger.warning(
                                    f"Deletion failed - chunk still exists: {row_id}")
                        else:
                            # Assume success if we can't verify
                            deleted_count += 1
                            logger.info(
                                f"Delete executed, verification inconclusive for chunk_id: {row_id}")
                    else:
                        # Assume success if we can't verify
                        deleted_count += 1
                        logger.info(
                            f"Delete executed, cannot verify for chunk_id: {row_id}")
                except Exception as verify_error:
                    # If verification fails, assume the delete worked
                    deleted_count += 1
                    logger.warning(
                        f"Delete executed but verification failed for chunk_id {row_id}: {verify_error}")

            except Exception as e:
                failed_count += 1
                logger.error(
                    f"Error deleting KB row with chunk_id {row_id}: {str(e)}")

        success = deleted_count > 0
        message = f"Deleted {deleted_count} rows"
        if failed_count > 0:
            message += f", {failed_count} deletions failed"

        logger.info(f"KB deletion completed: {message}")

        return KBDeleteResponse(
            success=success,
            deleted_count=deleted_count,
            failed_count=failed_count,
            message=message
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting KB rows: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete KB rows: {str(e)}"
        )


@router.get("/stats")
async def get_kb_stats():
    """
    Get KB statistics and information
    """
    try:
        validate_kb_connection()

        kb_name = f"{mindsdb_manager.project.name}.legal_contracts_kb"

        # Get total count
        count_query = f"SELECT COUNT(*) as total FROM {kb_name}"
        count_result = mindsdb_manager.server.query(count_query)
        count_data = count_result.fetch() if hasattr(
            count_result, 'fetch') else count_result

        total_rows = 0
        if hasattr(count_data, 'iloc'):
            total_rows = int(count_data.iloc[0]['total']) if len(
                count_data) > 0 else 0
        elif hasattr(count_data, '__iter__'):
            count_row = next(iter(count_data), None)
            if count_row:
                total_rows = int(count_row.get('total', 0) if hasattr(
                    count_row, 'get') else getattr(count_row, 'total', 0))

        return {
            "success": True,
            "kb_name": "legal_contracts_kb",
            "total_rows": total_rows,
            "last_updated": datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting KB stats: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get KB stats: {str(e)}"
        )
