"""
Simplified Integration Routes - Uses existing MindsDBManager
Auto-refreshes KB and Agent when new integrations are connected
"""

from mindsdb_manager import MindsDBManager
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging
import sys
import os
import json

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))


logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/integrations", tags=["integrations"])

# Global MindsDB manager instance (will be set by main.py)
mindsdb_manager: Optional[MindsDBManager] = None

# Map frontend integration types to MindsDB engine names
ENGINE_NAME_MAP = {
    "postgresql": "postgres",
    "sharepoint": "sharepoint",
    "dropbox": "dropbox",
    "github": "github",
    "email": "email",
    "salesforce": "salesforce",
    "elasticsearch": "elasticsearch",
    "solr": "solr",
    "gitlab": "gitlab",
    "notion": "notion",
    "snowflake": "snowflake"
}

# File to store integration configurations including selected tables
INTEGRATION_CONFIG_FILE = os.path.join(
    os.path.dirname(__file__), "..", "integration_configs.json")

# File to store integration instance details
INSTANCE_CONFIG_FILE = os.path.join(
    os.path.dirname(__file__), "..", "integration_instances.json")


# ============================================================================
# Request/Response Models
# ============================================================================

class IntegrationCreate(BaseModel):
    """Request to create a new integration"""
    integration_type: str
    database_name: str
    instance_name: str  # User-defined name for this instance
    connection_params: Dict[str, Any]
    selected_tables: Optional[List[str]] = None


class TableInfo(BaseModel):
    """Information about a table in the data source"""
    name: str
    schema: Optional[str] = None
    row_count: Optional[int] = None
    columns: Optional[List[str]] = None
    description: Optional[str] = None


class IntegrationInstance(BaseModel):
    """Individual integration instance"""
    id: str
    name: str  # User-defined name
    database_name: str
    status: str
    connection_params: Optional[Dict[str, Any]] = None
    selected_tables: Optional[List[str]] = None
    available_tables: Optional[List[TableInfo]] = None
    last_sync: Optional[str] = None
    item_count: Optional[int] = None
    error_message: Optional[str] = None
    created_at: str
    updated_at: str


class IntegrationTypeResponse(BaseModel):
    """Response for a single integration type with all its instances"""
    integration_type: str
    instances: List[IntegrationInstance]


class TablesResponse(BaseModel):
    """Response for available tables"""
    database_name: str
    tables: List[TableInfo]
    total: int


class IntegrationListResponse(BaseModel):
    """List of all integration types with their instances"""
    integrations: List[IntegrationTypeResponse]
    total: int


# ============================================================================
# Helper Functions
# ============================================================================


def get_engine_name(integration_type: str) -> str:
    """Map frontend integration type to MindsDB engine name"""
    return ENGINE_NAME_MAP.get(integration_type.lower(), integration_type)


def set_manager(manager):
    """Set the MindsDB manager instance from main.py"""
    global mindsdb_manager
    mindsdb_manager = manager


async def _load_integration_configs() -> Dict[str, Any]:
    """Load integration configurations from file"""
    try:
        if os.path.exists(INTEGRATION_CONFIG_FILE):
            with open(INTEGRATION_CONFIG_FILE, 'r') as f:
                content = f.read().strip()
                if not content:  # Handle empty file
                    logger.info(
                        "Integration configs file is empty, returning empty config")
                    return {}
                config = json.loads(content)
                logger.debug(f"Loaded integration configs: {config}")
                return config
        else:
            logger.info(
                "Integration configs file does not exist, returning empty config")
            return {}
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing integration configs JSON: {e}")
        return {}
    except Exception as e:
        logger.error(f"Error loading integration configs: {e}")
        return {}


async def _load_integration_instances() -> Dict[str, Any]:
    """Load integration instances from file"""
    try:
        # Initialize file if it doesn't exist or is empty
        if not os.path.exists(INSTANCE_CONFIG_FILE) or os.path.getsize(INSTANCE_CONFIG_FILE) == 0:
            with open(INSTANCE_CONFIG_FILE, 'w') as f:
                json.dump({}, f, indent=2)
            logger.info("Initialized empty integration instances file")
            return {}

        with open(INSTANCE_CONFIG_FILE, 'r') as f:
            content = f.read().strip()
            if not content:
                logger.info(
                    "Integration instances file is empty, returning empty dict")
                return {}
            instances = json.loads(content)
            logger.debug(f"Loaded integration instances: {instances}")
            return instances

    except json.JSONDecodeError as e:
        logger.error(f"Error parsing integration instances JSON: {e}")
        logger.info("Returning empty instances due to JSON parsing error")
        return {}
    except Exception as e:
        logger.error(f"Error loading integration instances: {e}")
        return {}


async def _save_integration_instances(instances: Dict[str, Any]):
    """Save integration instances to file atomically"""
    import tempfile
    import shutil
    try:
        temp_file = INSTANCE_CONFIG_FILE + '.tmp'
        with open(temp_file, 'w') as f:
            json.dump(instances, f, indent=2, default=str)

        shutil.move(temp_file, INSTANCE_CONFIG_FILE)
        logger.info("Integration instances saved successfully")
    except Exception as e:
        logger.error(f"Error saving integration instances: {e}")
        try:
            if os.path.exists(temp_file):
                os.remove(temp_file)
        except:
            pass


async def _save_integration_configs(configs: Dict[str, Any]):
    """Save integration configurations to file atomically"""
    import tempfile
    import shutil
    try:
        # Write to temporary file first, then move (atomic operation)
        temp_file = INTEGRATION_CONFIG_FILE + '.tmp'
        with open(temp_file, 'w') as f:
            json.dump(configs, f, indent=2, default=str)

        # Atomic move (on Windows this is as atomic as we can get)
        shutil.move(temp_file, INTEGRATION_CONFIG_FILE)
        logger.info("Integration configs saved successfully")
    except Exception as e:
        logger.error(f"Error saving integration configs: {e}")
        # Clean up temp file if it exists
        try:
            if os.path.exists(temp_file):
                os.remove(temp_file)
        except:
            pass


async def _store_selected_tables(database_name: str, selected_tables: List[str]):
    """Store selected tables for a database integration"""
    configs = await _load_integration_configs()
    configs[database_name] = {
        'selected_tables': selected_tables,
        'updated_at': datetime.now().isoformat()
    }
    await _save_integration_configs(configs)


async def _get_selected_tables(database_name: str) -> Optional[List[str]]:
    """Get selected tables for a database integration"""
    configs = await _load_integration_configs()
    config = configs.get(database_name, {})
    return config.get('selected_tables')


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/", response_model=IntegrationInstance, status_code=status.HTTP_201_CREATED)
async def create_integration(integration: IntegrationCreate):
    """
    Create a new integration instance by connecting to MindsDB
    Automatically refreshes KB and Agent with new data source
    """
    try:
        if not mindsdb_manager:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MindsDB manager not initialized"
            )

        # Use the existing server connection to create database
        if not mindsdb_manager.server:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MindsDB server not connected"
            )

        # Generate instance ID and save to instances file
        instance_id = f"{integration.integration_type}_{integration.database_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Load existing instances
        instances = await _load_integration_instances()
        if integration.integration_type not in instances:
            instances[integration.integration_type] = []

        # Get correct engine name for MindsDB
        engine_name = get_engine_name(integration.integration_type)

        # Check if database already exists and drop it
        try:
            existing_db = mindsdb_manager.server.get_database(
                integration.database_name)
            if existing_db:
                logger.info(
                    f"🔄 Dropping existing database: {integration.database_name}")
                mindsdb_manager.server.drop_database(integration.database_name)
        except Exception as e:
            # Database doesn't exist, which is fine
            logger.debug(f"No existing database to drop: {str(e)}")

        # Create the database in MindsDB using credentials
        database = mindsdb_manager.server.create_database(
            engine=engine_name,
            name=integration.database_name,
            connection_args=integration.connection_params
        )

        logger.info(
            f"✅ Created integration: {integration.database_name} (engine: {engine_name})")

        # Get available tables from the database
        available_tables = []
        selected_table_count = 0
        if database:
            try:
                tables = database.list_tables()
                for table in tables:
                    table_info = TableInfo(
                        name=table.name,
                        schema=getattr(table, 'schema', None),
                        row_count=None,  # Can be populated if needed
                        columns=None,    # Can be populated if needed
                        description=getattr(table, 'description', None)
                    )
                    available_tables.append(table_info)

                    # Count only selected tables for display
                    if integration.selected_tables:
                        if table.name in integration.selected_tables:
                            selected_table_count += 1
                    else:
                        # If no specific selection, count all tables
                        selected_table_count += 1

            except Exception as e:
                logger.warning(f"⚠️ Could not list tables: {str(e)}")

        # Create instance object
        instance = IntegrationInstance(
            id=instance_id,
            name=integration.instance_name,
            database_name=integration.database_name,
            status="connected",
            connection_params=integration.connection_params,
            selected_tables=integration.selected_tables,
            available_tables=available_tables,
            item_count=selected_table_count,
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )

        # Add to instances list
        instances[integration.integration_type].append(instance.dict())
        await _save_integration_instances(instances)

        # Store selected tables information for KB manager
        if integration.selected_tables:
            await _store_selected_tables(integration.database_name, integration.selected_tables)
            logger.info(
                f"Stored selected tables for {integration.database_name}: {integration.selected_tables}")

            # AUTO-SYNC KB and CREATE INSTANCE JOB: Process any integration with selected tables
            if mindsdb_manager.kb_manager:
                try:
                    logger.info(
                        f"🔄 Integration with selected tables detected, syncing KB...")
                    sync_result = await mindsdb_manager.kb_manager.sync_all_sources()
                    logger.info(
                        f"✅ KB synced successfully: {sync_result.get('status')}")

                    # CREATE SYNC JOB for this specific instance
                    logger.info(
                        f"🔄 Creating sync job for instance: {integration.database_name}")

                    # Build sources for this instance
                    instance_sources = []
                    for table_name in integration.selected_tables:
                        instance_sources.append({
                            'instance_name': integration.database_name,
                            'datasource_name': integration.database_name,
                            'table_name': table_name,
                            'datasource_type': integration.integration_type,
                            'full_name': f"{integration.database_name}.{table_name}",
                            'engine': engine_name,
                            'selected': True
                        })

                    if instance_sources:
                        job_result = await mindsdb_manager.kb_manager.create_instance_sync_job(
                            integration.database_name, instance_sources
                        )
                        logger.info(
                            f"✅ Sync job for instance {integration.database_name}: {job_result.get('status')}")
                    else:
                        logger.warning(
                            f"No sources found for instance {integration.database_name}")

                except Exception as e:
                    logger.warning(
                        f"⚠️ KB sync or job creation for instance failed: {str(e)}")

        # AUTO-REFRESH: update agent to include new data source (prefer update API)
        try:
            # Only add specific tables to agent, avoid wildcards
            if integration.selected_tables:
                add_list = [
                    f"{integration.database_name}.{tbl}" for tbl in integration.selected_tables]
                ok = await mindsdb_manager.update_agent_tables(add=add_list)
                if not ok:
                    logger.warning(
                        "Falling back to recreate agent when adding selected tables")
                    await mindsdb_manager.create_agent()
                logger.info(
                    f"✅ Agent updated with specific tables: {add_list}")
            else:
                # If no specific tables selected, the agent will be recreated later when tables are selected
                logger.info(
                    f"No specific tables selected for {integration.database_name}, agent will be updated when tables are chosen")

            logger.info(
                f"✅ Agent refreshed with new data source: {integration.database_name}")
        except Exception as e:
            logger.warning(f"⚠️ Agent refresh failed (non-critical): {str(e)}")

        return instance

    except Exception as e:
        logger.error(f"❌ Failed to create integration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create integration: {str(e)}"
        )


@router.get("/", response_model=IntegrationListResponse)
async def list_integrations():
    """Get all integration types with their instances"""
    try:
        instances = await _load_integration_instances()

        integration_types = []
        total_instances = 0

        # Get all possible integration types
        all_types = ["sharepoint", "dropbox", "postgresql", "salesforce",
                     "elasticsearch", "solr", "github", "gitlab", "notion",
                     "email", "snowflake"]

        for integration_type in all_types:
            type_instances = instances.get(integration_type, [])

            # Convert dict instances to IntegrationInstance objects
            instance_objects = []
            for instance_data in type_instances:
                instance_objects.append(IntegrationInstance(**instance_data))

            integration_types.append(IntegrationTypeResponse(
                integration_type=integration_type,
                instances=instance_objects
            ))

            total_instances += len(instance_objects)

        return IntegrationListResponse(
            integrations=integration_types,
            total=total_instances
        )

    except Exception as e:
        logger.error(f"❌ Failed to list integrations: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list integrations: {str(e)}"
        )


@router.delete("/{database_name}")
async def delete_integration(database_name: str):
    """Delete an integration instance"""
    try:
        if not mindsdb_manager:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MindsDB manager not initialized"
            )

        # Find and remove the instance from the instances file
        instances = await _load_integration_instances()
        instance_found = False

        for integration_type, type_instances in instances.items():
            for i, instance in enumerate(type_instances):
                if instance.get('database_name') == database_name:
                    # Remove the instance
                    instances[integration_type].pop(i)
                    instance_found = True
                    break
            if instance_found:
                break

        if not instance_found:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Integration instance with database name '{database_name}' not found"
            )

        # Save updated instances
        await _save_integration_instances(instances)

        # Drop the database using server method
        mindsdb_manager.server.drop_database(database_name)

        logger.info(f"✅ Deleted integration: {database_name}")

        # AUTO-CLEANUP: Mark data source as removed and drop instance-specific sync job
        if mindsdb_manager.kb_manager:
            try:
                logger.info(
                    f"🔄 Integration removed, updating KB tracking and dropping sync job...")

                # Mark source as removed in tracking (no KB deletion)
                await mindsdb_manager.kb_manager.mark_source_as_removed(database_name)

                # Drop the specific sync job for this instance
                job_result = await mindsdb_manager.kb_manager.drop_instance_sync_job(database_name)
                logger.info(
                    f"🗑️ Instance sync job removal: {job_result.get('status')}")

                logger.info(
                    f"✅ KB tracking updated and sync job removed for: {database_name}")
            except Exception as e:
                logger.warning(
                    f"⚠️ KB cleanup failed (non-critical): {str(e)}")

        # Remove from integration configs
        try:
            configs = await _load_integration_configs()
            if database_name in configs:
                del configs[database_name]
                await _save_integration_configs(configs)
                logger.info(f"Removed integration config for: {database_name}")
        except Exception as e:
            logger.warning(f"Failed to remove integration config: {e}")

        # AUTO-REFRESH: Update agent to remove data source tables
        try:
            # Remove all tables that match this database prefix
            if mindsdb_manager.agent and hasattr(mindsdb_manager.agent, 'data') and mindsdb_manager.agent.data:
                agent_tables = mindsdb_manager.agent.data.get('tables', [])
                to_remove = [t for t in agent_tables if str(
                    t).startswith(f"{database_name}.")]
                
                if to_remove:
                    ok = await mindsdb_manager.update_agent_tables(remove=to_remove)
                    if ok:
                        logger.info(f"✅ Removed tables from agent: {to_remove}")
                    else:
                        logger.warning("Failed to remove tables via update API, recreating agent")
                        await mindsdb_manager.create_agent()
                else:
                    logger.info(f"No tables found in agent for database: {database_name}")
            else:
                logger.info("Agent not available or has no data, skipping table removal")

            logger.info(f"✅ Agent refreshed after removing: {database_name}")
        except Exception as e:
            logger.warning(f"⚠️ Agent refresh failed (non-critical): {str(e)}")

        return {"message": f"Integration instance '{database_name}' deleted successfully"}

    except Exception as e:
        logger.error(f"❌ Failed to delete integration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete integration: {str(e)}"
        )


@router.post("/test", response_model=Dict[str, Any])
async def test_integration(integration: IntegrationCreate):
    """
    Test connection parameters without saving
    Credentials are used ONLY for testing, then discarded
    """
    try:
        # Basic validation
        if not integration.connection_params:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No connection parameters provided"
            )

        # Try to create a temporary connection to test
        if not mindsdb_manager:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MindsDB manager not initialized"
            )

        # Get correct engine name
        engine_name = get_engine_name(integration.integration_type)
        test_db_name = f"test_{integration.database_name}"

        try:
            # Create test database
            database = mindsdb_manager.server.create_database(
                engine=engine_name,
                name=test_db_name,
                connection_args=integration.connection_params
            )

            # If successful, drop the test database using server method
            mindsdb_manager.server.drop_database(test_db_name)

            logger.info(
                f"✅ Test passed: {integration.integration_type} (engine: {engine_name})")

            return {
                "test_passed": True,
                "message": "Connection successful",
                "database_name": integration.database_name,
                "integration_type": integration.integration_type
            }

        except Exception as test_error:
            logger.warning(f"⚠️ Test failed: {str(test_error)}")
            return {
                "test_passed": False,
                "message": f"Connection failed: {str(test_error)}",
                "database_name": integration.database_name,
                "integration_type": integration.integration_type
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Test failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Test failed: {str(e)}"
        )


@router.get("/{database_name}/tables", response_model=TablesResponse)
async def get_integration_tables(database_name: str):
    """Get available tables for an integration"""
    try:
        if not mindsdb_manager:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MindsDB manager not initialized"
            )

        # Check if database exists
        database = mindsdb_manager.server.get_database(database_name)
        if not database:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Integration '{database_name}' not found"
            )

        # Get tables from the database
        tables = []
        try:
            db_tables = database.list_tables()
            for table in db_tables:
                tables.append(TableInfo(
                    name=table.name,
                    schema=getattr(table, 'schema', None),
                    row_count=None,  # Can be populated if needed
                    columns=None,    # Can be populated if needed
                    description=getattr(table, 'description', None)
                ))
            logger.info(f"✅ Found {len(tables)} tables in {database_name}")
        except Exception as e:
            logger.warning(f"⚠️ Could not list tables: {str(e)}")
            tables = []

        return TablesResponse(
            database_name=database_name,
            tables=tables,
            total=len(tables)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get tables: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get tables: {str(e)}"
        )


class IntegrationUpdateTables(BaseModel):
    """Request to update selected tables for an integration"""
    selected_tables: List[str]


@router.post("/{database_name}/sync")
async def sync_integration(database_name: str):
    """Trigger a sync/refresh of the integration"""
    try:
        if not mindsdb_manager:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MindsDB manager not initialized"
            )

        # Check if database exists
        database = mindsdb_manager.server.get_database(database_name)
        if not database:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Integration '{database_name}' not found"
            )

        # Get selected tables to provide more detailed sync info
        selected_tables = await _get_selected_tables(database_name)

        # If KB manager is available, trigger a full sync
        if mindsdb_manager.kb_manager:
            try:
                sync_result = await mindsdb_manager.kb_manager.sync_all_sources()
                logger.info(f"KB sync completed: {sync_result}")
            except Exception as e:
                logger.warning(f"KB sync failed: {e}")

        return {
            "message": f"Integration '{database_name}' synced successfully",
            "selected_tables": selected_tables,
            "selected_count": len(selected_tables) if selected_tables else "all",
            "last_sync": datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Sync failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}"
        )