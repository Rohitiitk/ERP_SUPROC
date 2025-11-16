"""
Supplier Evaluation Scoring System
Based on 7-step supplier verification criteria

Total: 25 points distributed across 7 categories
Includes 5-star rating based on final score
"""
from typing import Dict
from datetime import datetime


class SupplierEvaluationScoring:
    """
    Comprehensive supplier evaluation scoring system
    """

    def calculate_score(
        self,
        website_data: Dict,
        marketplace_presence: Dict = None,
        sentiment_data: Dict = None
    ) -> Dict:
        """
        Calculate supplier evaluation score

        Args:
            website_data: Data extracted from website
            marketplace_presence: Marketplace presence data
            sentiment_data: Sentiment analysis data

        Returns:
            Score breakdown with total, grade, stars, and analysis
        """
        if marketplace_presence is None:
            marketplace_presence = {}
        if sentiment_data is None:
            sentiment_data = {}

        breakdown = {
            'supplier_selection': self._score_supplier_selection(website_data),
            'company_info': self._score_company_info(website_data),
            'compliance_certs': self._score_compliance(website_data),
            'performance_metrics': self._score_performance(website_data, sentiment_data),
            'risk_profile': self._score_risk(website_data, sentiment_data, marketplace_presence),
            'document_repository': self._score_documents(website_data),
            'engagement': self._score_engagement(website_data, marketplace_presence)
        }

        total = sum(cat['points'] for cat in breakdown.values())
        stars = self._calculate_stars(total)

        return {
            'total': round(total, 1),
            'grade': self._get_grade(total),
            'stars': stars,
            'details': breakdown,
            'recommendation': self._get_recommendation(total),
            'score_analysis': self._generate_analysis(
                breakdown, total, stars, website_data,
                marketplace_presence, sentiment_data
            )
        }

    def _score_supplier_selection(self, website_data: Dict) -> Dict:
        """
        Step 1: Supplier Selection & Access Verification (3 points max)
        Ensure correct supplier identification and data access
        """
        points = 0
        max_points = 3
        details = []

        # Supplier identified (company name exists)
        if website_data.get('company_name') and website_data['company_name'] != 'Unknown':
            points += 1.5
            details.append({'item': 'Supplier identified', 'points': 1.5})
        else:
            details.append({'item': 'Supplier identification unclear', 'points': 0})

        # Website accessible and data visible
        if not website_data.get('analysis_failed'):
            points += 1.5
            details.append({'item': 'Full access to supplier data', 'points': 1.5})
        else:
            details.append({'item': 'Limited data access', 'points': 0})

        return {
            'points': points,
            'max_points': max_points,
            'percentage': round((points / max_points) * 100, 1),
            'details': details
        }

    def _score_company_info(self, website_data: Dict) -> Dict:
        """
        Step 2: Company Info & Contacts (4 points max)
        Validate basic details and contact information
        """
        points = 0
        max_points = 4
        details = []

        contact = website_data.get('contact', {})

        # Company name verified
        if website_data.get('company_name'):
            points += 1
            details.append({'item': 'Company name present', 'points': 1})

        # Email available
        if contact.get('email'):
            points += 1
            details.append({'item': 'Email contact available', 'points': 1})

        # Phone available
        if contact.get('phone'):
            points += 1
            details.append({'item': 'Phone contact available', 'points': 1})

        # Address/Location available
        if website_data.get('location') or contact.get('address'):
            points += 1
            details.append({'item': 'Location/address verified', 'points': 1})

        return {
            'points': points,
            'max_points': max_points,
            'percentage': round((points / max_points) * 100, 1),
            'details': details
        }

    def _score_compliance(self, website_data: Dict) -> Dict:
        """
        Step 3: Compliance & Certifications (4 points max)
        Review compliance documents and certifications
        """
        points = 0
        max_points = 4
        details = []

        certifications = website_data.get('certifications', [])

        if len(certifications) >= 3:
            points += 4
            details.append({'item': f'{len(certifications)} certifications found', 'points': 4})
        elif len(certifications) == 2:
            points += 3
            details.append({'item': '2 certifications found', 'points': 3})
        elif len(certifications) == 1:
            points += 2
            details.append({'item': '1 certification found', 'points': 2})
        else:
            details.append({'item': 'No certifications found', 'points': 0})

        return {
            'points': points,
            'max_points': max_points,
            'percentage': round((points / max_points) * 100, 1),
            'details': details
        }

    def _score_performance(self, website_data: Dict, sentiment_data: Dict) -> Dict:
        """
        Step 4: Performance Metrics / KPIs (5 points max)
        Assess operational performance indicators
        """
        points = 0
        max_points = 5
        details = []

        # Use sentiment as proxy for quality/performance
        sentiment_score = sentiment_data.get('sentiment_score', 50) if sentiment_data.get('sentiment_available') else 50

        if sentiment_score >= 80:
            points += 4
            details.append({'item': 'Excellent performance reputation', 'points': 4})
        elif sentiment_score >= 60:
            points += 2.5
            details.append({'item': 'Good performance reputation', 'points': 2.5})
        elif sentiment_score >= 40:
            points += 1.5
            details.append({'item': 'Moderate performance reputation', 'points': 1.5})
        else:
            details.append({'item': 'Poor performance reputation', 'points': 0})

        # Years in business (if available from about section)
        about = website_data.get('about', {})
        if about.get('years_in_business'):
            years = about['years_in_business']
            if years >= 10:
                points += 1
                details.append({'item': f'{years}+ years in business', 'points': 1})
            elif years >= 5:
                points += 0.75
                details.append({'item': f'{years} years in business', 'points': 0.75})
        else:
            # Default partial credit if we have a website
            points += 0.5
            details.append({'item': 'Business history unknown', 'points': 0.5})

        return {
            'points': min(points, max_points),
            'max_points': max_points,
            'percentage': round((min(points, max_points) / max_points) * 100, 1),
            'details': details
        }

    def _score_risk(self, website_data: Dict, sentiment_data: Dict, marketplace_presence: Dict) -> Dict:
        """
        Step 5: Risk Profile & Financial Stability (4 points max)
        Evaluate risk exposure and financial soundness
        """
        points = 4  # Start with full points, deduct for risks
        max_points = 4
        details = []

        # Sentiment-based risk assessment
        sentiment_score = sentiment_data.get('sentiment_score', 50) if sentiment_data.get('sentiment_available') else 50

        if sentiment_score < 30:
            points -= 2
            details.append({'item': 'High risk: Negative sentiment', 'points': -2})
        elif sentiment_score < 50:
            points -= 1
            details.append({'item': 'Moderate risk: Mixed sentiment', 'points': -1})
        else:
            details.append({'item': 'Low risk: Positive sentiment', 'points': 0})

        # Marketplace verification adds confidence
        if marketplace_presence.get('alibaba_verified') or marketplace_presence.get('thomasnet_listed'):
            details.append({'item': 'Verified on B2B platform', 'points': 0})
        else:
            points -= 1
            details.append({'item': 'Not verified on major platforms', 'points': -1})

        # Website quality signals
        quality_signals = website_data.get('quality_signals', {})
        if not quality_signals.get('has_ssl'):
            points -= 1
            details.append({'item': 'No SSL certificate', 'points': -1})

        points = max(0, points)  # Can't go negative

        return {
            'points': points,
            'max_points': max_points,
            'percentage': round((points / max_points) * 100, 1),
            'details': details
        }

    def _score_documents(self, website_data: Dict) -> Dict:
        """
        Step 6: Document Repository & Audit Trail (3 points max)
        Verify document management
        """
        points = 0
        max_points = 3
        details = []

        visual = website_data.get('visual_elements', {})

        # Has downloadable documents
        if visual.get('has_downloads'):
            points += 1
            details.append({'item': 'Downloadable documents available', 'points': 1})

        # Website has about/company info
        if website_data.get('about'):
            points += 1
            details.append({'item': 'Company information documented', 'points': 1})

        # Recent content/updates
        freshness = website_data.get('freshness_signals', {})
        if freshness.get('recent_dates'):
            points += 1
            details.append({'item': 'Recent content updates', 'points': 1})

        return {
            'points': points,
            'max_points': max_points,
            'percentage': round((points / max_points) * 100, 1),
            'details': details
        }

    def _score_engagement(self, website_data: Dict, marketplace_presence: Dict) -> Dict:
        """
        Step 7: Engagement / Activity (2 points max)
        Review current engagement level
        """
        points = 0
        max_points = 2
        details = []

        visual = website_data.get('visual_elements', {})

        # Active on social media
        if visual.get('has_social_media'):
            points += 0.75
            details.append({'item': 'Active on social media', 'points': 0.75})

        # Has contact form/chat
        if visual.get('has_contact_form') or visual.get('has_chat'):
            points += 0.75
            details.append({'item': 'Interactive communication available', 'points': 0.75})

        # Listed on marketplaces (shows active B2B engagement)
        if marketplace_presence.get('alibaba_verified') or marketplace_presence.get('thomasnet_listed'):
            points += 0.5
            details.append({'item': 'Active on B2B marketplaces', 'points': 0.5})

        return {
            'points': points,
            'max_points': max_points,
            'percentage': round((points / max_points) * 100, 1),
            'details': details
        }

    def _calculate_stars(self, score: float) -> int:
        """
        Calculate star rating (1-5) based on score (out of 25)

        22-25: ★★★★★ (5 stars) - 88%+
        18-21: ★★★★☆ (4 stars) - 72-84%
        13-17: ★★★☆☆ (3 stars) - 52-68%
        8-12:  ★★☆☆☆ (2 stars) - 32-48%
        0-7:   ★☆☆☆☆ (1 star)  - 0-28%
        """
        if score >= 22:
            return 5
        elif score >= 18:
            return 4
        elif score >= 13:
            return 3
        elif score >= 8:
            return 2
        else:
            return 1

    def _get_grade(self, score: float) -> str:
        """Convert numerical score (out of 25) to letter grade"""
        if score >= 24:  # 96%+
            return 'A+'
        elif score >= 22:  # 88%+
            return 'A'
        elif score >= 21:  # 84%+
            return 'A-'
        elif score >= 20:  # 80%+
            return 'B+'
        elif score >= 19:  # 76%+
            return 'B'
        elif score >= 18:  # 72%+
            return 'B-'
        elif score >= 16:  # 64%+
            return 'C+'
        elif score >= 15:  # 60%+
            return 'C'
        elif score >= 14:  # 56%+
            return 'C-'
        elif score >= 13:  # 52%+
            return 'D+'
        elif score >= 11:  # 44%+
            return 'D'
        else:
            return 'F'

    def _get_recommendation(self, score: float) -> str:
        """Get recommendation based on score (out of 25)"""
        if score >= 21:  # 84%+
            return "HIGHLY RECOMMENDED: Excellent supplier with strong credentials"
        elif score >= 18:  # 72%+
            return "RECOMMENDED: Reliable supplier meeting quality standards"
        elif score >= 14:  # 56%+
            return "ACCEPTABLE: Adequate supplier, monitor performance"
        elif score >= 10:  # 40%+
            return "CAUTION: Marginal supplier, requires verification"
        else:
            return "NOT RECOMMENDED: Insufficient supplier credentials"

    def _generate_analysis(
        self,
        breakdown: Dict,
        total: float,
        stars: int,
        website_data: Dict,
        marketplace_presence: Dict,
        sentiment_data: Dict
    ) -> str:
        """Generate clean, concise B2B supplier analysis"""
        
        analysis_sections = []
        
        # === EXECUTIVE SUMMARY ===
        exec_summary = self._generate_executive_summary(total, stars, website_data)
        analysis_sections.append(exec_summary)
        
        # === QUALITY ASSESSMENT ===
        quality_analysis = self._analyze_quality(website_data, breakdown)
        analysis_sections.append(f"\nQUALITY & STANDARDS COMPLIANCE\n{quality_analysis}")
        
        # === BULK ORDER & PRODUCTION CAPACITY ===
        production_analysis = self._analyze_production_capacity(website_data, marketplace_presence)
        analysis_sections.append(f"\nBULK ORDER & PRODUCTION CAPACITY\n{production_analysis}")
        
        # === DELIVERY & LOGISTICS ===
        delivery_analysis = self._analyze_delivery_capability(website_data, marketplace_presence)
        analysis_sections.append(f"\nDELIVERY & LOGISTICS\n{delivery_analysis}")
        
        # === COMMUNICATION & SUPPORT ===
        communication_analysis = self._analyze_communication(website_data)
        analysis_sections.append(f"\nCOMMUNICATION & SUPPORT\n{communication_analysis}")
        
        # === MARKET REPUTATION ===
        reputation_analysis = self._analyze_reputation(sentiment_data, marketplace_presence, website_data)
        analysis_sections.append(f"\nMARKET REPUTATION\n{reputation_analysis}")
        
        # === BUSINESS STABILITY ===
        stability_analysis = self._analyze_stability(website_data, breakdown)
        analysis_sections.append(f"\nBUSINESS STABILITY\n{stability_analysis}")
        
        return "\n".join(analysis_sections)

    def _generate_executive_summary(self, total: float, stars: int, website_data: Dict) -> str:
        """Generate executive summary"""
        company_name = website_data.get('company_name', 'This supplier')
        
        if total >= 21:
            classification = "TIER 1 - PREMIUM B2B SUPPLIER"
            desc = f"{company_name} demonstrates exceptional B2B capabilities with strong credentials for bulk orders and long-term partnerships. Suitable for high-volume procurement and strategic supplier relationships."
        elif total >= 18:
            classification = "TIER 2 - QUALIFIED B2B SUPPLIER"
            desc = f"{company_name} meets industry standards for B2B operations with reliable bulk order handling capabilities. Suitable for medium to large volume procurement."
        elif total >= 14:
            classification = "TIER 3 - STANDARD B2B SUPPLIER"
            desc = f"{company_name} meets baseline B2B requirements. Suitable for standard bulk orders with normal monitoring and verification procedures."
        elif total >= 10:
            classification = "TIER 4 - EMERGING SUPPLIER"
            desc = f"{company_name} shows limited B2B credentials. Recommended for small trial orders only. Extensive verification required before bulk commitments."
        else:
            classification = "NOT QUALIFIED FOR B2B"
            desc = f"{company_name} lacks minimum B2B supplier credentials. Not recommended for bulk orders or business partnerships."
        
        return f"Supplier Classification: {classification}\nOverall Score: {total} out of 25 points (Rating: {stars} out of 5 stars)\n\n{desc}"

    def _analyze_quality(self, website_data: Dict, breakdown: Dict) -> str:
        """Analyze product/service quality indicators"""
        points = []
        
        # Certifications (Quality Standards)
        certs = website_data.get('certifications', [])
        cert_count = len(certs)
        
        points.append(f"Quality Certifications: {cert_count} certification(s) identified")
        if cert_count >= 3:
            points.append(f"  • Certified: {', '.join(certs[:3])}")
            points.append(f"  • Strong compliance with international B2B quality standards")
            points.append(f"  • Suitable for large-scale bulk orders requiring certified products")
        elif cert_count >= 1:
            points.append(f"  • Certified: {', '.join(certs)}")
            points.append(f"  • Basic quality compliance demonstrated")
            points.append(f"  • Suitable for standard bulk orders with quality requirements")
        else:
            points.append(f"  • No quality certifications found on website")
            points.append(f"  • Request quality certificates before placing bulk orders")
        
        # Quality Management System
        compliance_score = breakdown.get('compliance_certs', {}).get('percentage', 0)
        points.append(f"\nCompliance Score: {compliance_score}%")
        if compliance_score >= 75:
            points.append("  • Strong framework for consistent product quality")
        elif compliance_score >= 50:
            points.append("  • Basic quality management systems in place")
            points.append("  • Request detailed quality control procedures")
        else:
            points.append("  • Limited quality management information available")
            points.append("  • Conduct quality audit before bulk orders")
        
        # Product Documentation
        docs_score = breakdown.get('document_repository', {}).get('percentage', 0)
        points.append(f"\nDocumentation Score: {docs_score}%")
        if docs_score >= 75:
            points.append("  • Technical specs and product documentation readily available")
        elif docs_score >= 50:
            points.append("  • Basic documentation present")
            points.append("  • Request detailed specifications for bulk orders")
        else:
            points.append("  • Limited documentation available")
            points.append("  • Require complete technical specifications before procurement")
        
        return "\n".join(points)

    def _analyze_production_capacity(self, website_data: Dict, marketplace_presence: Dict) -> str:
        """Analyze bulk order and production capacity"""
        points = []
        
        # B2B Platform Presence
        if marketplace_presence.get('alibaba_verified'):
            points.append("B2B Platform Presence:")
            points.append("  • Verified supplier on Alibaba")
            points.append("  • Demonstrates bulk order handling experience")
            points.append("  • Suitable for international bulk procurement")
        elif marketplace_presence.get('thomasnet_listed'):
            points.append("B2B Platform Presence:")
            points.append("  • Listed on ThomasNet")
            points.append("  • Industrial supply capability confirmed")
            points.append("  • Suitable for commercial bulk orders")
        else:
            points.append("B2B Platform Presence:")
            points.append("  • No major marketplace presence detected")
            points.append("  • Verify production capacity and MOQ directly")
        
        # Business Maturity (Production Experience)
        about = website_data.get('about', {})
        if about.get('years_in_business'):
            years = about['years_in_business']
            points.append(f"\nBusiness Experience: {years} years in operation")
            if years >= 10:
                points.append("  • Established production capabilities for consistent bulk supply")
                points.append("  • Able to handle large volume orders")
            elif years >= 5:
                points.append("  • Moderate production experience")
                points.append("  • Suitable for medium-scale bulk orders")
            else:
                points.append("  • Limited track record")
                points.append("  • Start with smaller trial orders first")
        else:
            points.append("\nBusiness Experience:")
            points.append("  • Years in operation not specified")
            points.append("  • Request company background and production history")
        
        # Operational Indicators
        visual = website_data.get('visual_elements', {})
        if visual.get('has_downloads'):
            points.append("\nProduct Resources:")
            points.append("  • Downloadable catalogs and specifications available")
            points.append("  • Organized product line for bulk buyers")
        
        return "\n".join(points)

    def _analyze_communication(self, website_data: Dict) -> str:
        """Analyze communication channels and business support"""
        points = []
        
        contact = website_data.get('contact', {})
        visual = website_data.get('visual_elements', {})
        
        # Communication Channels
        channels = []
        if contact.get('email'): channels.append("Email")
        if contact.get('phone'): channels.append("Phone/Direct Line")
        if visual.get('has_contact_form'): channels.append("Online Inquiry Form")
        if visual.get('has_chat'): channels.append("Live Chat Support")
        if visual.get('has_social_media'): channels.append("Social Media")
        
        channel_count = len(channels)
        points.append(f"Available Communication Channels: {channel_count}")
        if channel_count >= 4:
            points.append(f"  • {', '.join(channels)}")
            points.append("  • Excellent accessibility for B2B inquiries and order management")
            points.append("  • Multiple options for urgent bulk order queries")
        elif channel_count >= 2:
            points.append(f"  • {', '.join(channels)}")
            points.append("  • Standard B2B communication capability")
            points.append("  • Suitable for regular business correspondence")
        elif channel_count == 1:
            points.append(f"  • Channel: {channels[0]}")
            points.append("  • Limited contact options")
            points.append("  • May cause delays in urgent situations")
        else:
            points.append("  • Contact information not readily available")
            points.append("  • Verify business contact details before engagement")
        
        # Response Time Indicators
        if visual.get('has_chat'):
            points.append("\nReal-time Support:")
            points.append("  • Live chat available")
            points.append("  • Commitment to fast response for bulk order inquiries")
        
        # Business Contact Details
        if contact.get('email') and contact.get('phone'):
            points.append("\nDirect Business Contact:")
            points.append("  • Email and phone available")
            points.append("  • Suitable for formal RFQ submissions and order negotiations")
        
        # Location (for time zone consideration)
        if website_data.get('location'):
            points.append(f"\nBusiness Location: {website_data['location']}")
            points.append("  • Consider time zone differences for communication planning")
        
        return "\n".join(points)

    def _analyze_delivery_capability(self, website_data: Dict, marketplace_presence: Dict) -> str:
        """Analyze delivery and logistics capabilities for bulk orders"""
        points = []
        
        # B2B Logistics Experience
        if marketplace_presence.get('alibaba_verified'):
            points.append("International Logistics:")
            points.append("  • Verified on Alibaba platform")
            points.append("  • Experience with international bulk shipping")
            points.append("  • Suitable for cross-border bulk procurement")
        elif marketplace_presence.get('thomasnet_listed'):
            points.append("Logistics Network:")
            points.append("  • Listed on ThomasNet")
            points.append("  • B2B distribution network present")
            points.append("  • Suitable for domestic/regional bulk orders")
        else:
            points.append("Logistics Information:")
            points.append("  • No major platform verification")
            points.append("  • Verify shipping capabilities and lead times")
            points.append("  • Request logistics references for bulk orders")
        
        # Geographic Coverage
        location = website_data.get('location')
        if location:
            points.append(f"\nOperating Location: {location}")
            points.append("  • Consider shipping costs and delivery times")
            points.append("  • Consider import duties and customs clearance")
        
        # Operational Maturity
        about = website_data.get('about', {})
        if about.get('years_in_business'):
            years = about['years_in_business']
            if years >= 10:
                points.append(f"\nDelivery Track Record: {years}+ years in operation")
                points.append("  • Established supply chain and logistics processes")
                points.append("  • Expected reliable on-time delivery for bulk orders")
            elif years >= 5:
                points.append(f"\nDelivery Track Record: {years} years in business")
                points.append("  • Moderate logistics experience")
                points.append("  • Verify delivery performance references")
        
        # Order Management Capability
        visual = website_data.get('visual_elements', {})
        if visual.get('has_contact_form') or visual.get('has_chat'):
            points.append("\nOrder Support System:")
            points.append("  • Active inquiry and support channels available")
            points.append("  • Responsive order tracking and customer service")
        
        return "\n".join(points)

    def _analyze_reputation(self, sentiment_data: Dict, marketplace_presence: Dict, website_data: Dict) -> str:
        """Analyze market reputation and business reliability"""
        points = []
        
        # Online Market Reputation
        if sentiment_data.get('sentiment_available'):
            sentiment_score = sentiment_data.get('sentiment_score', 50)
            sentiment_label = sentiment_data.get('sentiment_label', 'neutral').upper()
            news_count = sentiment_data.get('news_count', 0)
            
            if sentiment_score >= 80:
                points.append(f"Market Reputation Score: {sentiment_score}/100")
                points.append("  • Strong positive reputation")
                points.append("  • High customer confidence and satisfaction")
                points.append(f"  • Based on {news_count} online mentions")
            elif sentiment_score >= 60:
                points.append(f"Market Reputation Score: {sentiment_score}/100")
                points.append("  • Positive reputation")
                points.append("  • Generally favorable market view")
                points.append(f"  • Based on {news_count} online mentions")
            elif sentiment_score >= 40:
                points.append(f"Market Reputation Score: {sentiment_score}/100")
                points.append("  • Mixed feedback from market")
                points.append("  • Both positive and negative mentions")
                points.append(f"  • Based on {news_count} online mentions")
            else:
                points.append(f"Market Reputation Score: {sentiment_score}/100")
                points.append("  • Concerning indicators detected")
                points.append("  • Negative feedback present")
                points.append(f"  • Based on {news_count} online mentions")
            
            if sentiment_data.get('analysis_summary'):
                points.append(f"\nMarket Insight:\n  • {sentiment_data['analysis_summary']}")
        else:
            points.append("Market Reputation:")
            points.append("  • Limited online presence")
            points.append("  • May indicate emerging business")
        
        # B2B Platform Verification
        if marketplace_presence.get('alibaba_verified'):
            points.append("\nPlatform Verification:")
            points.append("  • Verified supplier on Alibaba")
        if marketplace_presence.get('thomasnet_listed'):
            points.append("  • Listed on ThomasNet platform")
        
        return "\n".join(points)

    def _analyze_stability(self, website_data: Dict, breakdown: Dict) -> str:
        """Analyze business stability and financial reliability"""
        points = []
        
        # Business Age and Track Record
        about = website_data.get('about', {})
        if about.get('years_in_business'):
            years = about['years_in_business']
            points.append("Business Age:")
            if years >= 15:
                points.append(f"  • {years} years in operation (Well-established)")
            elif years >= 10:
                points.append(f"  • {years} years in operation (Established)")
            elif years >= 5:
                points.append(f"  • {years} years in operation (Moderate track record)")
            else:
                points.append(f"  • {years} years in operation (Limited history)")
        else:
            points.append("Business Age:")
            points.append("  • Years in operation not specified")
        
        # Business Activity
        freshness = website_data.get('freshness_signals', {})
        points.append("\nBusiness Activity:")
        if freshness.get('recent_dates'):
            points.append("  • Website recently updated")
            points.append("  • Active business operations")
        else:
            points.append("  • Limited recent website activity")
        
        # Market Engagement
        engagement_score = breakdown.get('engagement', {}).get('percentage', 0)
        points.append("\nMarket Engagement:")
        if engagement_score >= 75:
            points.append(f"  • High activity level ({engagement_score}%)")
        elif engagement_score >= 50:
            points.append(f"  • Moderate activity level ({engagement_score}%)")
        else:
            points.append(f"  • Limited activity ({engagement_score}%)")
        
        return "\n".join(points)

    def _generate_performance_summary(self, breakdown: Dict, total: float) -> str:
        """Generate category-wise performance summary"""
        points = []
        points.append("Category Scores (Percentage Performance):")
        points.append("")
        
        for category, data in breakdown.items():
            category_name = category.replace('_', ' ').title()
            percentage = data['percentage']
            score_out_of = f"{data['points']}/{data['max_points']}"
            
            if percentage >= 75:
                status = "Strong"
            elif percentage >= 50:
                status = "Acceptable"
            else:
                status = "Needs Improvement"
            
            points.append(f"- {category_name}: {percentage}% ({score_out_of} points) - {status}")
        
        points.append("")
        points.append(f"Overall Weighted Score: {total} out of 25 points")
        
        return "\n".join(points)

    def _generate_final_recommendation(self, total: float, stars: int, breakdown: Dict) -> str:
        """Generate final B2B procurement recommendation"""
        
        if total >= 21:
            return """Status: HIGHLY RECOMMENDED FOR B2B PROCUREMENT

This supplier demonstrates exceptional B2B credentials and operational capabilities. Suitable for strategic partnerships, high-volume bulk orders, and long-term supply contracts. Minimal risk profile with strong performance across all evaluation criteria.

Recommended Actions:
- Proceed with supplier onboarding process
- Request formal quotations for bulk orders
- Schedule facility tour or capability assessment (if applicable)
- Negotiate pricing for high-volume commitments
- Consider for preferred supplier designation

Risk Level: Low
Contract Value: Suitable for high-value contracts
Order Volume: Capable of large bulk orders"""
        
        elif total >= 18:
            return """Status: RECOMMENDED FOR B2B PROCUREMENT

This supplier meets industry standards for B2B operations with reliable capabilities. Suitable for standard bulk procurement activities with medium to large order volumes. Normal due diligence procedures apply.

Recommended Actions:
- Issue RFQ for required products/services
- Request product samples and quality certificates
- Verify business registration and tax credentials
- Establish initial purchase order with standard payment terms
- Monitor first few deliveries for quality and timeliness

Risk Level: Low to Moderate
Contract Value: Suitable for moderate to high-value orders
Order Volume: Capable of medium to large bulk orders"""
        
        elif total >= 14:
            return """Status: ACCEPTABLE WITH CONDITIONS

This supplier meets minimum B2B requirements but shows areas requiring improvement or verification. Suitable for low to moderate volume purchases with enhanced monitoring and quality checks.

Recommended Actions:
- Conduct additional supplier verification
- Request missing documentation and certificates
- Start with trial/sample orders before bulk commitment
- Implement quality inspection on first deliveries
- Establish clear performance metrics and KPIs
- Consider alternative suppliers for comparison

Risk Level: Moderate
Contract Value: Limit to low to moderate value initially
Order Volume: Start with small to medium bulk orders"""
        
        elif total >= 10:
            return """Status: PROCEED WITH CAUTION

This supplier shows limited B2B credentials with significant gaps in key areas. Only suitable for non-critical, low-value purchases with protective payment terms.

Recommended Actions:
- Extensive due diligence required before engagement
- Request complete financial statements and bank references
- Verify business registration and legal status
- Require advance payment or payment guarantees
- Consider multiple alternative suppliers
- Limit order value and volume significantly

Risk Level: High
Contract Value: Low-value orders only
Order Volume: Small trial orders recommended"""
        
        else:
            return """Status: NOT RECOMMENDED FOR B2B PROCUREMENT

This supplier fails to meet minimum B2B supplier qualification standards. Multiple critical gaps identified across essential evaluation criteria.

Recommended Actions:
- Do not proceed with this supplier at current assessment
- Continue supplier search for qualified alternatives
- If already engaged, review relationship and consider exit
- Escalate to procurement management for decision
- Document reasons for non-qualification

Risk Level: Very High
Recommendation: Seek alternative suppliers"""


# Singleton instance
supplier_evaluation_scoring = SupplierEvaluationScoring()
