"""
Certification Detector Service
Uses knowledge base to identify certifications and standards on websites
"""
import json
import re
from pathlib import Path
from typing import Dict, List
from difflib import SequenceMatcher


class CertificationDetector:
    """
    Detects certifications and standards using knowledge base
    """

    def __init__(self):
        self.knowledge_base = self._load_knowledge_base()
        self.certifications = self.knowledge_base.get('certifications', [])

        # Build quick lookup indices
        self._build_indices()

    def _load_knowledge_base(self) -> Dict:
        """Load certifications knowledge base from JSON"""
        kb_path = Path(__file__).parent.parent / 'knowledge_base' / 'certifications_standards.json'

        try:
            with open(kb_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARNING] Could not load certification knowledge base: {e}")
            return {'certifications': []}

    def _build_indices(self):
        """Build lookup indices for fast searching"""
        self.variation_to_cert = {}
        self.keyword_to_cert = {}

        for cert in self.certifications:
            cert_id = cert['id']

            # Index all variations
            for variation in cert.get('variations', []):
                variation_lower = variation.lower()
                if variation_lower not in self.variation_to_cert:
                    self.variation_to_cert[variation_lower] = []
                self.variation_to_cert[variation_lower].append(cert)

            # Index keywords
            for keyword in cert.get('keywords', []):
                keyword_lower = keyword.lower()
                if keyword_lower not in self.keyword_to_cert:
                    self.keyword_to_cert[keyword_lower] = []
                self.keyword_to_cert[keyword_lower].append(cert)

    def detect_from_text(self, text: str, context: str = None) -> List[Dict]:
        """
        Detect certifications from text content

        Args:
            text: Text to analyze
            context: Optional context (e.g., 'about_page', 'footer', 'certifications_page')

        Returns:
            List of detected certifications with confidence scores
        """
        if not text:
            return []

        text_lower = text.lower()
        detected = {}

        # Method 1: Exact variation matching
        for variation, certs in self.variation_to_cert.items():
            # Use word boundary regex for better matching
            pattern = r'\b' + re.escape(variation) + r'\b'
            if re.search(pattern, text_lower):
                for cert in certs:
                    cert_id = cert['id']
                    if cert_id not in detected:
                        detected[cert_id] = {
                            'certification': cert,
                            'confidence': 0.95,  # High confidence for exact match
                            'matched_text': variation,
                            'detection_method': 'exact_variation',
                            'context': context
                        }

        # Method 2: Fuzzy matching for near-misses
        words = re.findall(r'\b\w+(?:\s+\w+){0,3}\b', text_lower)
        for word_phrase in words:
            for variation, certs in self.variation_to_cert.items():
                # Skip if already detected
                if any(cert['id'] in detected for cert in certs):
                    continue

                similarity = SequenceMatcher(None, word_phrase, variation).ratio()
                if similarity >= 0.85:  # 85% similarity threshold
                    for cert in certs:
                        cert_id = cert['id']
                        if cert_id not in detected:
                            detected[cert_id] = {
                                'certification': cert,
                                'confidence': similarity * 0.9,  # Slightly lower confidence
                                'matched_text': word_phrase,
                                'detection_method': 'fuzzy_match',
                                'context': context
                            }

        # Method 3: Keyword-based detection (lower confidence)
        for keyword, certs in self.keyword_to_cert.items():
            pattern = r'\b' + re.escape(keyword) + r'\b'
            if re.search(pattern, text_lower):
                for cert in certs:
                    cert_id = cert['id']
                    # Only add if not already detected
                    if cert_id not in detected:
                        detected[cert_id] = {
                            'certification': cert,
                            'confidence': 0.6,  # Lower confidence for keyword match
                            'matched_text': keyword,
                            'detection_method': 'keyword',
                            'context': context
                        }

        return list(detected.values())

    def detect_from_website_data(self, website_data: Dict) -> List[Dict]:
        """
        Detect certifications from complete website analysis data

        Args:
            website_data: Website data from playwright_analyzer

        Returns:
            Comprehensive certification detection results
        """
        all_detections = []

        # Check about section
        about = website_data.get('about', {})
        if about.get('text'):
            detections = self.detect_from_text(about['text'], context='about_section')
            all_detections.extend(detections)

        # Check company description
        if website_data.get('description'):
            detections = self.detect_from_text(website_data['description'], context='description')
            all_detections.extend(detections)

        # Check page title and meta
        if website_data.get('title'):
            detections = self.detect_from_text(website_data['title'], context='title')
            all_detections.extend(detections)

        # Deduplicate and merge confidence scores
        merged = self._merge_detections(all_detections)

        # Sort by confidence (highest first)
        merged.sort(key=lambda x: x['confidence'], reverse=True)

        return merged

    def _merge_detections(self, detections: List[Dict]) -> List[Dict]:
        """
        Merge duplicate detections and boost confidence
        """
        merged = {}

        for detection in detections:
            cert_id = detection['certification']['id']

            if cert_id not in merged:
                merged[cert_id] = detection
            else:
                # Boost confidence if found in multiple places
                existing = merged[cert_id]
                boost = 0.05 * (1 - existing['confidence'])  # Diminishing returns
                existing['confidence'] = min(1.0, existing['confidence'] + boost)

                # Track all contexts
                if isinstance(existing.get('context'), str):
                    existing['context'] = [existing['context']]
                if isinstance(detection.get('context'), str):
                    existing['context'].append(detection['context'])

        return list(merged.values())

    def format_certification_list(self, detections: List[Dict], min_confidence: float = 0.7) -> List[str]:
        """
        Format detected certifications as simple string list

        Args:
            detections: Detection results
            min_confidence: Minimum confidence threshold

        Returns:
            List of certification names
        """
        filtered = [d for d in detections if d['confidence'] >= min_confidence]
        return [d['certification']['name'] for d in filtered]

    def get_certification_details(self, cert_name: str) -> Dict:
        """
        Get full details for a specific certification

        Args:
            cert_name: Certification name or ID

        Returns:
            Certification details or None
        """
        cert_name_lower = cert_name.lower()

        for cert in self.certifications:
            if cert['id'] == cert_name_lower or cert['name'].lower() == cert_name_lower:
                return cert

            # Check variations
            for variation in cert.get('variations', []):
                if variation.lower() == cert_name_lower:
                    return cert

        return None

    def get_certifications_by_category(self, category: str) -> List[Dict]:
        """Get all certifications in a specific category"""
        return [cert for cert in self.certifications if cert.get('category') == category]

    def get_certifications_by_region(self, region: str) -> List[Dict]:
        """Get certifications specific to a region/country"""
        region_lower = region.lower()
        results = []

        for cert in self.certifications:
            if cert.get('scope', '').lower() == region_lower:
                results.append(cert)

            regions = cert.get('regions', [])
            if any(r.lower() == region_lower for r in regions):
                results.append(cert)

        return results

    def get_statistics(self) -> Dict:
        """Get knowledge base statistics"""
        categories = {}
        scopes = {}
        importance_counts = {}

        for cert in self.certifications:
            # Count by category
            category = cert.get('category', 'unknown')
            categories[category] = categories.get(category, 0) + 1

            # Count by scope
            scope = cert.get('scope', 'unknown')
            scopes[scope] = scopes.get(scope, 0) + 1

            # Count by importance
            importance = cert.get('importance', 'unknown')
            importance_counts[importance] = importance_counts.get(importance, 0) + 1

        return {
            'total_certifications': len(self.certifications),
            'by_category': categories,
            'by_scope': scopes,
            'by_importance': importance_counts,
            'kb_version': self.knowledge_base.get('metadata', {}).get('version', 'unknown')
        }


# Singleton instance
certification_detector = CertificationDetector()
