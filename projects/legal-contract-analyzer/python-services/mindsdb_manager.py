"""
Simplified MindsDB Manager - Using Native PDF Upload
No manual extraction needed - MindsDB handles everything!
"""

import os
import traceback
from typing import Dict, Any, List
import mindsdb_sdk
import logging
import json
from urllib.parse import urlparse
from config import METADATA_COLUMNS, CONTENT_COLUMNS, PROMPT_TEMPLATE
from insert_query_generator import create_insert_query_generator

logger = logging.getLogger(__name__)


class MindsDBManager:
    """Simplified manager for MindsDB interactions"""

    def __init__(self):
        self.server = None
        self.project = None
        self.knowledge_base = None
        self.agent = None
        self.job_scheduler = None
        self.kb_manager = None  # Will be set after initialization
        self._connect()

    async def initialize(self):
        """Initialize knowledge base, agent, and KB manager"""
        try:
            # Create email database for SMTP integration
            await self._setup_email_integration()

            if not self.knowledge_base:
                await self.create_knowledge_base()
            if not self.agent:
                await self.create_agent()

            # Initialize KB manager

            if not self.kb_manager:
                from kb_manager import KnowledgeBaseManager
                self.kb_manager = KnowledgeBaseManager(self)

                # Initialize KB with existing sources
                try:
                    await self.kb_manager.initialize_kb_with_existing_sources()
                    logger.info("KB initialization completed successfully")
                except Exception as e:
                    logger.warning(
                        f"KB initialization had issues (non-critical): {e}")

                # Create hourly sync job (non-critical)
                try:
                    job_result = await self.kb_manager.create_hourly_sync_job()
                    if job_result.get('status') == 'created':
                        logger.info("Hourly sync job created successfully")
                    else:
                        logger.warning(
                            f"Hourly sync job creation result: {job_result}")
                except Exception as e:
                    logger.warning(
                        f"Hourly sync job creation failed (non-critical): {e}")

        except Exception as e:
            logger.error(f"Initialization failed: {str(e)}")
            raise

    def _connect(self):
        """Establish connection to MindsDB"""
        try:
            host = os.getenv('MINDSDB_HOST', 'https://cloud.mindsdb.com')
            username = os.getenv('MINDSDB_USERNAME')
            password = os.getenv('MINDSDB_PASSWORD')

            # For local MindsDB (Docker), connect without credentials
            if 'localhost' in host or '127.0.0.1' in host:
                logger.info(f"Connecting to local MindsDB at {host}")
                self.server = mindsdb_sdk.connect(url=host)
            # For MindsDB Cloud, use credentials
            elif username and password:
                logger.info(f"Connecting to MindsDB Cloud with credentials")
                self.server = mindsdb_sdk.connect(
                    url=host,
                    login=username,
                    password=password
                )
            else:
                logger.info(
                    f"Connecting to MindsDB at {host} without credentials")
                self.server = mindsdb_sdk.connect(url=host)

            # Get or create project
            project_name = os.getenv('MINDSDB_PROJECT', 'mindsdb')
            try:
                self.project = self.server.get_project(project_name)
            except:
                # If project doesn't exist, create it
                self.project = self.server.create_project(project_name)
            logger.info(
                f"Successfully connected to MindsDB project: {project_name}")

            # Initialize the query generator
            self.query_generator = create_insert_query_generator(project_name)

        except Exception as e:
            logger.error(f"Failed to connect to MindsDB: {str(e)}")
            logger.error(
                f"Connection details - Host: {host}, Username: {username}")
            raise

    async def _setup_email_integration(self):
        """Setup email integration for default emailing tasks (optional)"""
        try:
            smtp_email = os.getenv('SMTP_USER')
            smtp_password = os.getenv('SMTP_PASSWORD')

            # Check if SMTP credentials are provided
            if not smtp_email or not smtp_password:
                logger.info(
                    "SMTP credentials not provided in environment variables")
                logger.info(
                    "Email integration will be disabled - set SMTP_USER and SMTP_PASSWORD to enable")
                return

            create_email_db_query = f"""
                CREATE DATABASE IF NOT EXISTS legal_contracts_ai_mailer
                WITH ENGINE = 'email',
                PARAMETERS = {{
                  "email": "{smtp_email}",
                  "password": "{smtp_password}"
                }}
            """

            logger.info(
                "Setting up email integration for default emailing tasks...")
            result = self.project.query(create_email_db_query)
            result.fetch()
            logger.info(
                "Email integration 'legal_contracts_ai_mailer' setup successfully")

        except Exception as e:
            logger.error(f"Failed to setup email integration: {str(e)}")
            # Don't raise - this is non-critical for core functionality
            logger.warning("Email integration will not be available")

    def _detect_contract_text_column(self, table_schema: Dict[str, Any]) -> str:
        """
        Detect which column likely contains contract text or PDF URLs
        Returns the column name to use for contract_text
        """
        if not table_schema or 'columns' not in table_schema:
            return None

        columns = table_schema['columns']

        # Priority order for contract text columns (updated for snake_case)
        priority_names = [
            'content', 'contract_text', 'text', 'document_text', 'pdf_content',
            'contract_content', 'full_text', 'body', 'document_content',
            'contract_url', 'pdf_url', 'document_url', 'url', 'link',
            'file_path', 'document_path', 'pdf_path'
        ]

        # Look for exact matches first
        for priority_name in priority_names:
            if priority_name in columns:
                logger.info(f"Found contract text column: {priority_name}")
                return priority_name

        # Look for partial matches
        for priority_name in priority_names:
            for column_name in columns:
                if priority_name in column_name.lower():
                    logger.info(
                        f"Found contract text column (partial match): {column_name}")
                    return column_name

        # Fallback: look for any column with 'text', 'content', or 'url' in name
        for column_name in columns:
            column_lower = column_name.lower()
            if any(keyword in column_lower for keyword in ['text', 'content', 'url', 'pdf', 'document']):
                logger.info(
                    f"Found contract text column (fallback): {column_name}")
                return column_name

        logger.warning("No contract text column detected in table schema")
        return None

    def _generate_insert_query_with_pdf_extraction(
        self,
        datasource_name: str,
        table_name: str,
        contract_text_column: str = None,
        include_metadata: bool = True,
        integration_type: str = None,
        available_columns: List[str] = None
    ) -> str:
        """
        Generate insert query using the modular query generator
        Routes to appropriate integration-specific method
        """
        if not self.query_generator:
            raise ValueError(
                "Query generator not initialized. Call _connect() first.")

        # Default to generic type if not specified
        if not integration_type:
            integration_type = "generic"

        logger.info(
            f"Generating {integration_type} insert query for {datasource_name}.{table_name}")

        return self.query_generator.generate_insert_query(
            integration_type=integration_type,
            datasource_name=datasource_name,
            table_name=table_name,
            contract_text_column=contract_text_column,
            available_columns=available_columns,
            include_metadata=include_metadata
        )

    async def create_knowledge_base(self) -> bool:
        """
        Create advanced legal contracts knowledge base with hybrid search capabilities
        Implements all MindsDB advanced features for hackathon requirements
        """
        try:
            openai_api_key = os.getenv('OPENAI_API_KEY')
            gemini_api_key = os.getenv('GEMINI_API_KEY')

            # Determine which provider to use (prefer OpenAI if both available)
            if openai_api_key:
                embedding_provider = 'openai'
                embedding_model = 'text-embedding-3-large'
                embedding_api_key = openai_api_key
                reranking_provider = 'openai'
                reranking_model = 'gpt-4o'
                reranking_api_key = openai_api_key
                logger.info("Using OpenAI for knowledge base models")
            elif gemini_api_key:
                embedding_provider = 'google'
                embedding_model = 'text-embedding-004'
                embedding_api_key = gemini_api_key
                reranking_provider = 'google'
                reranking_model = 'gemini-2.5-flash'
                reranking_api_key = gemini_api_key
                logger.info("Using Google AI for knowledge base models")
            else:
                raise ValueError(
                    "Either OPENAI_API_KEY or GEMINI_API_KEY environment variable is required")

            # Check if knowledge base already exists
            try:
                self.knowledge_base = self.project.knowledge_bases.get(
                    'legal_contracts_kb')
                logger.info(
                    "Knowledge base 'legal_contracts_kb' already exists")
                return True
            except:
                pass

            # Create advanced knowledge base with correct API parameters
            self.knowledge_base = self.project.knowledge_bases.create(
                'legal_contracts_kb',
                # Advanced embedding model for legal documents
                embedding_model={
                    'provider': embedding_provider,
                    'model_name': embedding_model,
                    'api_key': embedding_api_key
                },
                # Enhanced reranking model for legal context
                reranking_model={
                    'provider': reranking_provider,
                    'model_name': reranking_model,
                    'api_key': reranking_api_key
                },
                # Metadata columns - boolean flags and basic contract info (using actual dataset column names)
                metadata_columns=METADATA_COLUMNS,
                # Content columns - Answer fields and main content (using actual dataset column names)
                content_columns=CONTENT_COLUMNS,
                id_column='filename',
                # Advanced preprocessing for legal documents
                params={
                    "preprocessing": {
                        "text_chunking_config": {
                            # Reduced to fit within OpenAI token limits (~1500 tokens)
                            "chunk_size": 6000,
                            "chunk_overlap": 600   # Proportional overlap for context preservation
                        }
                    }
                }
            )

            logger.info(
                "Advanced knowledge base 'legal_contracts_kb' created successfully")

            return True

        except Exception as e:
            logger.error(f"Failed to create knowledge base: {str(e)}")
            raise

    async def bulk_insert_contracts_from_datasource(
        self,
        datasource_name: str,
        table_name: str,
        integration_type: str = None
    ) -> Dict[str, Any]:
        """
        Insert bulk contract data from connected data sources
        Handles PDF URL extraction using TO_MARKDOWN() when needed

        Args:
            datasource_name: Name of the connected MindsDB database
            table_name: Table containing contract data

        Returns:
            Status dict with process information
        """
        try:
            if not self.knowledge_base:
                await self.create_knowledge_base()

            logger.info(
                f"Starting bulk insert from {datasource_name}.{table_name} with integration_type: {integration_type}")

            # Get the data source table and inspect schema
            database = self.server.databases.get(datasource_name)
            table = database.tables.get(table_name)

            # Try to get table schema to detect contract text column
            contract_text_column = None
            try:
                # Try to get table schema using SHOW COLUMNS query with full table name
                full_table_name = f"{datasource_name}.{table_name}"
                describe_query = f"SHOW COLUMNS FROM {full_table_name}"
                logger.info(f"Attempting to describe table: {describe_query}")
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
                                # First actual column
                                columns.append(str(row[1]))
                        logger.info(
                            f"Extracted columns via row iteration: {columns}")

                if columns:
                    schema = {'columns': columns}
                    contract_text_column = self._detect_contract_text_column(
                        schema)
                    logger.info(
                        f"Detected columns for {datasource_name}.{table_name}: {columns}")
                else:
                    logger.warning(
                        f"Could not get schema for {datasource_name}.{table_name}")
            except Exception as e:
                logger.warning(f"Could not inspect table schema: {e}")

            # Use unified insertion method with metadata preservation
            if contract_text_column:
                logger.info(
                    f"Using unified insert with PDF extraction for column: {contract_text_column}")
            else:
                logger.info(
                    "Using unified insert with fallback content detection")

            # Generate and execute unified query with metadata
            insert_query = self._generate_insert_query_with_pdf_extraction(
                datasource_name, table_name, contract_text_column,
                include_metadata=True, integration_type=integration_type
            )

            logger.info(f"Executing unified insert query: {insert_query}")

            # Execute the custom query
            try:
                result = self.server.query(insert_query)
                result.fetch()  # Ensure execution completes
                logger.info("Query execution completed successfully")
            except Exception as query_error:
                logger.error(f"Query execution failed: {query_error}")
                logger.error(f"Failed query: {insert_query}")
                raise

            logger.info(
                f"Bulk insert completed from {datasource_name}.{table_name}")

            return {
                'status': 'completed',
                'datasource': datasource_name,
                'table': table_name,
                'pdf_extraction_used': contract_text_column is not None,
                'contract_text_column': contract_text_column,
                'integration_type': integration_type,
                'message': 'Bulk insert process completed successfully'
            }

        except Exception as e:
            logger.error(f"Bulk insert failed: {str(e)}")
            raise

    async def create_agent(self) -> bool:
        """
        Create an AI agent that leverages knowledge base and connected data sources
        Provides natural language interface to contract analysis
        """
        try:
            openai_api_key = os.getenv('OPENAI_API_KEY')
            gemini_api_key = os.getenv('GEMINI_API_KEY')

            # Determine which provider to use (prefer OpenAI if both available)
            if openai_api_key:
                model_provider = 'openai'
                model_name = 'gpt-4o'
                api_key = openai_api_key
                logger.info("Using OpenAI for agent model")
            elif gemini_api_key:
                model_provider = 'google'
                model_name = 'gemini-2.5-flash'
                api_key = gemini_api_key
                logger.info("Using Google AI for agent model")
            else:
                raise ValueError(
                    "Either OPENAI_API_KEY or GEMINI_API_KEY is required for agent")

            # Check if agent already exists
            try:
                self.agent = self.server.agents.get('legal_contracts_agent')
                logger.info("Agent 'legal_contracts_agent' already exists")
                return True
            except:
                pass

            # Ensure knowledge base exists
            if not self.knowledge_base:
                await self.create_knowledge_base()

            # Build data sources list (KB + connected tables)
            data_config = {
                'knowledge_bases': [f'{self.project.name}.legal_contracts_kb'],
                'tables': []
            }

            # Add selected tables from integration instances config (avoid wildcard db.*)
            try:
                instances_path = os.path.join(os.path.dirname(
                    __file__), 'integration_instances.json')
                if os.path.exists(instances_path):
                    with open(instances_path, 'r') as f:
                        instances = json.load(f)

                    # instances is expected as { integration_type: [ {database_name, selected_tables, ...}, ... ] }
                    for type_instances in instances.values():
                        for inst in type_instances:
                            dbname = inst.get('database_name')
                            selected = inst.get('selected_tables') or []
                            for tbl in selected:
                                data_config['tables'].append(f"{dbname}.{tbl}")
                else:
                    logger.info(
                        "No integration_instances.json found, not adding DB tables to agent")
            except Exception as e:
                logger.warning(
                    f"Could not load selected tables for agent from integration_instances.json: {e}")

            prompt_template = PROMPT_TEMPLATE

            # Create the agent
            self.agent = self.server.agents.create(
                'legal_contracts_agent',
                model={
                    'model_name': model_name,
                    'provider': model_provider,
                    'api_key': api_key
                },
                data=data_config,
                prompt_template=prompt_template,
                timeout=120  # 2 minutes for complex queries
            )

            logger.info("Legal contracts agent created successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to create agent: {str(e)}")
            raise

    async def update_agent(self) -> bool:
        """
        Update the agent to reflect changes in knowledge base or data sources
        """
        try:
            agent_name = 'legal_contracts_agent'

            # Ensure agent exists
            try:
                agent = self.server.agents.get(agent_name)
            except Exception:
                # If no agent, create it
                await self.create_agent()
                return True

            logger.info(
                "Updating legal contracts agent via server.agents.update")

            data_config = {
                'knowledge_bases': [f'{self.project.name}.legal_contracts_kb'],
                'tables': []
            }

            # Load tables from integration instances config (same as create_agent)
            try:
                instances_path = os.path.join(os.path.dirname(
                    __file__), 'integration_instances.json')
                if os.path.exists(instances_path):
                    with open(instances_path, 'r') as f:
                        instances = json.load(f)

                    # instances is expected as { integration_type: [ {database_name, selected_tables, ...}, ... ] }
                    for type_instances in instances.values():
                        for inst in type_instances:
                            dbname = inst.get('database_name')
                            selected = inst.get('selected_tables') or []
                            for tbl in selected:
                                data_config['tables'].append(f"{dbname}.{tbl}")
                else:
                    logger.info(
                        "No integration_instances.json found, not adding DB tables to agent")
            except Exception as e:
                logger.warning(
                    f"Could not load selected tables for agent from integration_instances.json: {e}")

            # Update the agent object in-place and push update
            try:
                # Modify the agent's data field
                agent.data = agent.data if hasattr(agent, 'data') else {}
                agent.data['knowledge_bases'] = data_config['knowledge_bases']
                agent.data['tables'] = data_config['tables']

                updated_agent = self.server.agents.update(agent_name, agent)
                self.agent = updated_agent
                logger.info("Agent updated successfully via update call")
                return True
            except Exception as e:
                logger.warning(
                    f"Failed to update agent via update API, falling back to recreate: {e}")
                # Last resort: recreate agent
                await self.create_agent()
                return True

        except Exception as e:
            logger.error(f"Failed to update agent: {str(e)}")
            raise

    async def update_agent_tables(self, add: list | None = None, remove: list | None = None) -> bool:
        """Add and/or remove tables from the agent's data['tables'] atomically via update API.

        Args:
            add: list of table identifiers to add (e.g. ['db.table', 'db.*'])
            remove: list of table identifiers to remove
        Returns:
            True on success, False on failure
        """
        agent_name = 'legal_contracts_agent'
        try:
            try:
                agent = self.server.agents.get(agent_name)
            except Exception:
                # create agent if missing
                await self.create_agent()
                agent = self.server.agents.get(agent_name)

            if not hasattr(agent, 'data') or agent.data is None:
                agent.data = {'knowledge_bases': [
                    f'{self.project.name}.legal_contracts_kb'], 'tables': []}

            tables = list(agent.data.get('tables', []) or [])

            # Remove first to avoid re-adding removed entries
            if remove:
                for r in remove:
                    tables = [t for t in tables if t != r]

            # Add new entries if missing
            if add:
                for a in add:
                    if a not in tables:
                        tables.append(a)

            agent.data['tables'] = tables

            updated_agent = self.server.agents.update(agent_name, agent)
            self.agent = updated_agent
            logger.info(
                f"Agent tables updated via update API (add={add}, remove={remove})")
            return True
        except Exception as e:
            logger.error(f"Failed to update agent tables: {e}")
            return False

    async def query_agent(
        self,
        conversation_context: list = None,
        stream: bool = False
    ) -> Dict[str, Any]:
        """
        Query the AI agent with conversation context

        Args:
            conversation_context: List of conversation messages with format:
                [{'question': 'user message', 'answer': None}, ...]
            stream: Whether to stream the response

        Returns:
            Agent response with answer and metadata
        """
        try:
            if not self.agent:
                await self.create_agent()

            if not conversation_context:
                raise ValueError("Conversation context is required")

            logger.info(
                f"Querying agent with {len(conversation_context)} context messages")

            if stream:
                # Streaming response for real-time feedback
                response_chunks = []

                completion = self.agent.completion_stream(conversation_context)

                for chunk in completion:
                    if chunk:
                        chunk_str = str(chunk)
                        logger.info(f"Agent stream chunk: {chunk_str}")
                        response_chunks.append(chunk_str)

                final_answer = ''.join(response_chunks).strip()
                if not final_answer:
                    final_answer = "I processed your request."

                return {
                    'conversation_context': conversation_context,
                    'answer': final_answer,
                    'streaming': True,
                    'chunk_count': len(response_chunks)
                }
            else:
                # Standard response
                completion = self.agent.completion(conversation_context)

                # Get response content
                response_content = completion.content if hasattr(
                    completion, 'content') else str(completion)

                return {
                    'conversation_context': conversation_context,
                    'answer': response_content,
                    'streaming': False
                }

        except Exception as e:
            logger.error(f"Agent query failed: {str(e)}")
            raise

    async def upload_pdf_file(self, file_path: str, table_name: str) -> Dict[str, Any]:
        """
        Upload a PDF file to MindsDB and insert into knowledge base

        Args:
            file_path: Path to the PDF file
            table_name: Name for the MindsDB table

        Returns:
            Dict with upload status and information
        """
        try:
            if not self.server:
                raise Exception("MindsDB not connected")

            logger.info(
                f"📄 Uploading PDF file {file_path} to MindsDB as table {table_name}")

            # Check if file exists
            if not os.path.exists(file_path):
                raise Exception(f"File not found: {file_path}")

            # Get files database
            files_db = self.server.get_database('files')
            logger.info(f"📊 Connected to files database")

            # Parse PDF and create single-row DataFrame
            logger.info(f"📖 Parsing PDF content and creating chunks...")
            import PyPDF2
            import pandas as pd

            all_content = ""
            total_pages = 0

            if file_path.lower().endswith('.pdf'):
                # Parse PDF file and merge all pages
                with open(file_path, 'rb') as f:
                    pdf_reader = PyPDF2.PdfReader(f)
                    total_pages = len(pdf_reader.pages)

                    page_contents = []
                    for page_num, page in enumerate(pdf_reader.pages):
                        page_text = page.extract_text()
                        if page_text.strip():
                            page_contents.append(
                                f"--- Page {page_num + 1} ---\n{page_text.strip()}")

                    all_content = "\n\n".join(page_contents)
            else:
                # Handle text files
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    all_content = f.read()
                    total_pages = 1

            if not all_content.strip():
                raise Exception("No content could be extracted from the file")

            # Split content into chunks to fit OpenAI token limits
            def chunk_text(text, max_tokens=1500):  # Conservative limit well under 8192
                """Split text into chunks based on approximate token count"""
                # Rough estimate: 4 characters per token
                max_chars = max_tokens * 4
                chunks = []

                if len(text) <= max_chars:
                    return [text]

                # Split by paragraphs first, then by sentences if needed
                paragraphs = text.split('\n\n')
                current_chunk = ""

                for paragraph in paragraphs:
                    if len(current_chunk + paragraph) <= max_chars:
                        current_chunk += paragraph + '\n\n'
                    else:
                        if current_chunk:
                            chunks.append(current_chunk.strip())

                        # If single paragraph is too long, split by sentences
                        if len(paragraph) > max_chars:
                            sentences = paragraph.split('. ')
                            temp_chunk = ""
                            for sentence in sentences:
                                if len(temp_chunk + sentence) <= max_chars:
                                    temp_chunk += sentence + '. '
                                else:
                                    if temp_chunk:
                                        chunks.append(temp_chunk.strip())
                                    temp_chunk = sentence + '. '
                            if temp_chunk:
                                chunks.append(temp_chunk.strip())
                        else:
                            current_chunk = paragraph + '\n\n'

                if current_chunk:
                    chunks.append(current_chunk.strip())

                return chunks

            # Create chunked DataFrame with consistent contract ID
            content_chunks = chunk_text(all_content)
            pdf_data = []

            # Use filename (without extension) as consistent contract ID
            base_filename = os.path.splitext(os.path.basename(file_path))[0]

            for i, chunk in enumerate(content_chunks):
                pdf_data.append({
                    'content': chunk,
                    'filename': base_filename,  # Same ID for all chunks
                    'file_name': os.path.basename(file_path),
                    'document_name': base_filename,
                    'total_pages': total_pages,
                    'chunk_number': i + 1,
                    'total_chunks': len(content_chunks),
                    'file_path': file_path,
                    'document_type': 'uploaded_contract',
                    'created_at': pd.Timestamp.now().isoformat(),
                    'updated_at': pd.Timestamp.now().isoformat()
                })

            df = pd.DataFrame(pdf_data)
            logger.info(f"📊 Created DataFrame with {len(pdf_data)} chunks")

            # Upload to MindsDB
            logger.info(f"⬆️ Uploading to MindsDB files database...")
            files_db.create_table(table_name, df, replace=True)
            logger.info(
                f"✅ Successfully uploaded {file_path} to MindsDB table {table_name}")

            # Insert into knowledge base immediately
            logger.info(f"🧠 Adding to knowledge base for AI analysis...")
            await self.insert_file_table_into_kb(table_name)

            return {
                "status": "success",
                "table_name": table_name,
                "message": f"PDF uploaded and added to knowledge base as table '{table_name}'"
            }

        except Exception as e:
            logger.error(f"Error uploading PDF file: {str(e)}")
            logger.error(f"File path: {file_path}")
            logger.error(f"Table name: {table_name}")
            import traceback
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise Exception(f"Failed to upload PDF file: {str(e)}")

    async def insert_file_table_into_kb(self, table_name: str) -> Dict[str, Any]:
        """
        Insert data from an uploaded file table into the knowledge base

        Args:
            table_name: Name of the file table in MindsDB

        Returns:
            Dict with insertion status
        """
        try:
            if not self.knowledge_base:
                raise Exception("Knowledge base not available")

            # Get the files database and table
            files_db = self.server.get_database('files')
            file_table = files_db.get_table(table_name)

            logger.info(
                f"🧠 Inserting data from file table {table_name} into knowledge base using insert_query method")

            # Use the knowledge base's insert_query method (recommended by MindsDB docs)
            # This handles embeddings and chunking automatically
            self.knowledge_base.insert_query(file_table)
            logger.info(f"✅ Successfully embedded content into knowledge base")

            # Update agent to include the new file table
            logger.info(f"🤖 Updating AI agent with new data source...")
            await self.update_agent_tables(add=[f"files.{table_name}"])

            logger.info(
                f"🎉 Successfully inserted data from file table {table_name} into knowledge base")

            return {
                "status": "success",
                "message": f"Data from file table {table_name} inserted into knowledge base and agent updated"
            }

        except Exception as e:
            logger.error(f"Error inserting file table into KB: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise Exception(
                f"Failed to insert file table into knowledge base: {str(e)}")

        """
        List all uploaded file tables in the files database

        Returns:
            List of file table information
        """
        try:
            if not self.server:
                raise Exception("MindsDB not connected")

            # Get files database
            files_db = self.server.get_database('files')

            # List all tables in files database
            tables = files_db.list_tables()

            file_tables = []
            for table in tables:
                try:
                    # Get table info
                    table_info = {
                        "table_name": table.name,
                        "status": "uploaded",
                        "message": f"File table {table.name} available"
                    }
                    file_tables.append(table_info)
                except Exception as e:
                    logger.warning(
                        f"Could not get info for table {table.name}: {str(e)}")

            return file_tables

        except Exception as e:
            logger.error(f"Error listing uploaded files: {str(e)}")
            return []
