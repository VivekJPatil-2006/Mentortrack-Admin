import React from 'react';
import { 
  Button, 
  Card, 
  CardContent, 
  CardHeader, 
  Grid, 
  Typography, 
  CircularProgress,
  Box,
  Paper,
  Fade,
  Zoom,
  useTheme,
  Divider
} from '@mui/material';
import { CloudUpload, Person, Group, GetApp, Description } from '@mui/icons-material';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { motion } from 'framer-motion';

export const ImportCSVModule = ({ setAlert, setLoading, loading, setFailedEmails }) => {
  const theme = useTheme();
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const downloadTemplate = (type) => {
    let csvContent = '';
    
    if (type === 'teachers') {
      csvContent = 'email\n';
      csvContent += 'teacher1@example.com\n';
      csvContent += 'teacher2@example.com\n';
      csvContent += 'teacher3@example.com';
    } else if (type === 'students') {
      csvContent = 'email,name,phone,department,year,division,rollno\n';
      csvContent += 'student1@example.com,John Doe,1234567890,Computer,Second Year,A,101\n';
      csvContent += 'student2@example.com,Jane Smith,9876543210,IT,Third Year,B,102';
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}-import-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sendCredentialsEmail = async (email, password) => {
    try {
      const response = await fetch('http://localhost:3001/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Email sending failed:', error);
      return false;
    }
  };

  const importData = async (file, collectionName) => {
    setLoading(prev => ({ ...prev, [collectionName]: true }));
    setFailedEmails([]);

    return new Promise((resolve) => {
      Papa.parse(file, {
        header: collectionName === 'students', // Only use headers for students
        complete: async (results) => {
          if (collectionName === 'teachers') {
            // Process teachers CSV (no headers)
            const emails = results.data
              .flat() // Flatten array of arrays
              .filter(email => email && typeof email === 'string')
              .map(email => email.trim().toLowerCase())
              .filter(email => isValidEmail(email));

            if (emails.length === 0) {
              setAlert({
                open: true,
                message: 'No valid emails found in the CSV file.',
                severity: 'warning'
              });
              resolve({ imported: 0, duplicates: 0, emailsSent: 0 });
              return;
            }

            let importedCount = 0;
            let duplicateCount = 0;
            let emailsSentCount = 0;
            const failed = [];

            for (const email of emails) {
              try {
                const docRef = await getDoc(doc(db, collectionName, email));

                if (docRef.exists()) {
                  duplicateCount++;
                  continue;
                }

                const password = uuidv4().slice(0, 8);

                await setDoc(doc(db, collectionName, email), {
                  email,
                  password,
                  createdAt: new Date().toISOString()
                });

                const emailSent = await sendCredentialsEmail(email, password);
                if (emailSent) {
                  emailsSentCount++;
                } else {
                  failed.push({ email, password });
                }

                importedCount++;
              } catch (error) {
                console.error(`Error processing ${email}:`, error);
                failed.push({ email, error: error.message });
              }
            }

            setFailedEmails(failed);
            resolve({ imported: importedCount, duplicates: duplicateCount, emailsSent: emailsSentCount });

          } else if (collectionName === 'students') {
            // Process students CSV (with headers)
            const validStudents = results.data.filter(row => 
              row.email && isValidEmail(row.email) && 
              row.name && row.phone && row.department && row.year && row.division && row.rollno
            );

            if (validStudents.length === 0) {
              setAlert({
                open: true,
                message: 'No valid student records found in the CSV file.',
                severity: 'warning'
              });
              resolve({ imported: 0, duplicates: 0, emailsSent: 0 });
              return;
            }

            let importedCount = 0;
            let duplicateCount = 0;
            let emailsSentCount = 0;
            const failed = [];

            for (const student of validStudents) {
              try {
                const email = student.email.trim().toLowerCase();
                const docRef = await getDoc(doc(db, 'students', email));

                if (docRef.exists()) {
                  duplicateCount++;
                  continue;
                }

                const password = uuidv4().slice(0, 8);

                await setDoc(doc(db, 'students', email), {
                  email,
                  name: student.name,
                  password,
                  phonenumber: student.phone,
                  department: student.department,
                  year: student.year,
                  division: student.division,
                  batch: '',
                  rollno: student.rollno,
                  address: '',
                  parentphone: '',
                  createdAt: new Date().toISOString()
                });

                const emailSent = await sendCredentialsEmail(email, password);
                if (emailSent) {
                  emailsSentCount++;
                } else {
                  failed.push({ email, password });
                }

                importedCount++;
              } catch (error) {
                console.error(`Error processing ${student.email}:`, error);
                failed.push({ email: student.email, error: error.message });
              }
            }

            setFailedEmails(failed);
            resolve({ imported: importedCount, duplicates: duplicateCount, emailsSent: emailsSentCount });
          }
        },
        error: (error) => {
          console.error("CSV parsing error:", error);
          setAlert({ 
            open: true, 
            message: `Error parsing CSV file: ${error.message}`, 
            severity: 'error' 
          });
          resolve({ imported: 0, duplicates: 0, emailsSent: 0 });
        }
      });
    });
  };

  const handleFileUpload = async (event, collectionName) => {
    const file = event.target.files[0];
    if (!file) return;

    const { imported, duplicates, emailsSent } = await importData(file, collectionName);

    let message = `Imported ${imported} ${collectionName} successfully!`;
    if (duplicates > 0) message += ` ${duplicates} duplicates skipped.`;
    if (emailsSent < imported) message += ` ${imported - emailsSent} emails failed to send.`;

    setAlert({ 
      open: true, 
      message, 
      severity: emailsSent === imported ? 'success' : 'warning' 
    });
    setLoading(prev => ({ ...prev, [collectionName]: false }));
    event.target.value = '';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ 
        fontWeight: 600,
        color: theme.palette.primary.dark,
        mb: 4,
        textAlign: 'center'
      }}>
        Bulk Import Users
      </Typography>
      
      <Grid container spacing={4} justifyContent="center">
        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card 
              variant="outlined" 
              sx={{ 
                borderRadius: 3,
                boxShadow: theme.shadows[3],
                transition: 'transform 0.3s, box-shadow 0.3s',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: theme.shadows[6]
                }
              }}
            >
              <CardHeader
                title={
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Import Teachers
                  </Typography>
                }
                avatar={
                  <Paper 
                    elevation={3} 
                    sx={{ 
                      p: 2, 
                      bgcolor: theme.palette.primary.light,
                      color: theme.palette.primary.contrastText
                    }}
                  >
                    <Person fontSize="large" />
                  </Paper>
                }
                sx={{ 
                  bgcolor: theme.palette.grey[50],
                  borderBottom: `1px solid ${theme.palette.divider}`
                }}
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Zoom in={true} style={{ transitionDelay: '100ms' }}>
                      <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<GetApp />}
                        onClick={() => downloadTemplate('teachers')}
                        fullWidth
                        size="large"
                        sx={{
                          py: 1.5,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 500
                        }}
                      >
                        Download Template
                      </Button>
                    </Zoom>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Zoom in={true} style={{ transitionDelay: '200ms' }}>
                      <label>
                        <input
                          accept=".csv"
                          style={{ display: 'none' }}
                          type="file"
                          onChange={(e) => handleFileUpload(e, 'teachers')}
                        />
                        <Button
                          variant="contained"
                          color="primary"
                          component="span"
                          startIcon={loading.teachers ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
                          disabled={loading.teachers}
                          fullWidth
                          size="large"
                          sx={{
                            py: 1.5,
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 500
                          }}
                        >
                          {loading.teachers ? 'Processing...' : 'Upload CSV'}
                        </Button>
                      </label>
                    </Zoom>
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 3, p: 2, bgcolor: theme.palette.grey[50], borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    CSV Format Requirements:
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Description color="action" sx={{ mr: 1, fontSize: '1rem' }} />
                    Single column with teacher emails
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                    <Description color="action" sx={{ mr: 1, fontSize: '1rem' }} />
                    Header row is optional
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card 
              variant="outlined" 
              sx={{ 
                borderRadius: 3,
                boxShadow: theme.shadows[3],
                transition: 'transform 0.3s, box-shadow 0.3s',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: theme.shadows[6]
                }
              }}
            >
              <CardHeader
                title={
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Import Students
                  </Typography>
                }
                avatar={
                  <Paper 
                    elevation={3} 
                    sx={{ 
                      p: 2, 
                      bgcolor: theme.palette.secondary.light,
                      color: theme.palette.secondary.contrastText
                    }}
                  >
                    <Group fontSize="large" />
                  </Paper>
                }
                sx={{ 
                  bgcolor: theme.palette.grey[50],
                  borderBottom: `1px solid ${theme.palette.divider}`
                }}
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Zoom in={true} style={{ transitionDelay: '200ms' }}>
                      <Button
                        variant="outlined"
                        color="secondary"
                        startIcon={<GetApp />}
                        onClick={() => downloadTemplate('students')}
                        fullWidth
                        size="large"
                        sx={{
                          py: 1.5,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 500
                        }}
                      >
                        Download Template
                      </Button>
                    </Zoom>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Zoom in={true} style={{ transitionDelay: '300ms' }}>
                      <label>
                        <input
                          accept=".csv"
                          style={{ display: 'none' }}
                          type="file"
                          onChange={(e) => handleFileUpload(e, 'students')}
                        />
                        <Button
                          variant="contained"
                          color="secondary"
                          component="span"
                          startIcon={loading.students ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
                          disabled={loading.students}
                          fullWidth
                          size="large"
                          sx={{
                            py: 1.5,
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 500
                          }}
                        >
                          {loading.students ? 'Processing...' : 'Upload CSV'}
                        </Button>
                      </label>
                    </Zoom>
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 3, p: 2, bgcolor: theme.palette.grey[50], borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    CSV Format Requirements:
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Description color="action" sx={{ mr: 1, fontSize: '1rem' }} />
                    Required columns: email, name, phone, department, year, division, rollno
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                    <Description color="action" sx={{ mr: 1, fontSize: '1rem' }} />
                    Header row is required
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>
      
      <Fade in={true} timeout={1000}>
        <Box sx={{ 
          mt: 4, 
          p: 3, 
          bgcolor: theme.palette.background.paper, 
          borderRadius: 2,
          boxShadow: theme.shadows[1],
          maxWidth: 800,
          mx: 'auto',
          textAlign: 'center'
        }}>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            Need Help With CSV Import?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Download our templates and follow the format guidelines above. For large imports (>1000 records),
            consider splitting your file into multiple smaller files.
          </Typography>
        </Box>
      </Fade>
    </Box>
  );
};