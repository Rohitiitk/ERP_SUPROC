# Certification Knowledge Base

## Overview

This knowledge base contains structured information about **international and country-specific certifications and standards** used to identify compliance credentials on supplier websites.

## Current Coverage

- **24 Certifications** across 13 categories
- **International standards**: ISO, IEC, etc.
- **Regional certifications**: CE (EU), FDA (USA), CCC (China), BIS (India)
- **Industry-specific**: Automotive, Medical, Food Safety, Electronics

## Knowledge Base Structure

### Certification Entry Format

```json
{
  "id": "unique_identifier",
  "name": "Display Name",
  "full_name": "Full Official Name",
  "category": "category_name",
  "scope": "international|regional|country",
  "issuing_body": "Organization Name",
  "description": "What this certification means",
  "variations": [
    "ISO 9001",
    "ISO9001",
    "ISO-9001",
    "ISO 9001:2015"
  ],
  "keywords": ["related", "search", "terms"],
  "importance": "critical|high|medium|low",
  "common_in_industries": ["industry1", "industry2"],
  "regions": ["Country1", "Country2"]
}
```

### Field Descriptions

- **id**: Unique identifier (lowercase, underscores)
- **name**: Short, recognizable name
- **full_name**: Complete official name
- **category**: Classification type (see categories below)
- **scope**: Geographic coverage
- **issuing_body**: Organization that issues the certification
- **description**: Purpose and meaning
- **variations**: All text variations for detection (critical!)
- **keywords**: Related terms for fuzzy matching
- **importance**: Business criticality level
- **common_in_industries**: Which industries typically have this
- **regions**: Specific countries/regions (optional)

## Categories

### Quality Management
- ISO 9001, IATF 16949, ISO 13485

### Environmental
- ISO 14001, RoHS, REACH, ENERGY STAR

### Health & Safety
- ISO 45001, OHSAS 18001

### Product Safety
- CE Marking, UL Listed, CCC, BIS

### Regulatory
- FDA Approval

### Food Safety
- HACCP, BRC, ISO 22000

### Ethical & Social
- SEDEX, BSCI, SA8000

### Information Security
- ISO 27001

### Manufacturing Quality
- GMP

## How to Add New Certifications

### Step 1: Research

Gather information about the certification:
- Official name and variations
- Issuing organization
- Geographic scope
- Related industries
- Common text variations on websites

### Step 2: Add Entry

Edit `certifications_standards.json`:

```json
{
  "id": "iso_50001",
  "name": "ISO 50001",
  "full_name": "ISO 50001 - Energy Management Systems",
  "category": "environmental",
  "scope": "international",
  "issuing_body": "International Organization for Standardization",
  "description": "Energy management system standard for organizations",
  "variations": [
    "ISO 50001",
    "ISO50001",
    "ISO-50001",
    "ISO 50001:2018"
  ],
  "keywords": ["energy management", "energy efficiency", "EnMS"],
  "importance": "medium",
  "common_in_industries": ["manufacturing", "energy", "utilities"]
}
```

### Step 3: Update Metadata

Update the metadata section:
```json
{
  "metadata": {
    "version": "1.1",
    "last_updated": "2025-01-30",
    "total_certifications": 25
  }
}
```

### Step 4: Test

Run the test script:
```bash
python test_certification_detector.py
```

## Adding Country-Specific Certifications

### Example: Japanese PSE Mark

```json
{
  "id": "pse_mark",
  "name": "PSE Mark",
  "full_name": "PSE - Product Safety Electrical Appliance",
  "category": "product_safety",
  "scope": "japan",
  "issuing_body": "Japanese Government",
  "description": "Mandatory safety mark for electrical products in Japan",
  "variations": [
    "PSE",
    "PSE Mark",
    "PSE Certified"
  ],
  "keywords": ["japan safety", "electrical safety japan"],
  "importance": "critical",
  "common_in_industries": ["electronics", "electrical_equipment"],
  "regions": ["Japan"]
}
```

## Best Practices

### 1. Variations are Critical

Include **all possible text variations**:
- With/without spaces: "ISO 9001" vs "ISO9001"
- With/without hyphens: "ISO-9001"
- With year versions: "ISO 9001:2015"
- Common misspellings
- Abbreviations

### 2. Keywords for Fuzzy Matching

Add related terms that might appear near the certification:
- Industry terminology
- Alternative names
- Descriptive phrases

### 3. Importance Levels

- **critical**: Required for market access (CE, FDA, CCC)
- **high**: Widely expected by customers (ISO 9001, UL)
- **medium**: Nice to have, demonstrates commitment
- **low**: Niche or less common

### 4. Testing

After adding certifications, test with:
1. Exact variation matching
2. Text containing related keywords
3. Real website content

## Common Certifications to Add

### By Region

**European Union**
- GS Mark (Germany)
- NF Certification (France)
- UKCA Mark (UK post-Brexit)

**Asia-Pacific**
- PSE Mark (Japan)
- KC Mark (South Korea)
- SNI (Indonesia)
- TISI (Thailand)

**Americas**
- CSA (Canada)
- NOM (Mexico)
- INMETRO (Brazil)

**Middle East**
- SASO (Saudi Arabia)
- ESMA (UAE)

### By Industry

**Automotive**
- VDA 6.x standards
- PPAP requirements
- APQP certification

**Medical Devices**
- MDR/IVDR (EU)
- MDSAP
- ISO 14971

**Electronics**
- IEC standards
- WEEE compliance
- Energy ratings

**Textiles**
- GOTS (organic)
- Bluesign
- WRAP certification

**Construction**
- LEED certification
- BREEAM
- Green Building certifications

## Integration with Pipeline

The certification detector is used in `playwright_analyzer.py`:

```python
from services.certification_detector import certification_detector

# During website analysis
detections = certification_detector.detect_from_website_data(website_data)

# Get clean list
certifications = certification_detector.format_certification_list(
    detections,
    min_confidence=0.75
)
```

## Maintenance

### Quarterly Updates
- Review and add new industry standards
- Update certification versions (e.g., ISO 9001:2025)
- Add region-specific requirements

### Annual Review
- Remove obsolete certifications
- Update importance levels
- Expand keyword lists based on detection performance

## Contributing

When adding certifications:
1. Follow the JSON structure exactly
2. Test thoroughly with real data
3. Document the source of information
4. Update version and date in metadata

## Resources

- [ISO Standards](https://www.iso.org/standards.html)
- [IEC Standards](https://www.iec.ch/)
- [European Commission - CE Marking](https://ec.europa.eu/growth/single-market/ce-marking_en)
- [US FDA](https://www.fda.gov/)
- [SAC - China Standards](http://www.sac.gov.cn/was5/web/search)
