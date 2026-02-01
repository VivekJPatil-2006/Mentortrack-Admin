import React, { useState } from 'react';
import {
  Button,
  Box,
  Snackbar,
  Alert,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Grid
} from '@mui/material';
import {
  CloudUpload,
  Search,
  AssignmentInd,
  Download,
  VideoCall,
  Person
} from '@mui/icons-material';
import { ImportCSVModule } from './ImportCSVModule';
import { SearchModule } from './SearchModule';
import { AssignMentorModule } from './AssignMentorModule';
import { MeetingScheduleModule } from './MeetingScheduleModule';

function App() {
  const [loading, setLoading] = useState({ teachers: false, students: false });
  const [alert, setAlert] = useState({ open: false, message: '', severity: 'info' });
  const [failedEmails, setFailedEmails] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [studentEmail, setStudentEmail] = useState('');
  const [studentReport, setStudentReport] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const handleCloseAlert = () => setAlert(prev => ({ ...prev, open: false }));

  const downloadFailedEmails = () => {
    const csvContent = "Email,Password\n" + failedEmails.map(({ email, password }) => `${email},${password}`).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'failed_credentials.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const fetchStudentReport = async () => {
  if (!studentEmail) {
    setAlert({ open: true, message: 'Please enter student email', severity: 'warning' });
    return;
  }

  setSearchLoading(true);
  setStudentReport(null);

  try {
    console.log('🔄 Fetching report for:', studentEmail);
    
    const response = await fetch('http://localhost:3001/api/student-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: studentEmail }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch student report');
    }

    setStudentReport(data);
    setAlert({ open: true, message: 'Student report generated successfully!', severity: 'success' });
    
  } catch (error) {
    console.error('Error fetching student report:', error);
    setAlert({ 
      open: true, 
      message: `Error: ${error.message}`, 
      severity: 'error' 
    });
  } finally {
    setSearchLoading(false);
  }
 };

  const renderCompanySection = (title, companies, color, risk) => (
    <Card sx={{ mb: 2, borderLeft: `4px solid ${color}` }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          {title}
        </Typography>
        <Typography variant="body2" gutterBottom>
          <strong>Target Roles:</strong> {companies.targetRoles}
        </Typography>
        <Typography variant="body2" gutterBottom>
          <strong>Companies:</strong> {companies.companies.join(', ')}
        </Typography>
        {risk && (
          <Typography variant="body2" color="text.secondary">
            <strong>Risk:</strong> {risk}
          </Typography>
        )}
        {companies.preparation && (
          <Typography variant="body2" color="text.secondary">
            <strong>Preparation:</strong> {companies.preparation}
          </Typography>
        )}
        {companies.action && (
          <Typography variant="body2" color="text.secondary">
            <strong>Action:</strong> {companies.action}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Mentor Management System
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Manage teachers, students, mentor assignments, and meetings
        </Typography>
      </Paper>

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Data Import" icon={<CloudUpload />} />
        <Tab label="Mentor Assignment" icon={<AssignmentInd />} />
        <Tab label="Meeting Schedule" icon={<VideoCall />} />
        <Tab label="Search" icon={<Search />} />
      </Tabs>

      {activeTab === 0 && (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <CloudUpload sx={{ mr: 1 }} /> Import Data
          </Typography>
          <ImportCSVModule 
            setAlert={setAlert} 
            setLoading={setLoading} 
            loading={loading} 
            setFailedEmails={setFailedEmails} 
          />
          {failedEmails.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                onClick={downloadFailedEmails}
                startIcon={<Download />}
              >
                Download Failed Emails
              </Button>
              <Typography variant="caption" color="error" sx={{ ml: 2 }}>
                {failedEmails.length} emails failed to send
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {activeTab === 1 && (
        <AssignMentorModule setAlert={setAlert} />
      )}

      {activeTab === 2 && (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <VideoCall sx={{ mr: 1 }} /> Schedule Meetings
          </Typography>
          <MeetingScheduleModule setAlert={setAlert} />
        </Paper>
      )}

      {activeTab === 3 && (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <Search sx={{ mr: 1 }} /> Search Records
          </Typography>
          <SearchModule setAlert={setAlert} />
          
          {/* Student Career Report Section */}
          <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <Person sx={{ mr: 1 }} /> Student Career Report
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                label="Enter Student Email"
                variant="outlined"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                placeholder="student@example.com"
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                onClick={fetchStudentReport}
                disabled={searchLoading}
                startIcon={searchLoading ? <CircularProgress size={20} /> : <Search />}
              >
                {searchLoading ? 'Generating Report...' : 'Generate Career Report'}
              </Button>
            </Box>

            {studentReport && (
              <Card elevation={3}>
                <CardContent>
                  {/* Profile Header */}
                  <Box sx={{ mb: 3, p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Student Career Strategy Report
                    </Typography>
                    <Typography variant="h6" color="primary.dark">
                      {studentReport.profileId}
                    </Typography>
                  </Box>

                  {/* Strengths & Focus Areas */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="h6" gutterBottom>Strengths</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {studentReport.strengths.map((strength, index) => (
                          <Chip key={index} label={strength} color="success" variant="outlined" />
                        ))}
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="h6" gutterBottom>Focus Areas</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {studentReport.focusAreas.map((area, index) => (
                          <Chip key={index} label={area} color="warning" variant="outlined" />
                        ))}
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Company Recommendations */}
                  <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                    Company Placement Strategy
                  </Typography>

                  {/* High Chance Companies */}
                  {renderCompanySection(
                    "1. High Chance Companies 🟢 (The Safety Net)",
                    studentReport.highChanceCompanies,
                    '#4caf50',
                    studentReport.highChanceCompanies.risk
                  )}

                  {/* Moderate Chance Companies */}
                  {renderCompanySection(
                    "2. Moderate Chance Companies 🟡 (The Core Target)",
                    studentReport.moderateChanceCompanies,
                    '#ff9800',
                    studentReport.moderateChanceCompanies.risk
                  )}

                  {/* Low Chance Companies */}
                  {renderCompanySection(
                    "3. Low Chance Companies 🔴 (The Stretch Goal)",
                    studentReport.lowChanceCompanies,
                    '#f44336',
                    studentReport.lowChanceCompanies.risk
                  )}
                </CardContent>
              </Card>
            )}
          </Paper>
        </Paper>
      )}

      <Snackbar
        open={alert.open}
        autoHideDuration={6000}
        onClose={handleCloseAlert}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseAlert}
          severity={alert.severity}
          sx={{ width: '100%' }}
          variant="filled"
        >
          {alert.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;