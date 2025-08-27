# Centralized Data Management System - Smart Alarm

## Overview
The Smart Alarm system now uses a centralized data management system that ensures all HTML files can access and share data consistently. This replaces the previous scattered localStorage usage with a unified approach.

## Core Components

### 1. Shared Data Manager (`js/shared-data-manager.js`)
The central data management class that handles all data operations:

- **Centralized Storage**: All data is stored in a single `smartAlarmAppData` localStorage key
- **Legacy Migration**: Automatically migrates old localStorage data to the new system
- **Cross-Page Access**: All HTML files can access the same data consistently
- **Type Safety**: Provides structured data handling with proper error handling

### 2. Data Structure
```javascript
{
  patients: {
    "patientId": {
      medicalInfo: {
        selectedProblem: "...",
        selectedRiskLevel: "...",
        selectedTags: [...],
        organSettings: {...},
        lastUpdated: "ISO timestamp"
      },
      lastUpdated: "ISO timestamp"
    }
  },
  beds: {
    "bedNumber": {
      occupied: true/false,
      patientId: "...",
      riskLevel: "...",
      // ... other bed data
    }
  },
  sessions: {
    current: {
      currentPatient: "...",
      currentBed: "...",
      selectedRiskLevel: "...",
      timestamp: "ISO timestamp"
    }
  },
  lastUpdated: "ISO timestamp",
  version: "1.0"
}
```

## Key Methods

### Patient Data Management
- `savePatientMedicalInfo(patientId, medicalInfo)` - Save patient medical data
- `getPatientMedicalInfo(patientId)` - Retrieve patient medical data
- `getAllPatients()` - Get all patient data
- `removePatient(patientId)` - Remove patient data

### Bed Management
- `saveBedStates(bedStates)` - Save bed state data
- `getBedStates()` - Retrieve bed states

### Session Management
- `saveSessionData(sessionData)` - Save current session data
- `getSessionData()` - Retrieve session data
- `clearSessionData()` - Clear session data

### Page Initialization
- `initializeIndexPage()` - Initialize patient setup page
- `initializeAlarmOverviewPage(patientId)` - Initialize alarm overview page
- `initializeBedOverviewPage()` - Initialize bed overview page

## Implementation in HTML Files

### 1. All HTML files include the shared script:
```html
<script src="js/shared-data-manager.js"></script>
```

### 2. Each page uses initialization methods:

**index.html:**
```javascript
const initData = window.sharedDataManager.initializeIndexPage();
```

**alarm-overview.html:**
```javascript
const initData = window.sharedDataManager.initializeAlarmOverviewPage(currentPatientId);
```

**bed-overview.html:**
```javascript
const initData = window.sharedDataManager.initializeBedOverviewPage();
```

## Benefits

### 1. Data Consistency
- All pages access the same data source
- No more data synchronization issues
- Centralized data validation and error handling

### 2. Cross-Page References
- Patient data saved in index.html is immediately available in alarm-overview.html
- Bed states are consistently maintained across navigation
- Session data persists properly between pages

### 3. Legacy Compatibility
- Automatically migrates old localStorage data
- Maintains backward compatibility
- Gradual transition from old to new system

### 4. Debugging and Maintenance
- Single point of data management
- Built-in debug methods (`debugLocalStorage()`)
- Comprehensive logging for troubleshooting

## Data Flow Examples

### 1. Patient Setup Workflow
1. **bed-overview.html**: User selects bed and patient
2. **Shared Data Manager**: Saves session data with currentBed and currentPatient
3. **index.html**: Loads session data, shows patient info, saves medical settings
4. **Shared Data Manager**: Saves patient medical info and updates session with risk level
5. **bed-overview.html**: Retrieves updated data and updates bed display

### 2. Alarm Configuration
1. **bed-overview.html**: User clicks alarm settings for a patient
2. **alarm-overview.html**: Initializes with patient ID from URL
3. **Shared Data Manager**: Loads patient medical info and displays current settings
4. **alarm-overview.html**: User modifies settings
5. **Shared Data Manager**: Saves updated medical info
6. **bed-overview.html**: Shows updated alarm status

## Migration Notes

### Removed Direct localStorage Usage
All direct `localStorage.getItem()` and `localStorage.setItem()` calls have been replaced with shared data manager methods.

### Centralized Patient Info
Patient basic information (name, age, etc.) is now available through `getPatientInfo(patientId)` method.

### Session Data Handling
Session data (current bed, patient, risk level) is now managed centrally and accessible across all pages.

## Debugging

Use the built-in debug method to inspect all data:
```javascript
window.sharedDataManager.debugLocalStorage();
```

This will log:
- Centralized app data structure
- All patient data
- Bed states
- Session data
- Raw localStorage contents for comparison

## Future Enhancements

The centralized system is designed to support:
- Data export/import functionality
- Server-side data synchronization
- Real-time updates across multiple browser tabs
- Advanced data validation and schema versioning
