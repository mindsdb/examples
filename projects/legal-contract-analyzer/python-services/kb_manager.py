"""
Knowledge Base Manager for Legal Contracts
Handles automatic syncing, duplicate prevention, and incremental updates
"""

import json
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from pathlib import Path
from mindsdb_manager import MindsDBManager

logger = logging.getLogger(__name__)


class KnowledgeBaseManager:
    """
    Comprehensive KB manager that ensures continuous awareness of all connected 
    data source integrations and stays up to date without duplicating or losing data.
    """

    def __init__(self, mindsdb_manager: MindsDBManager):
        self.mindsdb_manager = mindsdb_manager
        self.server = mindsdb_manager.server
        self.project = mindsdb_manager.project
        self.knowledge_base = mindsdb_manager.knowledge_base

        # Tracking file for processed data sources
        self.tracking_file = Path(__file__).parent / "kb_tracking.json"
        self.processed_sources = self._load_tracking_data()

        # Legal contract data source pattern (legacy support)
        self.datasource_pattern = "_datasource_for_legal_contracts"

        # Job name prefix for per-instance jobs
        self.job_name_prefix = "kb_sync_"

        # Legacy job name (for backward compatibility)
        self.sync_job_name = "kb_hourly_sync"

        # Integration configs file
        self.integration_configs_file = Path(
            __file__).parent / "integration_configs.json"

        # Initialize files if they don't exist or are empty
        self._initialize_config_files()

    def _initialize_config_files(self):
        """Initialize configuration files with proper default content if they don't exist or are empty"""
        try:
            # Initialize integration configs file
            if not self.integration_configs_file.exists() or self.integration_configs_file.stat().st_size == 0:
                with open(self.integration_configs_file, 'w') as f:
                    json.dump({}, f, indent=2)
                logger.info("Initialized empty integration configs file")

            # Initialize tracking file
            if not self.tracking_file.exists() or self.tracking_file.stat().st_size == 0:
                default_tracking = {
                    "processed_sources": {},
                    "last_sync": None,
                    "sync_count": 0
                }
                with open(self.tracking_file, 'w') as f:
                    json.dump(default_tracking, f, indent=2)
                logger.info("Initialized empty tracking data file")

        except Exception as e:
            logger.error(f"Error initializing config files: {e}")

    def _load_integration_configs(self) -> Dict[str, Any]:
        """Load integration configurations including selected tables"""
        try:
            if self.integration_configs_file.exists():
                with open(self.integration_configs_file, 'r') as f:
                    content = f.read().strip()
                    if not content:  # Handle empty file
                        logger.info(
                            "Integration configs file is empty, returning empty config")
                        return {}
                    config = json.loads(content)
                    logger.info(f"Loaded integration configs: {config}")
                    return config
            else:
                logger.info(
                    "Integration configs file does not exist, returning empty config")
                return {}
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing integration configs JSON: {e}")
            logger.info("Returning empty config due to JSON parsing error")
            return {}
        except Exception as e:
            logger.error(f"Error loading integration configs: {e}")
            return {}

    def _get_selected_tables_for_datasource(self, datasource_name: str) -> Optional[List[str]]:
        """Get selected tables for a specific datasource"""
        configs = self._load_integration_configs()
        config = configs.get(datasource_name, {})
        selected_tables = config.get('selected_tables')

        if selected_tables:
            logger.info(
                f"Found selected tables for {datasource_name}: {selected_tables}")
        else:
            if datasource_name in configs:
                logger.warning(
                    f"Configuration exists for {datasource_name} but no selected_tables found")
            else:
                logger.info(
                    f"No configuration found for {datasource_name} - tables must be selected first")

        return selected_tables

    def _has_configured_datasources(self) -> bool:
        """Check if any datasources have table selections configured"""
        configs = self._load_integration_configs()
        configured_count = 0

        for datasource_name, config in configs.items():
            if config.get('selected_tables'):
                configured_count += 1
                logger.info(
                    f"Found configured datasource: {datasource_name} with tables: {config['selected_tables']}")

        logger.info(f"Total configured datasources: {configured_count}")
        return configured_count > 0

    def _load_tracking_data(self) -> Dict[str, Any]:
        """Load tracking data for processed data sources"""
        try:
            if self.tracking_file.exists():
                with open(self.tracking_file, 'r') as f:
                    content = f.read().strip()
                    if not content:  # Handle empty file
                        logger.info(
                            "Tracking data file is empty, initializing with default data")
                        return {
                            "processed_sources": {},
                            "last_sync": None,
                            "sync_count": 0
                        }
                    tracking_data = json.loads(content)
                    logger.debug(
                        f"Loaded tracking data: {len(tracking_data.get('processed_sources', {}))} sources")
                    return tracking_data
            else:
                logger.info(
                    "Tracking data file does not exist, initializing with default data")
                return {
                    "processed_sources": {},
                    "last_sync": None,
                    "sync_count": 0
                }
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing tracking data JSON: {e}")
            logger.info(
                "Returning default tracking data due to JSON parsing error")
            return {
                "processed_sources": {},
                "last_sync": None,
                "sync_count": 0
            }
        except Exception as e:
            logger.error(f"Error loading tracking data: {e}")
            return {
                "processed_sources": {},
                "last_sync": None,
                "sync_count": 0
            }

    def _save_tracking_data(self):
        """Save tracking data to file"""
        try:
            with open(self.tracking_file, 'w') as f:
                json.dump(self.processed_sources, f, indent=2, default=str)
            logger.info("Tracking data saved successfully")
        except Exception as e:
            logger.error(f"Error saving tracking data: {e}")

    def _get_legal_contract_datasources(self) -> List[Dict[str, Any]]:
        """
        Get all connected data sources that have table configurations
        Now supports multiple integration instances with unique names
        """
        try:
            connected_dbs = self.server.list_databases()
            legal_datasources = []

            # Get all configured datasources from integration configs
            configs = self._load_integration_configs()
            configured_datasource_names = set(configs.keys())

            logger.info(
                f"Configured datasources: {configured_datasource_names}")

            for db in connected_dbs:
                # Skip system databases
                if db.name in ['mindsdb', 'information_schema', 'files']:
                    continue

                # Check if this database has configuration (either new instance format or legacy)
                is_configured = (
                    db.name in configured_datasource_names or  # New instance format
                    # Legacy format support
                    db.name.endswith(self.datasource_pattern)
                )

                if not is_configured:
                    logger.debug(f"Skipping unconfigured database: {db.name}")
                    continue

                # Get tables in this database
                try:
                    tables = db.list_tables()
                    if not tables:
                        logger.warning(
                            f"No tables found in datasource: {db.name}")
                        continue

                    # Get selected tables for this datasource
                    selected_tables = self._get_selected_tables_for_datasource(
                        db.name)

                    # If no configuration exists for this datasource, skip processing entirely
                    if selected_tables is None:
                        logger.info(
                            f"No table selection configuration found for {db.name} - skipping all tables")
                        continue

                    for table in tables:
                        # Skip table if it's not in the selected tables list
                        if table.name not in selected_tables:
                            logger.info(
                                f"Skipping table {table.name} - not selected for {db.name}")
                            continue

                        # Verify we can actually access the table
                        try:
                            # Test table access
                            table_obj = db.tables.get(table.name)

                            # Extract datasource type from name (handle both new and legacy formats)
                            if db.name.endswith(self.datasource_pattern):
                                # Legacy format: postgresql_datasource_for_legal_contracts
                                datasource_type = db.name.replace(
                                    self.datasource_pattern, '')
                            else:
                                # New format: postgresql_questions_1760768449767
                                # Extract type from beginning of name
                                datasource_type = db.name.split('_')[0]

                            legal_datasources.append({
                                'instance_name': db.name,  # Unique instance name
                                'datasource_name': db.name,  # Keep for compatibility
                                'table_name': table.name,
                                'datasource_type': datasource_type,
                                'full_name': f"{db.name}.{table.name}",
                                'engine': getattr(db, 'engine', 'unknown'),
                                'selected': True  # This table was explicitly selected
                            })
                            logger.info(
                                f"Including selected table: {db.name}.{table.name}")
                        except Exception as table_error:
                            logger.warning(
                                f"Cannot access table {table.name} in {db.name}: {table_error}")
                            continue

                except Exception as e:
                    logger.warning(
                        f"Could not list tables for {db.name}: {e}")
                    continue

            logger.info(
                f"Found {len(legal_datasources)} legal contract data sources from {len(configured_datasource_names)} configured instances")
            return legal_datasources

        except Exception as e:
            logger.error(f"Error getting legal contract datasources: {e}")
            return []

    def _get_datasources_by_instance(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Group datasources by integration instance for per-instance job management
        Returns: {instance_name: [list of tables for that instance]}
        """
        legal_sources = self._get_legal_contract_datasources()
        instances = {}

        for source in legal_sources:
            instance_name = source['instance_name']
            if instance_name not in instances:
                instances[instance_name] = []
            instances[instance_name].append(source)

        logger.info(
            f"Grouped {len(legal_sources)} sources into {len(instances)} instances: {list(instances.keys())}")
        return instances

    def _get_job_name_for_instance(self, instance_name: str) -> str:
        """Get unique job name for a specific integration instance"""
        return f"{self.job_name_prefix}{instance_name}"

    def _detect_contract_text_column_for_source(self, source: Dict[str, Any]) -> str:
        """
        Detect which column likely contains contract text or PDF URLs for a specific source
        """
        try:
            # Get the database
            database = self.server.databases.get(source['datasource_name'])

            # Try to get table schema using fully qualified table name
            full_table_name = f"{source['datasource_name']}.{source['table_name']}"
            describe_query = f"SHOW COLUMNS FROM {full_table_name}"
            logger.info(
                f"Attempting to describe table with query: {describe_query}")
            table_info = database.query(describe_query)

            # Extract column names from the describe result
            columns = []
            if hasattr(table_info, 'fetch'):
                df = table_info.fetch()
                logger.info(f"Schema query result type: {type(df)}")

                # Handle pandas DataFrame result
                if hasattr(df, 'Field'):
                    # DataFrame with 'Field' column containing column names
                    columns = df['Field'].tolist()
                    logger.info(
                        f"Extracted columns from 'Field' column: {columns}")
                elif hasattr(df, 'columns') and 'Field' in df.columns:
                    # Alternative way to access Field column
                    columns = df['Field'].tolist()
                    logger.info(
                        f"Extracted columns from DataFrame['Field']: {columns}")
                else:
                    # Fallback: iterate through rows and try different approaches
                    for row in df.itertuples() if hasattr(df, 'itertuples') else []:
                        if hasattr(row, 'Field'):
                            columns.append(row.Field)
                        elif len(row) > 1:  # row[0] is usually the index
                            columns.append(str(row[1]))  # First actual column
                    logger.info(
                        f"Extracted columns via row iteration: {columns}")

            # Fallback: try to get columns from table object properties
            if not columns:
                try:
                    table = database.tables.get(source['table_name'])
                    if hasattr(table, 'columns'):
                        columns = [col.name for col in table.columns]
                except:
                    pass

            # If still no columns, try a SELECT LIMIT 0 approach with full table name
            if not columns:
                try:
                    sample_query = f"SELECT * FROM {full_table_name} LIMIT 0"
                    logger.info(
                        f"Attempting column detection with query: {sample_query}")
                    sample_result = database.query(sample_query)
                    if hasattr(sample_result, 'columns'):
                        columns = [col.name for col in sample_result.columns]
                except Exception as select_error:
                    logger.warning(
                        f"SELECT LIMIT 0 approach failed: {select_error}")
                    pass

            if not columns:
                logger.warning(
                    f"Could not determine columns for {source['full_name']}")
                return None

            logger.info(f"Found columns for {source['full_name']}: {columns}")

            # Use priority-based detection for content columns
            priority_names = [
                'content', 'contract_text', 'text', 'document_text', 'pdf_content',
                'contract_content', 'full_text', 'body', 'document_content',
                'contract_url', 'pdf_url', 'document_url', 'url', 'link',
                'file_path', 'document_path', 'pdf_path', 'subject'
            ]

            # Look for exact matches first
            for priority_name in priority_names:
                if priority_name in columns:
                    logger.info(
                        f"Found contract text column for {source['full_name']}: {priority_name}")
                    return priority_name

            # Look for partial matches
            for priority_name in priority_names:
                for column_name in columns:
                    if priority_name in column_name.lower():
                        logger.info(
                            f"Found contract text column for {source['full_name']} (partial): {column_name}")
                        return column_name

            # Fallback: look for any column with keywords
            for column_name in columns:
                column_lower = column_name.lower()
                if any(keyword in column_lower for keyword in ['text', 'content', 'url', 'pdf', 'document', 'subject', 'body']):
                    logger.info(
                        f"Found contract text column for {source['full_name']} (fallback): {column_name}")
                    return column_name

            logger.warning(
                f"No contract text column detected for {source['full_name']}")
            return None

        except Exception as e:
            logger.warning(
                f"Could not detect contract text column for {source['full_name']}: {e}")
            return None

    def _check_kb_schema_compatibility(self, source: Dict[str, Any]) -> Dict[str, Any]:
        """
        Check if the source schema is compatible with the KB schema
        Returns information about compatibility and suggested mapping
        """
        try:
            # Get source columns
            database = self.server.databases.get(source['datasource_name'])
            full_table_name = f"{source['datasource_name']}.{source['table_name']}"

            # Try to get columns using SHOW COLUMNS
            try:
                describe_query = f"SHOW COLUMNS FROM {full_table_name}"
                table_info = database.query(describe_query)

                source_columns = []
                if hasattr(table_info, 'fetch'):
                    df = table_info.fetch()
                    if hasattr(df, 'Field'):
                        source_columns = df['Field'].tolist()
                    elif hasattr(df, 'columns') and 'Field' in df.columns:
                        source_columns = df['Field'].tolist()

            except Exception:
                # Fallback to SELECT LIMIT 0 if SHOW COLUMNS fails
                sample_query = f"SELECT * FROM {full_table_name} LIMIT 0"
                sample_result = database.query(sample_query)
                if hasattr(sample_result, 'columns'):
                    source_columns = [
                        col.name for col in sample_result.columns]
                else:
                    source_columns = []

            if not source_columns:
                return {
                    'compatible': False,
                    'reason': 'Could not determine source schema',
                    'source_columns': [],
                    'mapping_strategy': 'unknown'
                }

            # Check if we have at least one content-like column
            content_columns = []
            for col in source_columns:
                col_lower = col.lower()
                if any(keyword in col_lower for keyword in ['content', 'text', 'body', 'subject', 'document']):
                    content_columns.append(col)

            if not content_columns:
                return {
                    'compatible': False,
                    'reason': 'No content-like columns found',
                    'source_columns': source_columns,
                    'mapping_strategy': 'needs_manual_mapping'
                }

            return {
                'compatible': True,
                'reason': 'Found compatible content columns',
                'source_columns': source_columns,
                'content_columns': content_columns,
                'mapping_strategy': 'automatic'
            }

        except Exception as e:
            logger.error(f"Error checking KB schema compatibility: {e}")
            return {
                'compatible': False,
                'reason': f'Error during compatibility check: {str(e)}',
                'source_columns': [],
                'mapping_strategy': 'error'
            }

    def _generate_job_insert_query_with_pdf_extraction(
        self,
        source: Dict[str, Any],
        contract_text_column: str = None
    ) -> str:
        """
        Generate INSERT query for jobs - delegates to MindsDB manager's unified method
        """
        # Detect integration type from datasource name
        integration_type = self._detect_source_integration_type(source)

        # Get available columns from source if available, or try to detect them
        available_columns = source.get('available_columns', [])
        if not available_columns:
            # Try to get columns for this source
            try:
                database = self.server.databases.get(source['datasource_name'])
                full_table_name = f"{source['datasource_name']}.{source['table_name']}"

                # Try SHOW COLUMNS approach
                try:
                    describe_query = f"SHOW COLUMNS FROM {full_table_name}"
                    table_info = database.query(describe_query)
                    df = table_info.fetch()

                    if hasattr(df, 'Field'):
                        available_columns = df['Field'].tolist()
                    elif hasattr(df, 'columns') and 'Field' in df.columns:
                        available_columns = df['Field'].tolist()
                    else:
                        # Fallback: iterate through rows
                        for row in df.itertuples() if hasattr(df, 'itertuples') else []:
                            if hasattr(row, 'Field'):
                                available_columns.append(row.Field)
                            elif len(row) > 1:
                                available_columns.append(str(row[1]))
                except Exception:
                    # Try table schema approach
                    table = database.tables.get(source['table_name'])
                    schema = table.get_schema()
                    if schema and 'columns' in schema:
                        available_columns = list(schema['columns'].keys())

                logger.info(
                    f"Detected available columns for job: {available_columns}")
            except Exception as e:
                logger.warning(
                    f"Could not detect columns for job source {source['full_name']}: {e}")

        return self.mindsdb_manager._generate_insert_query_with_pdf_extraction(
            datasource_name=source['datasource_name'],
            table_name=source['table_name'],
            contract_text_column=contract_text_column,
            include_metadata=True,  # Jobs should preserve metadata
            integration_type=integration_type,
            available_columns=available_columns
        )

    def _detect_source_integration_type(self, source: Dict[str, Any]) -> str:
        """
        Detect integration type from source information
        """
        datasource_name = source.get('datasource_name', '').lower()
        instance_name = source.get('instance_name', '').lower()

        # Check instance name first (more specific)
        if instance_name:
            if 'email' in instance_name or 'smtp' in instance_name:
                return 'email'
            elif 'postgresql' in instance_name or 'postgres' in instance_name:
                return 'postgres'
            elif 'sharepoint' in instance_name:
                return 'sharepoint'
            elif 'dropbox' in instance_name:
                return 'dropbox'
            elif 'salesforce' in instance_name:
                return 'salesforce'
            elif 'elasticsearch' in instance_name or 'elastic' in instance_name:
                return 'elasticsearch'
            elif 'notion' in instance_name:
                return 'notion'
            elif 'github' in instance_name:
                return 'github'
            elif 'snowflake' in instance_name:
                return 'snowflake'

        # Fallback to datasource name
        if 'email' in datasource_name or 'smtp' in datasource_name:
            return 'email'
        elif 'postgresql' in datasource_name or 'postgres' in datasource_name:
            return 'postgres'
        elif 'sharepoint' in datasource_name:
            return 'sharepoint'
        elif 'dropbox' in datasource_name:
            return 'dropbox'
        elif 'salesforce' in datasource_name:
            return 'salesforce'
        elif 'elasticsearch' in datasource_name or 'elastic' in datasource_name:
            return 'elasticsearch'
        elif 'notion' in datasource_name:
            return 'notion'
        elif 'github' in datasource_name:
            return 'github'
        elif 'snowflake' in datasource_name:
            return 'snowflake'
        elif 'files' in datasource_name or 'upload' in datasource_name:
            return 'pdf'

        # Default to generic
        return 'generic'

    async def _is_kb_empty(self) -> bool:
        """
        Check if the knowledge base is empty by querying for any content
        """
        try:
            if not self.knowledge_base:
                logger.warning("Knowledge base not available for empty check")
                return True

            # Try to query the KB for any content
            # Use the underlying vector store to check for data
            query_result = self.mindsdb_manager.server.query(
                f"SELECT COUNT(*) as row_count FROM {self.project.name}.legal_contracts_kb"
            )
            result = query_result.fetch()

            if hasattr(result, 'iloc') and len(result) > 0:
                # DataFrame result
                row_count = result.iloc[0]['row_count'] if 'row_count' in result.columns else 0
            elif hasattr(result, '__len__') and len(result) > 0:
                # List result
                row_count = result[0].get('row_count', 0) if hasattr(
                    result[0], 'get') else 0
            else:
                row_count = 0

            logger.info(f"Knowledge base row count: {row_count}")
            return row_count == 0

        except Exception as e:
            logger.warning(
                f"Could not check if KB is empty, assuming it is: {e}")
            # If we can't check, assume it's empty to force a resync
            return True

    async def initialize_kb_with_existing_sources(self) -> Dict[str, Any]:
        """
        Initialize KB with data from all existing connected legal contract data sources
        Only processes sources that haven't been processed before
        """
        try:
            logger.info("Initializing KB with existing data sources...")

            # Check if any datasources have table configurations
            if not self._has_configured_datasources():
                logger.info(
                    "No datasources with table configurations found - skipping KB initialization")
                return {
                    'status': 'skipped',
                    'message': 'No table selections configured - please configure table selections first',
                    'total_sources_found': 0,
                    'new_sources_processed': 0,
                    'already_processed': 0,
                    'errors': [],
                    'processed_sources': []
                }

            # Ensure knowledge base exists
            if not self.knowledge_base:
                await self.mindsdb_manager.create_knowledge_base()
                self.knowledge_base = self.mindsdb_manager.knowledge_base

            legal_sources = self._get_legal_contract_datasources()
            new_sources = []
            skipped_sources = []

            for source in legal_sources:
                source_key = source['full_name']

                # Check if this source has been processed
                if source_key not in self.processed_sources.get('processed_sources', {}):
                    new_sources.append(source)
                    logger.info(f"New source found: {source_key}")
                else:
                    skipped_sources.append(source)
                    logger.info(f"Source already processed: {source_key}")

            # Process new sources
            processed_count = 0
            errors = []

            for source in new_sources:
                try:
                    # Detect integration type for this source
                    integration_type = self._detect_source_integration_type(
                        source)
                    logger.info(
                        f"Processing new source: {source['full_name']} with integration type: {integration_type}")

                    # Insert data from this source into KB
                    result = await self.mindsdb_manager.bulk_insert_contracts_from_datasource(
                        datasource_name=source['datasource_name'],
                        table_name=source['table_name'],
                        integration_type=integration_type
                    )

                    # Mark source as completed
                    self.processed_sources.setdefault('processed_sources', {})[source['full_name']] = {
                        'first_processed': datetime.now().isoformat(),
                        'last_synced': datetime.now().isoformat(),
                        'datasource_type': source['datasource_type'],
                        'engine': source['engine'],
                        'status': result.status
                    }

                    processed_count += 1
                    logger.info(
                        f"Successfully processed source: {source['full_name']}")

                except Exception as e:
                    error_msg = f"Failed to process source {source['full_name']}: {e}"
                    errors.append(error_msg)
                    logger.error(error_msg)

            # Update tracking data
            self.processed_sources['last_sync'] = datetime.now().isoformat()
            self.processed_sources['sync_count'] = self.processed_sources.get(
                'sync_count', 0) + 1
            self._save_tracking_data()

            return {
                'status': 'completed',
                'total_sources_found': len(legal_sources),
                'new_sources_processed': processed_count,
                'already_processed': len(skipped_sources),
                'errors': errors,
                'processed_sources': [s['full_name'] for s in new_sources]
            }

        except Exception as e:
            logger.error(f"KB initialization failed: {e}")
            raise

    async def sync_all_sources(self) -> Dict[str, Any]:
        """
        Perform a full sync of all connected legal contract data sources
        Updates existing sources and adds new ones
        """
        try:
            logger.info(
                "Starting full sync of all legal contract data sources...")

            # Check if any datasources have table configurations
            if not self._has_configured_datasources():
                logger.info(
                    "No datasources with table configurations found - skipping sync")
                return {
                    'status': 'skipped',
                    'sync_time': datetime.now().isoformat(),
                    'message': 'No table selections configured - please configure table selections first',
                    'total_sources': 0,
                    'new_sources': 0,
                    'updated_sources': 0,
                    'removed_sources': 0,
                    'new_source_names': [],
                    'removed_source_names': []
                }

            legal_sources = self._get_legal_contract_datasources()
            current_source_names = {s['full_name'] for s in legal_sources}

            # Check for removed sources
            processed_source_names = set(
                self.processed_sources.get('processed_sources', {}).keys())
            removed_sources = processed_source_names - current_source_names

            # Handle removed sources (mark as removed, don't delete KB data)
            for removed_source in removed_sources:
                self.processed_sources['processed_sources'][removed_source]['status'] = 'removed'
                self.processed_sources['processed_sources'][removed_source]['removed_date'] = datetime.now(
                ).isoformat()
                logger.info(f"Marked removed source: {removed_source}")

            # Process current sources
            new_sources = []
            updated_sources = []

            # Check if KB is empty - if so, force resync all sources
            kb_is_empty = await self._is_kb_empty()

            # For manual sync_all_sources, always force resync all sources
            logger.info(
                "Manual sync triggered - forcing resync of all configured sources")
            new_sources = legal_sources.copy()
            kb_is_empty = True  # Set this to true to indicate forced resync in response

            # Insert new sources
            processed_count = 0
            for source in new_sources:
                try:
                    # Detect integration type for this source
                    integration_type = self._detect_source_integration_type(
                        source)
                    logger.info(
                        f"Force resyncing source: {source['full_name']} with integration type: {integration_type}")

                    await self.mindsdb_manager.bulk_insert_contracts_from_datasource(
                        datasource_name=source['datasource_name'],
                        table_name=source['table_name'],
                        integration_type=integration_type
                    )

                    self.processed_sources.setdefault('processed_sources', {})[source['full_name']] = {
                        'first_processed': self.processed_sources.get('processed_sources', {}).get(source['full_name'], {}).get('first_processed', datetime.now().isoformat()),
                        'last_synced': datetime.now().isoformat(),
                        'datasource_type': source['datasource_type'],
                        'engine': source['engine'],
                        'status': 'processed'
                    }

                    processed_count += 1
                    logger.info(
                        f"Successfully processed source: {source['full_name']}")

                except Exception as e:
                    error_msg = f"Failed to process source {source['full_name']}: {e}"
                    logger.error(error_msg)
                    # Continue processing other sources

                    logger.info(f"Added new source: {source['full_name']}")

                except Exception as e:
                    logger.error(
                        f"Failed to add new source {source['full_name']}: {e}")

            # Update global tracking
            self.processed_sources['last_sync'] = datetime.now().isoformat()
            self.processed_sources['sync_count'] = self.processed_sources.get(
                'sync_count', 0) + 1
            self._save_tracking_data()

            # Update agent with new data sources
            await self.mindsdb_manager.update_agent()

            # Check if we need to cleanup the sync job (no active sources left)
            if not legal_sources:
                cleanup_result = await self.cleanup_sync_job_if_needed()
                logger.info(f"Sync job cleanup result: {cleanup_result}")

            return {
                'status': 'completed',
                'sync_time': datetime.now().isoformat(),
                'total_sources': len(legal_sources),
                'new_sources': processed_count,
                'updated_sources': 0,  # All sources treated as new in manual sync
                'removed_sources': len(removed_sources),
                'kb_was_empty': bool(kb_is_empty),
                'forced_resync': True,  # Always true for manual sync
                'new_source_names': [s['full_name'] for s in new_sources],
                'removed_source_names': list(removed_sources)
            }

        except Exception as e:
            logger.error(f"Full sync failed: {e}")
            raise

    async def create_instance_sync_job(self, instance_name: str, sources: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Create an automated job for a specific integration instance
        """
        try:
            job_name = self._get_job_name_for_instance(instance_name)
            logger.info(
                f"Creating sync job '{job_name}' for instance '{instance_name}'...")

            if not sources:
                logger.warning(
                    f"No sources provided for instance '{instance_name}'")
                return {
                    'status': 'skipped',
                    'instance_name': instance_name,
                    'job_name': job_name,
                    'message': 'No sources provided'
                }

            # Check if job already exists - if so, skip creation
            try:
                existing_jobs = self.project.jobs.list()
                for job in existing_jobs:
                    if job.name == job_name:
                        logger.info(
                            f"Sync job '{job_name}' for instance '{instance_name}' already exists - skipping creation")
                        return {
                            'status': 'already_exists',
                            'instance_name': instance_name,
                            'job_name': job_name,
                            'message': f'Sync job for instance {instance_name} already exists',
                            'sources_count': len(sources),
                            'sources': [s['full_name'] for s in sources]
                        }
            except Exception as e:
                logger.debug(f"Error checking existing job: {e}")

            # Create job that runs every hour (60 minutes)
            queries_added = 0
            with self.project.jobs.create(
                name=job_name,
                repeat_min=60  # Run every hour
            ) as job:

                # Add query for each source in this instance
                for source in sources:
                    try:
                        # Check schema compatibility first
                        compatibility = self._check_kb_schema_compatibility(
                            source)

                        if not compatibility['compatible']:
                            logger.warning(
                                f"Schema incompatibility for {source['full_name']}: {compatibility['reason']}")
                            # Still try to process with fallback mapping

                        # Detect contract text column for PDF extraction
                        contract_text_column = self._detect_contract_text_column_for_source(
                            source)

                        if contract_text_column:
                            # Use custom query with PDF extraction and flexible schema mapping
                            insert_query = self._generate_job_insert_query_with_pdf_extraction(
                                source, contract_text_column
                            )
                            job.add_query(insert_query)
                            logger.info(
                                f"Added {source['full_name']} to job '{job_name}' with PDF extraction for column '{contract_text_column}'")
                        else:
                            # Use flexible query that maps any available content to KB
                            insert_query = self._generate_job_insert_query_with_pdf_extraction(
                                source, None  # This will use the fallback mapping
                            )
                            job.add_query(insert_query)
                            logger.info(
                                f"Added {source['full_name']} to job '{job_name}' with flexible content mapping")

                        queries_added += 1

                    except Exception as e:
                        logger.error(
                            f"Failed to add {source['full_name']} to job: {e}")
                        continue

            # Check if any queries were successfully added
            if queries_added == 0:
                logger.warning(
                    f"No queries were successfully added to job '{job_name}'")
                return {
                    'status': 'failed',
                    'instance_name': instance_name,
                    'job_name': job_name,
                    'message': 'No queries could be added to job - check data source connections',
                    'sources_attempted': len(sources)
                }

            logger.info(
                f"Sync job '{job_name}' created successfully with {queries_added} queries")

            return {
                'status': 'created',
                'instance_name': instance_name,
                'job_name': job_name,
                'schedule': 'Every hour',
                'sources_count': len(sources),
                'queries_added': queries_added,
                'sources': [s['full_name'] for s in sources]
            }

        except Exception as e:
            logger.error(
                f"Failed to create sync job for instance '{instance_name}': {e}")
            return {
                'status': 'error',
                'instance_name': instance_name,
                'error': str(e)
            }

    async def create_hourly_sync_job(self) -> Dict[str, Any]:
        """
        Create sync jobs for all integration instances
        This replaces the old single global job approach
        """
        try:
            logger.info("Creating sync jobs for all integration instances...")

            # Group datasources by instance
            instances = self._get_datasources_by_instance()

            if not instances:
                logger.info(
                    "No configured instances found, skipping job creation")
                return {
                    'status': 'skipped',
                    'message': 'No configured instances found',
                    'jobs_created': 0,
                    'jobs_failed': 0,
                    'results': []
                }

            # Create a job for each instance
            results = []
            jobs_created = 0
            jobs_failed = 0
            jobs_existing = 0

            for instance_name, sources in instances.items():
                result = await self.create_instance_sync_job(instance_name, sources)
                results.append(result)

                if result['status'] == 'created':
                    jobs_created += 1
                elif result['status'] == 'already_exists':
                    jobs_existing += 1
                elif result['status'] in ['failed', 'error']:
                    jobs_failed += 1

            logger.info(
                f"Job creation completed: {jobs_created} created, {jobs_existing} already existed, {jobs_failed} failed")

            return {
                'status': 'completed',
                'jobs_created': jobs_created,
                'jobs_existing': jobs_existing,
                'jobs_failed': jobs_failed,
                'total_instances': len(instances),
                'results': results
            }

        except Exception as e:
            logger.error(f"Failed to create instance sync jobs: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }

    async def cleanup_sync_job_if_needed(self) -> Dict[str, Any]:
        """
        Legacy method - now cleans up orphaned instance jobs
        """
        try:
            logger.info("Checking for orphaned instance sync jobs...")

            # Get configured instances
            instances = self._get_datasources_by_instance()
            configured_instance_names = set(instances.keys())

            # Get all existing instance jobs
            existing_jobs = self.project.jobs.list()
            instance_jobs = [
                job for job in existing_jobs if job.name.startswith(self.job_name_prefix)]

            # Find orphaned jobs (jobs without corresponding instances)
            orphaned_jobs = []
            for job in instance_jobs:
                # Extract instance name from job name
                instance_name = job.name.replace(self.job_name_prefix, '')
                if instance_name not in configured_instance_names:
                    orphaned_jobs.append(job)

            # Remove orphaned jobs
            removed_jobs = []
            for job in orphaned_jobs:
                try:
                    self.project.drop_job(job.name)
                    removed_jobs.append(job.name)
                    logger.info(f"✅ Removed orphaned job: {job.name}")
                except Exception as e:
                    logger.error(
                        f"Failed to remove orphaned job {job.name}: {e}")

            if removed_jobs:
                return {
                    'status': 'cleanup_completed',
                    'orphaned_jobs_removed': len(removed_jobs),
                    'removed_jobs': removed_jobs,
                    'message': f'Removed {len(removed_jobs)} orphaned jobs'
                }
            else:
                return {
                    'status': 'no_cleanup_needed',
                    'message': 'No orphaned jobs found'
                }

        except Exception as e:
            logger.error(f"Failed to cleanup orphaned jobs: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }

    async def drop_instance_sync_job(self, instance_name: str) -> Dict[str, Any]:
        """
        Drop the sync job for a specific integration instance
        """
        try:
            job_name = self._get_job_name_for_instance(instance_name)
            logger.info(
                f"Dropping sync job '{job_name}' for instance '{instance_name}'...")

            existing_jobs = self.project.jobs.list()
            job_exists = any(job.name == job_name for job in existing_jobs)

            if job_exists:
                self.project.drop_job(job_name)
                logger.info(
                    f"✅ Dropped sync job '{job_name}' for instance '{instance_name}'")

                return {
                    'status': 'dropped',
                    'instance_name': instance_name,
                    'job_name': job_name,
                    'message': f'Sync job for instance {instance_name} dropped'
                }
            else:
                logger.info(
                    f"Sync job '{job_name}' for instance '{instance_name}' does not exist")
                return {
                    'status': 'not_found',
                    'instance_name': instance_name,
                    'job_name': job_name,
                    'message': f'Sync job for instance {instance_name} does not exist'
                }

        except Exception as e:
            logger.error(
                f"Failed to drop sync job for instance '{instance_name}': {e}")
            raise

    async def mark_source_as_removed(self, datasource_name: str) -> Dict[str, Any]:
        """
        Mark data source as removed in tracking (no KB deletion)
        """
        try:
            logger.info(f"Marking datasource as removed: {datasource_name}")

            # Find matching sources in tracking
            removed_sources = []
            for source_key in list(self.processed_sources.get('processed_sources', {}).keys()):
                if datasource_name in source_key:
                    # Mark as removed in tracking (no KB deletion)
                    self.processed_sources['processed_sources'][source_key]['status'] = 'removed'
                    self.processed_sources['processed_sources'][source_key]['removed_date'] = datetime.now(
                    ).isoformat()
                    removed_sources.append(source_key)
                    logger.info(f"Marked as removed: {source_key}")

            self._save_tracking_data()

            return {
                'status': 'marked_removed',
                'removed_sources': removed_sources,
                'message': f'Marked {len(removed_sources)} sources as removed (KB data preserved)'
            }

        except Exception as e:
            logger.error(f"Failed to mark source as removed: {e}")
            raise

    def get_kb_status(self) -> Dict[str, Any]:
        """Get current status of the KB and all tracked sources"""
        try:
            current_sources = self._get_legal_contract_datasources()
            processed_sources = self.processed_sources.get(
                'processed_sources', {})

            # Categorize sources
            active_sources = []
            removed_sources = []

            for source_key, info in processed_sources.items():
                if info.get('status') == 'removed':
                    removed_sources.append({
                        'name': source_key,
                        'type': info.get('datasource_type'),
                        'removed_date': info.get('removed_date'),
                        'last_synced': info.get('last_synced'),
                        'note': 'KB data preserved'
                    })
                else:
                    active_sources.append({
                        'name': source_key,
                        'type': info.get('datasource_type'),
                        'first_processed': info.get('first_processed'),
                        'last_synced': info.get('last_synced'),
                        'status': info.get('status')
                    })

            # Check instance job status
            instance_jobs_info = []
            total_instance_jobs = 0
            try:
                existing_jobs = self.project.jobs.list()
                instances = self._get_datasources_by_instance()

                for instance_name, sources in instances.items():
                    job_name = self._get_job_name_for_instance(instance_name)
                    job_exists = any(
                        job.name == job_name for job in existing_jobs)

                    instance_jobs_info.append({
                        'instance_name': instance_name,
                        'job_name': job_name,
                        'job_exists': job_exists,
                        'source_count': len(sources),
                        'status': 'active' if job_exists else 'not_created'
                    })

                    if job_exists:
                        total_instance_jobs += 1

            except Exception as e:
                logger.warning(f"Could not check instance job status: {e}")

            return {
                'kb_name': 'legal_contracts_kb',
                'kb_status': 'active' if self.knowledge_base else 'not_initialized',
                'last_sync': self.processed_sources.get('last_sync'),
                'sync_count': self.processed_sources.get('sync_count', 0),
                'current_sources_found': len(current_sources),
                'processed_sources_count': len(processed_sources),
                'active_sources': active_sources,
                'removed_sources': removed_sources,
                'total_instances': len(instance_jobs_info),
                'total_instance_jobs': total_instance_jobs,
                'instance_jobs': instance_jobs_info,
                'job_management': 'per_instance'
            }

        except Exception as e:
            logger.error(f"Failed to get KB status: {e}")
            return {
                'error': str(e)
            }
