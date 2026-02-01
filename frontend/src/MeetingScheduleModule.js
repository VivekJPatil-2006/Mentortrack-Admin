import React, { useState, useEffect, useCallback } from 'react';
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
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';

import { db } from './firebase';

export const MeetingScheduleModule = ({ setAlert }) => {

  const theme = useTheme();

  const departments = ['Computer', 'IT', 'ENTC', 'AIDS', 'ECE'];

  const [activeStep, setActiveStep] = useState(0);
  const [selectedDept, setSelectedDept] = useState('');
  const [filteredTeachers, setFilteredTeachers] = useState([]);
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);

  const [selectionMode, setSelectionMode] = useState('department');

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

  const steps = ['Select Mode', 'Select Teachers', 'Meeting Details', 'Schedule'];

  // ---------------------------------------------------
  // ✅ FETCH TEACHERS BY DEPARTMENT
  // ---------------------------------------------------

  const fetchTeachersByDepartment = useCallback(async (department) => {

    setLoading(true);

    try {

      const q = query(
        collection(db, 'teachers'),
        where('department', '==', department)
      );

      const snapshot = await getDocs(q);

      const teachersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setFilteredTeachers(teachersList);

    } catch (error) {

      console.error(error);

      setAlert({
        open: true,
        message: 'Error fetching teachers',
        severity: 'error'
      });

    } finally {
      setLoading(false);
    }

  }, [setAlert]);

  // ---------------------------------------------------
  // ✅ FETCH ALL TEACHERS (CUSTOM MODE)
  // ---------------------------------------------------

  useEffect(() => {

    const fetchAllTeachers = async () => {

      try {

        const snapshot = await getDocs(collection(db, 'teachers'));

        const teachersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setAllTeachers(teachersList);

      } catch (error) {
        console.error(error);
      }
    };

    fetchAllTeachers();

  }, []);

  // ---------------------------------------------------
  // ✅ MODE BASED FILTER
  // ---------------------------------------------------

  useEffect(() => {

    if (selectionMode === 'department' && selectedDept) {
      fetchTeachersByDepartment(selectedDept);
    }

    if (selectionMode === 'custom') {
      setFilteredTeachers(allTeachers);
    }

  }, [selectionMode, selectedDept, allTeachers, fetchTeachersByDepartment]);

  // ---------------------------------------------------
  // ✅ HANDLERS
  // ---------------------------------------------------

  const handleTeacherSelection = (teacher) => {

    setSelectedTeachers(prev => {

      const exists = prev.some(t => t.email === teacher.email);

      if (exists) {
        return prev.filter(t => t.email !== teacher.email);
      }

      return [...prev, teacher];

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

  // ---------------------------------------------------
  // ✅ GOOGLE MEET API
  // ---------------------------------------------------

  const generateGoogleMeetAndInvite = async (meetingData, teachers) => {

    const resp = await fetch('http://localhost:3001/create-and-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meeting: meetingData, teachers })
    });

    if (!resp.ok) throw new Error('Meet API Failed');

    const json = await resp.json();

    if (!json.success) throw new Error(json.error);

    return json.meetLink || json.event?.hangoutLink;
  };

  // ---------------------------------------------------
  // ✅ SCHEDULE MEETING
  // ---------------------------------------------------

  const scheduleMeeting = async () => {

    if (
      !meetingDetails.title ||
      !meetingDetails.date ||
      !meetingDetails.time ||
      selectedTeachers.length === 0
    ) {
      setAlert({
        open: true,
        message: 'Fill all required fields',
        severity: 'warning'
      });
      return;
    }

    setLoading(true);

    try {

      const meetLink = await generateGoogleMeetAndInvite(
        meetingDetails,
        selectedTeachers
      );

      setMeetingLink(meetLink);

      await addDoc(collection(db, 'meetings'), {
        ...meetingDetails,
        meetLink,
        teachers: selectedTeachers,
        department: selectionMode === 'department' ? selectedDept : 'Custom',
        createdAt: serverTimestamp(),
        status: 'scheduled'
      });

      setAlert({
        open: true,
        message: 'Meeting Scheduled Successfully',
        severity: 'success'
      });

      setShowMeetingDialog(true);
      resetForm();

    } catch (error) {

      console.error(error);

      setAlert({
        open: true,
        message: 'Meeting scheduling failed',
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
    setSelectionMode('department');

    setMeetingDetails({
      title: '',
      description: '',
      date: '',
      time: '',
      duration: 60,
      agenda: ''
    });

    setActiveStep(0);
  };

  // ---------------------------------------------------
  // ✅ STEP CONTENT
  // ---------------------------------------------------

  const getStepContent = (step) => {

    switch (step) {

      case 0:
        return (
          <Box>
            <Typography variant="h6">Select Mode</Typography>

            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Mode</InputLabel>
              <Select
                value={selectionMode}
                onChange={(e) => setSelectionMode(e.target.value)}
                label="Mode"
              >
                <MenuItem value="department">Department Wise</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
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
                  {departments.map(dept => (
                    <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        );

      case 1:
        return (
          <Grid container spacing={2}>

            {loading && <CircularProgress />}

            {filteredTeachers.map(teacher => {

              const selected = selectedTeachers.some(t => t.email === teacher.email);

              return (
                <Grid item xs={12} sm={6} md={4} key={teacher.id}>

                  <Card
                    sx={{
                      border: selected ? `2px solid ${theme.palette.primary.main}` : '1px solid #ddd'
                    }}
                    onClick={() => handleTeacherSelection(teacher)}
                  >
                    <CardContent>

                      <Box display="flex" alignItems="center">
                        <Checkbox checked={selected} />

                        <Avatar sx={{ mr: 2 }}>
                          {(teacher.name || teacher.email || 'T')[0]}
                        </Avatar>

                        <Box>
                          <Typography fontWeight="bold">
                            {teacher.name || teacher.email}
                          </Typography>
                          <Typography variant="body2">
                            {teacher.department}
                          </Typography>
                        </Box>
                      </Box>

                    </CardContent>
                  </Card>

                </Grid>
              );
            })}

          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={2}>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Meeting Title"
                value={meetingDetails.title}
                onChange={(e) => handleMeetingDetailsChange('title', e.target.value)}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                type="date"
                value={meetingDetails.date}
                onChange={(e) => handleMeetingDetailsChange('date', e.target.value)}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                type="time"
                value={meetingDetails.time}
                onChange={(e) => handleMeetingDetailsChange('time', e.target.value)}
              />
            </Grid>

          </Grid>
        );

      case 3:
        return (
          <Typography>
            Ready to schedule meeting with {selectedTeachers.length} teachers
          </Typography>
        );

      default:
        return null;
    }
  };

  // ---------------------------------------------------
  // ✅ NAVIGATION
  // ---------------------------------------------------

  const handleNext = () => {

    if (activeStep === 0 && selectionMode === 'department' && !selectedDept) {
      setAlert({ open: true, message: 'Select Department', severity: 'warning' });
      return;
    }

    if (activeStep === 1 && selectedTeachers.length === 0) {
      setAlert({ open: true, message: 'Select Teachers', severity: 'warning' });
      return;
    }

    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => setActiveStep(prev => prev - 1);

  // ---------------------------------------------------
  // ✅ UI
  // ---------------------------------------------------

  return (

    <Box>

      <Paper sx={{ p: 4 }}>

        <Typography variant="h4" mb={3}>
          <VideoCall sx={{ mr: 2 }} />
          Schedule Meeting
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {getStepContent(activeStep)}

        <Box mt={3} display="flex" justifyContent="space-between">

          <Button disabled={activeStep === 0} onClick={handleBack}>
            Back
          </Button>

          {activeStep === steps.length - 1 ? (

            <Button
              variant="contained"
              onClick={scheduleMeeting}
              startIcon={<EventAvailable />}
            >
              Schedule
            </Button>

          ) : (

            <Button variant="contained" onClick={handleNext}>
              Next
            </Button>

          )}

        </Box>

      </Paper>

      {/* SUCCESS DIALOG */}

      <Dialog open={showMeetingDialog} onClose={() => setShowMeetingDialog(false)}>

        <DialogTitle>Meeting Scheduled</DialogTitle>

        <DialogContent>

          <Typography>
            Meet Link:
          </Typography>

          <Link onClick={() => window.open(meetingLink, '_blank')}>
            {meetingLink}
          </Link>

        </DialogContent>

      </Dialog>

    </Box>
  );
};
