import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Checkbox,
  Avatar,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
  useTheme
} from '@mui/material';
import {
  VideoCall,
  CalendarToday,
  AccessTime,
  EventAvailable
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const MeetingScheduleModule = ({ setAlert }) => {
  const theme = useTheme();

  const departments = ['Computer', 'IT', 'ENTC', 'AIDS', 'ECE'];

  const [activeStep, setActiveStep] = useState(0);
  const [selectedDept, setSelectedDept] = useState('');
  const [filteredTeachers, setFilteredTeachers] = useState([]);
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [meetingDetails, setMeetingDetails] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    duration: 60,
    agenda: ''
  });
  const [loading, setLoading] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [selectionMode, setSelectionMode] = useState('department'); // 'department' | 'custom'

  const steps = ['Select Mode', 'Select Teachers', 'Meeting Details', 'Schedule'];

  useEffect(() => {
    // Fetch all teachers for custom selection
    const fetchAllTeachers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'teachers'));
        const teachersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllTeachers(teachersList);
      } catch (error) {
        console.error("Error fetching all teachers:", error);
      }
    };
    fetchAllTeachers();
  }, []);

  useEffect(() => {
    if (selectionMode === 'department' && selectedDept) {
      fetchTeachersByDepartment(selectedDept);
    } else if (selectionMode === 'custom') {
      setFilteredTeachers(allTeachers);
    }
  }, [selectedDept, selectionMode, allTeachers]);

  const fetchTeachersByDepartment = async (department) => {
    setLoading(true);
    try {
      const q = query(collection(db, 'teachers'), where('department', '==', department));
      const snapshot = await getDocs(q);
      const teachersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFilteredTeachers(teachersList);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      setAlert({
        open: true,
        message: 'Error fetching teachers. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherSelection = (teacher) => {
    setSelectedTeachers(prev => {
      const isSelected = prev.some(t => t.email === teacher.email);
      if (isSelected) {
        return prev.filter(t => t.email !== teacher.email);
      } else {
        return [...prev, teacher];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedTeachers.length === filteredTeachers.length) {
      setSelectedTeachers([]);
    } else {
      setSelectedTeachers([...filteredTeachers]);
    }
  };

  const handleMeetingDetailsChange = (field, value) => {
    setMeetingDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generateGoogleMeetAndInvite = async (meetingData, teachers) => {
    const resp = await fetch('http://localhost:3001/create-and-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meeting: meetingData, teachers }),
    });
    if (!resp.ok) throw new Error('Failed to create Google Meet event');
    const json = await resp.json();
    if (!json.success) throw new Error(json.error || 'Unknown error');
    return json.meetLink || (json.event && json.event.hangoutLink) || null;
  };

  const scheduleMeeting = async () => {
    if (!meetingDetails.title || !meetingDetails.date || !meetingDetails.time || selectedTeachers.length === 0) {
      setAlert({
        open: true,
        message: 'Please fill all required fields and select at least one teacher',
        severity: 'warning'
      });
      return;
    }

    setLoading(true);
    try {
      const meetingData = { ...meetingDetails, duration: meetingDetails.duration || 60 };
      const meetLink = await generateGoogleMeetAndInvite(meetingData, selectedTeachers);
      setMeetingLink(meetLink);

      const meetingRec = {
        ...meetingData,
        meetLink,
        teachers: selectedTeachers,
        department: selectionMode === 'department' ? selectedDept : 'Custom',
        createdAt: serverTimestamp(),
        status: 'scheduled'
      };
      await addDoc(collection(db, 'meetings'), meetingRec);

      setAlert({
        open: true,
        message: `Meeting scheduled successfully! ${selectedTeachers.length} teacher(s) notified.`,
        severity: 'success'
      });

      setShowMeetingDialog(true);
      resetForm();
    } catch (err) {
      console.error('Error scheduling meeting:', err);
      setAlert({
        open: true,
        message: 'Error scheduling meeting. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedDept('');
    setFilteredTeachers([]);
    setSelectedTeachers([]);
    setMeetingDetails({
      title: '',
      description: '',
      date: '',
      time: '',
      duration: 60,
      agenda: ''
    });
    setActiveStep(0);
    setSelectionMode('department');
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0: // Select Mode
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Teacher Selection Mode
            </Typography>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Mode</InputLabel>
              <Select
                value={selectionMode}
                onChange={(e) => setSelectionMode(e.target.value)}
                label="Mode"
              >
                <MenuItem value="department">Department-wise</MenuItem>
                <MenuItem value="custom">Custom / Random</MenuItem>
              </Select>
            </FormControl>

            {selectionMode === 'department' && (
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Department</InputLabel>
                <Select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  label="Department"
                >
                  {departments.map((dept) => (
                    <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        );

      case 1: // Select Teachers
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Select Teachers ({selectedTeachers.length} selected)
              </Typography>
              <Button onClick={handleSelectAll}>
                {selectedTeachers.length === filteredTeachers.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={2}>
                {filteredTeachers.map((teacher) => {
                  const displayName = teacher.name || teacher.email || 'Unknown';
                  return (
                    <Grid item xs={12} sm={6} md={4} key={teacher.email || teacher.id}>
                      <Card
                        variant="outlined"
                        sx={{
                          cursor: 'pointer',
                          border: selectedTeachers.some(t => t.email === teacher.email) 
                            ? `2px solid ${theme.palette.primary.main}`
                            : '1px solid rgba(0, 0, 0, 0.12)',
                          bgcolor: selectedTeachers.some(t => t.email === teacher.email) 
                            ? theme.palette.action.selected 
                            : 'background.paper'
                        }}
                        onClick={() => handleTeacherSelection(teacher)}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Checkbox
                              checked={selectedTeachers.some(t => t.email === teacher.email)}
                              onChange={() => handleTeacherSelection(teacher)}
                            />
                            <Avatar 
                              src={teacher.profileImage ? `data:image/jpeg;base64,${teacher.profileImage}` : undefined}
                              sx={{ width: 40, height: 40, mr: 2 }}
                            >
                              {displayName.charAt(0)}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle1" fontWeight="bold">
                                {displayName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {teacher.email || 'No Email'}
                              </Typography>
                            </Box>
                          </Box>
                          <Chip 
                            label={teacher.department || 'NA'} 
                            size="small" 
                            color="primary" 
                            variant="outlined" 
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Box>
        );

      case 2: // Meeting Details
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Meeting Details</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Meeting Title"
                  value={meetingDetails.title}
                  onChange={(e) => handleMeetingDetailsChange('title', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={3}
                  value={meetingDetails.description}
                  onChange={(e) => handleMeetingDetailsChange('description', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={meetingDetails.date}
                  onChange={(e) => handleMeetingDetailsChange('date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Time"
                  type="time"
                  value={meetingDetails.time}
                  onChange={(e) => handleMeetingDetailsChange('time', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Duration</InputLabel>
                  <Select
                    value={meetingDetails.duration}
                    onChange={(e) => handleMeetingDetailsChange('duration', e.target.value)}
                    label="Duration"
                  >
                    <MenuItem value={30}>30 minutes</MenuItem>
                    <MenuItem value={60}>1 hour</MenuItem>
                    <MenuItem value={90}>1.5 hours</MenuItem>
                    <MenuItem value={120}>2 hours</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Agenda"
                  multiline
                  rows={2}
                  value={meetingDetails.agenda}
                  onChange={(e) => handleMeetingDetailsChange('agenda', e.target.value)}
                  placeholder="Key discussion points..."
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 3: // Review & Schedule
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Review and Schedule</Typography>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" color="primary" gutterBottom>
                {meetingDetails.title}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    <CalendarToday sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                    Date: {new Date(meetingDetails.date).toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    <AccessTime sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                    Time: {meetingDetails.time}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Duration: {meetingDetails.duration} minutes
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Teachers invited: {selectedTeachers.length}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Box>
        );

      default:
        return 'Unknown step';
    }
  };

  const handleNext = () => {
    if (activeStep === 0 && selectionMode === 'department' && !selectedDept) {
      setAlert({ open: true, message: 'Please select a department', severity: 'warning' });
      return;
    }
    if (activeStep === 1 && selectedTeachers.length === 0) {
      setAlert({ open: true, message: 'Please select at least one teacher', severity: 'warning' });
      return;
    }
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => setActiveStep(prev => prev - 1);

  return (
    <Box>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ 
            display: 'flex', 
            alignItems: 'center',
            color: theme.palette.primary.dark,
            mb: 3
          }}>
            <VideoCall sx={{ mr: 2, fontSize: '2rem' }} />
            Schedule Meeting
          </Typography>

          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map(label => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box sx={{ mt: 2 }}>
            {getStepContent(activeStep)}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button disabled={activeStep === 0} onClick={handleBack}>Back</Button>
            <Box>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={scheduleMeeting}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <EventAvailable />}
                >
                  {loading ? 'Scheduling...' : 'Schedule Meeting'}
                </Button>
              ) : (
                <Button variant="contained" onClick={handleNext}>Next</Button>
              )}
            </Box>
          </Box>
        </Paper>
      </motion.div>

      {/* Meeting Success Dialog */}
      <Dialog open={showMeetingDialog} onClose={() => setShowMeetingDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center' }}>
          <VideoCall color="success" sx={{ fontSize: 48, mb: 2 }} />
          <Typography variant="h5" color="success.main">Meeting Scheduled Successfully!</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Google Meet link has been generated and invitations have been sent to selected teachers.
          </Typography>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>Meeting Link:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Link color="primary" />
              <Typography 
                variant="body2" 
                sx={{ wordBreak: 'break-all', color: 'primary.main', textDecoration: 'underline', cursor: 'pointer' }}
                onClick={() => window.open(meetingLink, '_blank')}
              >
                {meetingLink}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMeetingDialog(false)}>Close</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              navigator.clipboard.writeText(meetingLink);
              setAlert({ open: true, message: 'Meeting link copied to clipboard!', severity: 'success' });
            }}
          >
            Copy Link
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
