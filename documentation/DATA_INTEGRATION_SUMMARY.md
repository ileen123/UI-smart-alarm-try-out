# Data Structure Integration

## Summary of Changes

### ✅ **Integrated JSON Files**

**Before:** 
- `patient-data.json` - Patient info, session data, bed states
- `bed-overview.json` - Available patients, bed states (duplicate)

**After:**
- `hospital-data.json` - Unified file containing all data

### 📁 **New Unified Structure (`hospital-data.json`)**

```json
{
  "patients": [
    // Array of all available patients with id, name, gender, age, weight
  ],
  "beds": {
    // Object with bed states keyed by bed number
    "1": { "bedNumber": 1, "occupied": false, "patientId": null, "vpkCode": null, "riskLevel": null }
  },
  "currentSession": {
    // Patient setup session data (organ settings, selected problems, etc.)
  },
  "metadata": {
    // Version info and timestamps
  }
}
```

### 🔧 **Files Updated**

- **index.html**: Now fetches from `hospital-data.json` instead of `bed-overview.json`
- **hospital-data.json**: New unified data file
- **Removed files**: `patient-data.json`, `bed-overview.json` (redundant)

### ✅ **Benefits**

1. **Eliminated Duplication**: No more duplicate patient lists and bed state structures
2. **Single Source of Truth**: All hospital data in one place
3. **Easier Maintenance**: Only need to update one file
4. **Better Organization**: Clear separation between patients, beds, sessions, and metadata
5. **Reduced Complexity**: Simplified data loading logic

### 🏥 **Data Flow**

- **Patient Setup (index.html)**: Uses localStorage for temporary session data, references `hospital-data.json` via data-manager.js
- **Bed Overview (index.html)**: Loads patient list from `hospital-data.json`, uses localStorage for bed state persistence
- **Configuration**: Still uses separate `config.json` for organ settings and UI configuration

This integration maintains all functionality while eliminating redundancy and improving maintainability.
