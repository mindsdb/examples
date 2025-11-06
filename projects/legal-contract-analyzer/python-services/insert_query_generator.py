"""
Modular Insert Query Generator for Legal Contract Knowledge Base
Generates schema-aware insert queries for different integration types
"""

import logging
from typing import Dict, Any, Optional, List
from config import IntegrationType

logger = logging.getLogger(__name__)


class InsertQueryGenerator:
    """
    Schema-aware insert query generator for different integration types.
    Each integration type has its own method to handle specific fields and schema.
    """

    def __init__(self, project_name: str, kb_name: str = "legal_contracts_kb"):
        self.project_name = project_name
        self.kb_name = kb_name

    def generate_insert_query(
        self,
        integration_type: str,
        datasource_name: str,
        table_name: str,
        contract_text_column: Optional[str] = None,
        available_columns: Optional[List[str]] = None,
        include_metadata: bool = True
    ) -> str:
        """
        Generate insert query based on integration type.

        Args:
            integration_type: Type of integration (email, postgres, pdf, etc.)
            datasource_name: Name of the data source
            table_name: Name of the table
            contract_text_column: Column containing contract text/PDF URLs
            available_columns: List of available columns in the source table
            include_metadata: Whether to include metadata in the insert

        Returns:
            SQL insert query string
        """
        # Normalize integration type
        integration_type = integration_type.lower()

        # Route to appropriate generator method
        if integration_type in [IntegrationType.EMAIL, "email"]:
            return self._generate_email_insert_query(
                datasource_name, table_name, contract_text_column,
                available_columns, include_metadata
            )
        elif integration_type in [IntegrationType.POSTGRESQL, "postgres", "postgresql"]:
            return self._generate_postgres_insert_query(
                datasource_name, table_name, contract_text_column,
                available_columns, include_metadata
            )
        elif integration_type in ["pdf", "file", "upload"]:
            return self._generate_pdf_insert_query(
                datasource_name, table_name, contract_text_column,
                available_columns, include_metadata
            )
        elif integration_type in [IntegrationType.SHAREPOINT, "sharepoint"]:
            return self._generate_sharepoint_insert_query(
                datasource_name, table_name, contract_text_column,
                available_columns, include_metadata
            )
        elif integration_type in [IntegrationType.DROPBOX, "dropbox"]:
            return self._generate_dropbox_insert_query(
                datasource_name, table_name, contract_text_column,
                available_columns, include_metadata
            )
        elif integration_type in [IntegrationType.SALESFORCE, "salesforce"]:
            return self._generate_salesforce_insert_query(
                datasource_name, table_name, contract_text_column,
                available_columns, include_metadata
            )
        elif integration_type in [IntegrationType.ELASTICSEARCH, "elasticsearch"]:
            return self._generate_elasticsearch_insert_query(
                datasource_name, table_name, contract_text_column,
                available_columns, include_metadata
            )
        elif integration_type in [IntegrationType.NOTION, "notion"]:
            return self._generate_notion_insert_query(
                datasource_name, table_name, contract_text_column,
                available_columns, include_metadata
            )
        elif integration_type in [IntegrationType.GITHUB, "github"]:
            return self._generate_github_insert_query(
                datasource_name, table_name, contract_text_column,
                available_columns, include_metadata
            )
        elif integration_type in [IntegrationType.SNOWFLAKE, "snowflake"]:
            return self._generate_snowflake_insert_query(
                datasource_name, table_name, contract_text_column,
                available_columns, include_metadata
            )
        else:
            # Fallback to generic method for unknown types
            logger.warning(
                f"Unknown integration type: {integration_type}. Using generic query generator.")
            return self._generate_generic_insert_query(
                datasource_name, table_name, contract_text_column,
                available_columns, include_metadata
            )

    def _generate_email_insert_query(
        self,
        datasource_name: str,
        table_name: str,
        contract_text_column: Optional[str],
        available_columns: Optional[List[str]],
        include_metadata: bool
    ) -> str:
        """Generate insert query for email integrations (has to_field, from_field, datetime, subject)"""

        if not contract_text_column:
            # For emails, try common email content fields
            content_field = self._find_best_content_field(available_columns, [
                'body', 'content', 'text', 'message', 'html_body', 'plain_text', 'subject'
            ])
        else:
            content_field = contract_text_column

        if include_metadata:
            # Email-specific metadata with email fields
            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content, metadata)
                SELECT 
                    {self._generate_content_extraction_clause(content_field)} AS content,
                    JSON_OBJECT(
                        'source_table', '{datasource_name}.{table_name}',
                        'content_column', '{content_field or "body"}',
                        'to_field', {self._safe_coalesce('to_field', available_columns)},
                        'from_field', {self._safe_coalesce('from_field', available_columns)},
                        'datetime', {self._safe_coalesce('datetime', available_columns)},
                        'subject', {self._safe_coalesce('subject', available_columns)},
                        'message_id', {self._safe_coalesce('message_id', available_columns)},
                        'data_type', 'email'
                    ) as metadata
                FROM {datasource_name}.{table_name}
            """.strip()
        else:
            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content)
                SELECT {self._generate_content_extraction_clause(content_field)} AS content
                FROM {datasource_name}.{table_name}
            """.strip()

    def _generate_postgres_insert_query(
        self,
        datasource_name: str,
        table_name: str,
        contract_text_column: Optional[str],
        available_columns: Optional[List[str]],
        include_metadata: bool
    ) -> str:
        """Generate insert query for PostgreSQL integrations (flexible schema)"""

        if not contract_text_column:
            content_field = self._find_best_content_field(available_columns, [
                'content', 'contract_text', 'text', 'document_text', 'description'
            ])
        else:
            content_field = contract_text_column

        if include_metadata:
            # PostgreSQL-specific metadata (no assumption about email fields)
            metadata_fields = {
                'source_table': f"'{datasource_name}.{table_name}'",
                'content_column': f"'{content_field or 'content'}'",
                'data_type': "'postgres'"
            }

            # Add common business fields if they exist
            common_fields = ['id', 'name', 'title',
                             'created_at', 'updated_at', 'status', 'category']
            for field in common_fields:
                if available_columns and field in available_columns:
                    metadata_fields[field] = self._safe_coalesce(
                        field, available_columns)

            metadata_clause = self._build_json_object_clause(metadata_fields)

            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content, metadata)
                SELECT 
                    {self._generate_content_extraction_clause(content_field)} AS content,
                    {metadata_clause} as metadata
                FROM {datasource_name}.{table_name}
            """.strip()
        else:
            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content)
                SELECT {self._generate_content_extraction_clause(content_field)} AS content
                FROM {datasource_name}.{table_name}
            """.strip()

    def _generate_pdf_insert_query(
        self,
        datasource_name: str,
        table_name: str,
        contract_text_column: Optional[str],
        available_columns: Optional[List[str]],
        include_metadata: bool
    ) -> str:
        """Generate insert query for PDF/file uploads"""

        if not contract_text_column:
            content_field = self._find_best_content_field(available_columns, [
                'content', 'text', 'markdown_content', 'extracted_text'
            ])
        else:
            content_field = contract_text_column

        if include_metadata:
            metadata_fields = {
                'source_table': f"'{datasource_name}.{table_name}'",
                'content_column': f"'{content_field or 'content'}'",
                'filename': self._safe_coalesce('filename', available_columns),
                'file_size': self._safe_coalesce('file_size', available_columns),
                'file_type': self._safe_coalesce('file_type', available_columns),
                'upload_date': self._safe_coalesce('upload_date', available_columns),
                'data_type': "'pdf'"
            }

            metadata_clause = self._build_json_object_clause(metadata_fields)

            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content, metadata)
                SELECT 
                    {self._generate_content_extraction_clause(content_field)} AS content,
                    {metadata_clause} as metadata
                FROM {datasource_name}.{table_name}
            """.strip()
        else:
            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content)
                SELECT {self._generate_content_extraction_clause(content_field)} AS content
                FROM {datasource_name}.{table_name}
            """.strip()

    def _generate_sharepoint_insert_query(
        self,
        datasource_name: str,
        table_name: str,
        contract_text_column: Optional[str],
        available_columns: Optional[List[str]],
        include_metadata: bool
    ) -> str:
        """Generate insert query for SharePoint integrations"""

        if not contract_text_column:
            content_field = self._find_best_content_field(available_columns, [
                'content', 'body', 'description', 'text', 'file_content'
            ])
        else:
            content_field = contract_text_column

        if include_metadata:
            metadata_fields = {
                'source_table': f"'{datasource_name}.{table_name}'",
                'content_column': f"'{content_field or 'content'}'",
                'title': self._safe_coalesce('title', available_columns),
                'author': self._safe_coalesce('author', available_columns),
                'created': self._safe_coalesce('created', available_columns),
                'modified': self._safe_coalesce('modified', available_columns),
                'file_path': self._safe_coalesce('file_path', available_columns),
                'site_url': self._safe_coalesce('site_url', available_columns),
                'data_type': "'sharepoint'"
            }

            metadata_clause = self._build_json_object_clause(metadata_fields)

            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content, metadata)
                SELECT 
                    {self._generate_content_extraction_clause(content_field)} AS content,
                    {metadata_clause} as metadata
                FROM {datasource_name}.{table_name}
            """.strip()
        else:
            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content)
                SELECT {self._generate_content_extraction_clause(content_field)} AS content
                FROM {datasource_name}.{table_name}
            """.strip()

    def _generate_dropbox_insert_query(
        self,
        datasource_name: str,
        table_name: str,
        contract_text_column: Optional[str],
        available_columns: Optional[List[str]],
        include_metadata: bool
    ) -> str:
        """Generate insert query for Dropbox integrations"""

        if not contract_text_column:
            content_field = self._find_best_content_field(available_columns, [
                'content', 'text', 'file_content', 'body'
            ])
        else:
            content_field = contract_text_column

        if include_metadata:
            metadata_fields = {
                'source_table': f"'{datasource_name}.{table_name}'",
                'content_column': f"'{content_field or 'content'}'",
                'name': self._safe_coalesce('name', available_columns),
                'path_lower': self._safe_coalesce('path_lower', available_columns),
                'size': self._safe_coalesce('size', available_columns),
                'client_modified': self._safe_coalesce('client_modified', available_columns),
                'server_modified': self._safe_coalesce('server_modified', available_columns),
                'data_type': "'dropbox'"
            }

            metadata_clause = self._build_json_object_clause(metadata_fields)

            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content, metadata)
                SELECT 
                    {self._generate_content_extraction_clause(content_field)} AS content,
                    {metadata_clause} as metadata
                FROM {datasource_name}.{table_name}
            """.strip()
        else:
            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content)
                SELECT {self._generate_content_extraction_clause(content_field)} AS content
                FROM {datasource_name}.{table_name}
            """.strip()

    def _generate_salesforce_insert_query(
        self,
        datasource_name: str,
        table_name: str,
        contract_text_column: Optional[str],
        available_columns: Optional[List[str]],
        include_metadata: bool
    ) -> str:
        """Generate insert query for Salesforce integrations"""

        if not contract_text_column:
            content_field = self._find_best_content_field(available_columns, [
                'description', 'body', 'content', 'notes', 'details'
            ])
        else:
            content_field = contract_text_column

        if include_metadata:
            metadata_fields = {
                'source_table': f"'{datasource_name}.{table_name}'",
                'content_column': f"'{content_field or 'description'}'",
                'id': self._safe_coalesce('id', available_columns),
                'name': self._safe_coalesce('name', available_columns),
                'account_id': self._safe_coalesce('account_id', available_columns),
                'owner_id': self._safe_coalesce('owner_id', available_columns),
                'created_date': self._safe_coalesce('created_date', available_columns),
                'last_modified_date': self._safe_coalesce('last_modified_date', available_columns),
                'stage': self._safe_coalesce('stage', available_columns),
                'data_type': "'salesforce'"
            }

            metadata_clause = self._build_json_object_clause(metadata_fields)

            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content, metadata)
                SELECT 
                    {self._generate_content_extraction_clause(content_field)} AS content,
                    {metadata_clause} as metadata
                FROM {datasource_name}.{table_name}
            """.strip()
        else:
            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content)
                SELECT {self._generate_content_extraction_clause(content_field)} AS content
                FROM {datasource_name}.{table_name}
            """.strip()

    def _generate_elasticsearch_insert_query(
        self,
        datasource_name: str,
        table_name: str,
        contract_text_column: Optional[str],
        available_columns: Optional[List[str]],
        include_metadata: bool
    ) -> str:
        """Generate insert query for Elasticsearch integrations"""

        if not contract_text_column:
            content_field = self._find_best_content_field(available_columns, [
                '_source', 'content', 'text', 'body', 'description'
            ])
        else:
            content_field = contract_text_column

        if include_metadata:
            metadata_fields = {
                'source_table': f"'{datasource_name}.{table_name}'",
                'content_column': f"'{content_field or '_source'}'",
                '_id': self._safe_coalesce('_id', available_columns),
                '_index': self._safe_coalesce('_index', available_columns),
                '_type': self._safe_coalesce('_type', available_columns),
                '_score': self._safe_coalesce('_score', available_columns),
                'timestamp': self._safe_coalesce('timestamp', available_columns),
                'data_type': "'elasticsearch'"
            }

            metadata_clause = self._build_json_object_clause(metadata_fields)

            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content, metadata)
                SELECT 
                    {self._generate_content_extraction_clause(content_field)} AS content,
                    {metadata_clause} as metadata
                FROM {datasource_name}.{table_name}
            """.strip()
        else:
            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content)
                SELECT {self._generate_content_extraction_clause(content_field)} AS content
                FROM {datasource_name}.{table_name}
            """.strip()

    def _generate_notion_insert_query(
        self,
        datasource_name: str,
        table_name: str,
        contract_text_column: Optional[str],
        available_columns: Optional[List[str]],
        include_metadata: bool
    ) -> str:
        """Generate insert query for Notion integrations"""

        if not contract_text_column:
            content_field = self._find_best_content_field(available_columns, [
                'content', 'rich_text', 'plain_text', 'title', 'text'
            ])
        else:
            content_field = contract_text_column

        if include_metadata:
            metadata_fields = {
                'source_table': f"'{datasource_name}.{table_name}'",
                'content_column': f"'{content_field or 'content'}'",
                'id': self._safe_coalesce('id', available_columns),
                'title': self._safe_coalesce('title', available_columns),
                'created_time': self._safe_coalesce('created_time', available_columns),
                'last_edited_time': self._safe_coalesce('last_edited_time', available_columns),
                'created_by': self._safe_coalesce('created_by', available_columns),
                'last_edited_by': self._safe_coalesce('last_edited_by', available_columns),
                'data_type': "'notion'"
            }

            metadata_clause = self._build_json_object_clause(metadata_fields)

            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content, metadata)
                SELECT 
                    {self._generate_content_extraction_clause(content_field)} AS content,
                    {metadata_clause} as metadata
                FROM {datasource_name}.{table_name}
            """.strip()
        else:
            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content)
                SELECT {self._generate_content_extraction_clause(content_field)} AS content
                FROM {datasource_name}.{table_name}
            """.strip()

    def _generate_github_insert_query(
        self,
        datasource_name: str,
        table_name: str,
        contract_text_column: Optional[str],
        available_columns: Optional[List[str]],
        include_metadata: bool
    ) -> str:
        """Generate insert query for GitHub integrations"""

        if not contract_text_column:
            content_field = self._find_best_content_field(available_columns, [
                'content', 'body', 'description', 'readme', 'text'
            ])
        else:
            content_field = contract_text_column

        if include_metadata:
            metadata_fields = {
                'source_table': f"'{datasource_name}.{table_name}'",
                'content_column': f"'{content_field or 'content'}'",
                'name': self._safe_coalesce('name', available_columns),
                'path': self._safe_coalesce('path', available_columns),
                'sha': self._safe_coalesce('sha', available_columns),
                'size': self._safe_coalesce('size', available_columns),
                'url': self._safe_coalesce('url', available_columns),
                'html_url': self._safe_coalesce('html_url', available_columns),
                'data_type': "'github'"
            }

            metadata_clause = self._build_json_object_clause(metadata_fields)

            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content, metadata)
                SELECT 
                    {self._generate_content_extraction_clause(content_field)} AS content,
                    {metadata_clause} as metadata
                FROM {datasource_name}.{table_name}
            """.strip()
        else:
            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content)
                SELECT {self._generate_content_extraction_clause(content_field)} AS content
                FROM {datasource_name}.{table_name}
            """.strip()

    def _generate_snowflake_insert_query(
        self,
        datasource_name: str,
        table_name: str,
        contract_text_column: Optional[str],
        available_columns: Optional[List[str]],
        include_metadata: bool
    ) -> str:
        """Generate insert query for Snowflake integrations"""

        if not contract_text_column:
            content_field = self._find_best_content_field(available_columns, [
                'content', 'text', 'description', 'contract_text', 'document_text'
            ])
        else:
            content_field = contract_text_column

        if include_metadata:
            # Snowflake typically has business-oriented fields
            metadata_fields = {
                'source_table': f"'{datasource_name}.{table_name}'",
                'content_column': f"'{content_field or 'content'}'",
                'id': self._safe_coalesce('id', available_columns),
                'name': self._safe_coalesce('name', available_columns),
                'created_at': self._safe_coalesce('created_at', available_columns),
                'updated_at': self._safe_coalesce('updated_at', available_columns),
                'status': self._safe_coalesce('status', available_columns),
                'category': self._safe_coalesce('category', available_columns),
                'data_type': "'snowflake'"
            }

            metadata_clause = self._build_json_object_clause(metadata_fields)

            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content, metadata)
                SELECT 
                    {self._generate_content_extraction_clause(content_field)} AS content,
                    {metadata_clause} as metadata
                FROM {datasource_name}.{table_name}
            """.strip()
        else:
            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content)
                SELECT {self._generate_content_extraction_clause(content_field)} AS content
                FROM {datasource_name}.{table_name}
            """.strip()

    def _generate_generic_insert_query(
        self,
        datasource_name: str,
        table_name: str,
        contract_text_column: Optional[str],
        available_columns: Optional[List[str]],
        include_metadata: bool
    ) -> str:
        """Generate generic insert query for unknown integration types"""

        if not contract_text_column:
            content_field = self._find_best_content_field(available_columns, [
                'content', 'text', 'body', 'description', 'document_text'
            ])
        else:
            content_field = contract_text_column

        if include_metadata:
            # Basic metadata without assuming specific fields
            metadata_fields = {
                'source_table': f"'{datasource_name}.{table_name}'",
                'content_column': f"'{content_field or 'content'}'",
                'data_type': "'generic'"
            }

            # Add id field if available
            if available_columns and 'id' in available_columns:
                metadata_fields['id'] = self._safe_coalesce(
                    'id', available_columns)

            metadata_clause = self._build_json_object_clause(metadata_fields)

            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content, metadata)
                SELECT 
                    {self._generate_content_extraction_clause(content_field)} AS content,
                    {metadata_clause} as metadata
                FROM {datasource_name}.{table_name}
            """.strip()
        else:
            return f"""
                INSERT INTO {self.project_name}.{self.kb_name} (content)
                SELECT {self._generate_content_extraction_clause(content_field)} AS content
                FROM {datasource_name}.{table_name}
            """.strip()

    def _find_best_content_field(
        self,
        available_columns: Optional[List[str]],
        priority_fields: List[str]
    ) -> str:
        """Find the best content field from available columns"""
        if not available_columns:
            return priority_fields[0] if priority_fields else 'content'

        # Look for exact matches first
        for field in priority_fields:
            if field in available_columns:
                return field

        # Look for partial matches
        for field in priority_fields:
            for col in available_columns:
                if field.lower() in col.lower():
                    return col

        # Fallback to first priority field
        return priority_fields[0] if priority_fields else 'content'

    def _safe_coalesce(self, field_name: str, available_columns: Optional[List[str]]) -> str:
        """Generate COALESCE clause only if field exists in table"""
        if available_columns and field_name in available_columns:
            return f"COALESCE({field_name}, '')"
        else:
            return "''"

    def _build_json_object_clause(self, metadata_fields: Dict[str, str]) -> str:
        """Build JSON_OBJECT clause from metadata fields dictionary"""
        json_pairs = []
        for key, value in metadata_fields.items():
            json_pairs.append(f"'{key}', {value}")

        return f"JSON_OBJECT({', '.join(json_pairs)})"

    def _generate_content_extraction_clause(self, content_field: str) -> str:
        """Generate content extraction clause with PDF URL handling"""
        if not content_field:
            return "'No content available'"

        return f"""
            CASE 
                WHEN {content_field} LIKE 'http%' AND 
                     ({content_field} LIKE '%.pdf' OR 
                      LOWER({content_field}) LIKE '%pdf%')
                THEN TO_MARKDOWN({content_field})
                ELSE {content_field}
            END
        """.strip()


# Factory function for easy usage
def create_insert_query_generator(project_name: str, kb_name: str = "legal_contracts_kb") -> InsertQueryGenerator:
    """Factory function to create an InsertQueryGenerator instance"""
    return InsertQueryGenerator(project_name, kb_name)
