"""
INSA Integration Connector Interface (FR-R1, Deliverable 8 & 9)
Clearly marked integration point for the Information Network Security Administration (INSA)
national cyber incident and fraud monitoring gateway.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime

from app.logging_config import logger


class INSAConnectorInterface(ABC):
    """
    Interface for dispatching verified incident and fraud notifications to INSA.
    In this prototype build, events are stored locally without external forwarding.
    """

    @abstractmethod
    def forward_fraud_report(
        self,
        reference: str,
        document_id: str,
        reason_code: str,
        description: str,
        created_at: datetime
    ) -> bool:
        """Forwards an accepted fraud report to the INSA National Incident Response Portal."""
        pass

    @abstractmethod
    def forward_tamper_alert(
        self,
        device_id: str,
        document_id: str,
        verified_at: datetime
    ) -> bool:
        """Forwards a cryptographic tampering alert to INSA threat monitoring center."""
        pass


class LocalStubINSAConnector(INSAConnectorInterface):
    """
    Prototype implementation: Logs dispatch intentions without making external network calls.
    To connect to production INSA APIs:
    1. Implement mTLS (Mutual TLS 1.3) client authentication with INSA Root CA.
    2. Sign the notification payload with government institutional private key.
    3. Post to https://gateway.insa.gov.et/v1/incidents
    """

    def forward_fraud_report(
        self,
        reference: str,
        document_id: str,
        reason_code: str,
        description: str,
        created_at: datetime
    ) -> bool:
        logger.info(
            f"[INSA_CONNECTOR_STUB] Fraud report recorded: ref={reference}, "
            f"doc={document_id}, reason={reason_code} (Forwarding disabled in prototype build)"
        )
        return True

    def forward_tamper_alert(
        self,
        device_id: str,
        document_id: str,
        verified_at: datetime
    ) -> bool:
        logger.warning(
            f"[INSA_CONNECTOR_STUB] Tampering alert logged: device={device_id}, "
            f"doc={document_id} (Forwarding disabled in prototype build)"
        )
        return True


_insa_connector: INSAConnectorInterface = LocalStubINSAConnector()


def get_insa_connector() -> INSAConnectorInterface:
    """Returns the active INSA connector service instance."""
    return _insa_connector
