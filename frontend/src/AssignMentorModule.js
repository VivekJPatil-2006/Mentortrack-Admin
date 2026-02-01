import React, { useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Box,
  Divider,
  CircularProgress,
  useTheme,
  Fade,
  Zoom,
  Collapse,
  Badge,
  Tabs,
  Tab,
  InputAdornment
} from '@mui/material';
import {
  FilterList,
  Group,
  AssignmentInd,
  Visibility,
  Delete,
  Person,
  School,
  Email,
  Phone,
  CheckCircle,
  Cancel,
  ExpandMore,
  ExpandLess,
  Info,
  PersonAdd,
  Search
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { collection, getDocs, query, where, updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

export const AssignMentorModule = ({ setAlert }) => {
  const theme = useTheme();
  const departments = ['Computer', 'IT', 'ENTC', 'AIDS', 'ECE'];
  const years = ['First Year', 'Second Year', 'Third Year', 'Final Year'];
  
  const [selectedDept, setSelectedDept] = useState('');
  const [filteredTeachers, setFilteredTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [assignedStudents, setAssignedStudents] = useState([]);
  const [filterInputs, setFilterInputs] = useState({ department: '', year: '', batch: '' });
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState({
    global: false,
    assigning: {}, // Track individual student assignments
    removing: {},  // Track individual student removals
    searching: false
  });
  const [expandedSection, setExpandedSection] = useState({
    teachers: true,
    filter: true,
    assigned: true
  });
  const [searchTab, setSearchTab] = useState('filter');
  const [searchName, setSearchName] = useState('');

  const handleDepartmentChange = async (event) => {
    const dept = event.target.value;
    setSelectedDept(dept);
    setLoading(prev => ({ ...prev, global: true }));

    try {
      const q = query(collection(db, 'teachers'), where('department', '==', dept));
      const snapshot = await getDocs(q);
      const teachersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFilteredTeachers(teachersList);
      
      setAlert({
        open: true,
        message: `Found ${teachersList.length} teachers in ${dept} department`,
        severity: 'success'
      });
    } catch (error) {
      console.error("Error fetching teachers:", error);
      setAlert({
        open: true,
        message: 'Error fetching teachers. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(prev => ({ ...prev, global: false }));
    }
  };

  const handleTeacherClick = async (teacher) => {
    setSelectedTeacher(teacher);
    setLoading(prev => ({ ...prev, global: true }));
    await fetchAssignedStudents(teacher.email);
    setLoading(prev => ({ ...prev, global: false }));
  };

  const fetchAssignedStudents = async (teacherEmail) => {
    try {
      const subColRef = collection(db, `teachers/${teacherEmail}/assignedstudents`);
      const snapshot = await getDocs(subColRef);
      const emails = snapshot.docs.map(doc => doc.id);
      setAssignedStudents(emails);
    } catch (error) {
      console.error("Error fetching assigned students:", error);
      setAlert({
        open: true,
        message: 'Error fetching assigned students.',
        severity: 'error'
      });
    }
  };

  const handleFilterStudents = async () => {
    const { department, year, batch } = filterInputs;
    if (!department || !year || !batch) {
      setAlert({
        open: true,
        message: 'Please select all filter criteria',
        severity: 'warning'
      });
      return;
    }

    setLoading(prev => ({ ...prev, global: true }));
    try {
      const q = query(
        collection(db, 'students'),
        where('department', '==', department),
        where('year', '==', year),
        where('batch', '==', batch)
      );

      const snapshot = await getDocs(q);
      const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFilteredStudents(students);

      setAlert({
        open: true,
        message: `${students.length} student(s) found.`,
        severity: students.length > 0 ? 'success' : 'info'
      });
    } catch (error) {
      console.error("Error filtering students:", error);
      setAlert({
        open: true,
        message: 'Error filtering students. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(prev => ({ ...prev, global: false }));
    }
  };

  const handleSearchByName = async () => {
    if (!searchName.trim()) {
      setAlert({
        open: true,
        message: 'Please enter a name to search',
        severity: 'warning'
      });
      return;
    }

    setLoading(prev => ({ ...prev, searching: true }));
    try {
      const studentsRef = collection(db, 'students');
      const q = query(
        studentsRef,
        where('name', '>=', searchName),
        where('name', '<=', searchName + '\uf8ff')
      );

      const snapshot = await getDocs(q);
      const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFilteredStudents(students);

      setAlert({
        open: true,
        message: `${students.length} student(s) found matching "${searchName}"`,
        severity: students.length > 0 ? 'success' : 'info'
      });
    } catch (error) {
      console.error("Error searching students:", error);
      setAlert({
        open: true,
        message: 'Error searching students. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(prev => ({ ...prev, searching: false }));
    }
  };

  const handleAssignMentor = async (studentEmail = null) => {
    if (!selectedTeacher) return;
    
    // Determine which students to process
    const studentsToProcess = studentEmail 
      ? [filteredStudents.find(s => s.email === studentEmail)] 
      : filteredStudents;

    if (studentsToProcess.length === 0) return;

    setLoading(prev => ({
      ...prev,
      global: !studentEmail,
      assigning: studentEmail ? { ...prev.assigning, [studentEmail]: true } : prev.assigning
    }));

    try {
      for (const student of studentsToProcess) {
        if (!student) continue;

        // Update student document with mentor email
        const studentRef = doc(db, 'students', student.email);
        await updateDoc(studentRef, {
          mentoremail: selectedTeacher.email
        });

        // Add student to teacher's assignedstudents subcollection
        const assignedStudentRef = doc(db, `teachers/${selectedTeacher.email}/assignedstudents`, student.email);
        await setDoc(assignedStudentRef, {
          assignedAt: new Date().toISOString()
        });
      }

      // Refresh assigned students list
      await fetchAssignedStudents(selectedTeacher.email);

      setAlert({
        open: true,
        message: studentEmail 
          ? 'Mentor assigned to student.' 
          : `Mentor assigned to ${studentsToProcess.length} student(s).`,
        severity: 'success'
      });

      // Clear filtered students if we did a bulk assignment
      if (!studentEmail) {
        setFilteredStudents([]);
        setSearchName('');
      }
    } catch (error) {
      console.error("Error assigning mentor:", error);
      setAlert({
        open: true,
        message: 'Error assigning mentor. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(prev => ({
        ...prev,
        global: false,
        assigning: studentEmail ? { ...prev.assigning, [studentEmail]: false } : prev.assigning
      }));
    }
  };

  const handleRemoveAssignment = async (studentEmail) => {
    if (!selectedTeacher) return;

    setLoading(prev => ({
      ...prev,
      removing: {
        ...prev.removing,
        [studentEmail]: true
      }
    }));

    try {
      // Remove from teacher's assignedstudents subcollection
      const assignedStudentRef = doc(db, `teachers/${selectedTeacher.email}/assignedstudents`, studentEmail);
      await deleteDoc(assignedStudentRef);

      // Update student document to remove mentor email
      const studentRef = doc(db, 'students', studentEmail);
      await updateDoc(studentRef, {
        mentoremail: ''
      });

      // Refresh lists
      await fetchAssignedStudents(selectedTeacher.email);
      
      setAlert({
        open: true,
        message: 'Student removed from mentor assignment.',
        severity: 'success'
      });
    } catch (error) {
      console.error("Error removing assignment:", error);
      setAlert({
        open: true,
        message: 'Error removing assignment. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(prev => ({ ...prev, removing: { ...prev.removing, [studentEmail]: false } }));
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleTabChange = (event, newValue) => {
    setSearchTab(newValue);
    setFilteredStudents([]);
    setSearchName('');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ 
        fontWeight: 600,
        color: theme.palette.primary.dark,
        mb: 4,
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <School sx={{ mr: 2, fontSize: '2rem' }} />
        Mentor Assignment System
      </Typography>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('teachers')}
          >
            <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center' }}>
              <FilterList color="primary" sx={{ mr: 1 }} /> 
              Filter Teachers by Department
            </Typography>
            {expandedSection.teachers ? <ExpandLess /> : <ExpandMore />}
          </Box>

          <Collapse in={expandedSection.teachers}>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ minWidth: 200 }}>
                  <InputLabel>Select Department</InputLabel>
                  <Select
                    value={selectedDept}
                    onChange={handleDepartmentChange}
                    label="Select Department"
                    disabled={loading.global}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                          minWidth: 250,
                        },
                      },
                    }}
                  >
                    {departments.map((dept) => (
                      <MenuItem key={dept} value={dept} sx={{ minWidth: 250 }}>
                        {dept}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                  <Info color="action" sx={{ mr: 1 }} />
                  Select a department to view available teachers
                </Typography>
              </Grid>
            </Grid>
          </Collapse>
        </Paper>
      </motion.div>

      {loading.global && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
          <CircularProgress color="primary" />
        </Box>
      )}

      {filteredTeachers.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                cursor: 'pointer'
              }}
              onClick={() => toggleSection('teachers')}
            >
              <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center' }}>
                <Group color="primary" sx={{ mr: 1 }} />
                {filteredTeachers.length} Teachers in {selectedDept} Department
              </Typography>
              {expandedSection.teachers ? <ExpandLess /> : <ExpandMore />}
            </Box>

            <Collapse in={expandedSection.teachers}>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                {filteredTeachers.map((teacher) => (
                  <Grid item xs={12} sm={6} md={4} key={teacher.id}>
                    <motion.div whileHover={{ scale: 1.02 }}>
                      <Card
                        variant="outlined"
                        sx={{
                          cursor: 'pointer',
                          borderLeft: selectedTeacher?.email === teacher.email
                            ? `4px solid ${theme.palette.primary.main}`
                            : '1px solid rgba(0, 0, 0, 0.12)',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            boxShadow: 3
                          }
                        }}
                        onClick={() => handleTeacherClick(teacher)}
                      >
                        <CardHeader
                          avatar={
                            <Avatar 
                              src={teacher.profileImage ? `data:image/jpeg;base64,${teacher.profileImage}` : undefined}
                              sx={{ 
                                width: 56, 
                                height: 56,
                                bgcolor: theme.palette.primary.light,
                                color: theme.palette.primary.contrastText
                              }}
                            >
                              {teacher.name.charAt(0)}
                            </Avatar>
                          }
                          title={
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {teacher.name}
                            </Typography>
                          }
                          subheader={
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                              <Email fontSize="small" color="action" sx={{ mr: 1 }} />
                              <Typography variant="body2" color="text.secondary">
                                {teacher.email}
                              </Typography>
                            </Box>
                          }
                          action={
                            <Tooltip title="View assigned students">
                              <IconButton>
                                <Visibility color="action" />
                              </IconButton>
                            </Tooltip>
                          }
                          sx={{ 
                            bgcolor: selectedTeacher?.email === teacher.email 
                              ? theme.palette.action.selected 
                              : 'inherit'
                          }}
                        />
                        <CardContent>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                            <Chip
                              label={teacher.department}
                              size="small"
                              color="primary"
                              variant="outlined"
                              icon={<School fontSize="small" />}
                            />
                            {teacher.subjects?.slice(0, 2).map((subject, index) => (
                              <Chip
                                key={index}
                                label={subject}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                            {teacher.subjects?.length > 2 && (
                              <Tooltip title={teacher.subjects.slice(2).join(', ')}>
                                <Chip
                                  label={`+${teacher.subjects.length - 2}`}
                                  size="small"
                                />
                              </Tooltip>
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                            <Phone fontSize="small" color="action" sx={{ mr: 1 }} />
                            <Typography variant="body2" color="text.secondary">
                              {teacher.phone || 'Phone not provided'}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                ))}
              </Grid>
            </Collapse>
          </Paper>
        </motion.div>
      )}

      {selectedTeacher && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 3 }}>
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
                onClick={() => toggleSection('filter')}
              >
                <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center' }}>
                  <FilterList color="secondary" sx={{ mr: 1 }} />
                  Find Students for {selectedTeacher.name}
                </Typography>
                {expandedSection.filter ? <ExpandLess /> : <ExpandMore />}
              </Box>

              <Collapse in={expandedSection.filter}>
                <Divider sx={{ my: 2 }} />
                
                <Tabs 
                  value={searchTab} 
                  onChange={handleTabChange} 
                  centered
                  sx={{ mb: 3 }}
                >
                  <Tab label="Filter Students" value="filter" icon={<FilterList />} />
                  <Tab label="Search by Name" value="search" icon={<Search />} />
                </Tabs>

                {searchTab === 'filter' ? (
                  <Grid container spacing={2} alignItems="flex-end">
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <InputLabel>Department</InputLabel>
                        <Select
                          value={filterInputs.department}
                          label="Department"
                          onChange={(e) =>
                            setFilterInputs((prev) => ({
                              ...prev,
                              department: e.target.value
                            }))
                          }
                          MenuProps={{
                            PaperProps: {
                              style: {
                                maxHeight: 300,
                                minWidth: 250,
                              },
                            },
                          }}
                          sx={{
                            '& .MuiSelect-select': {
                              minWidth: '120px'
                            }
                          }}
                        >
                          {departments.map((dept) => (
                            <MenuItem key={dept} value={dept} sx={{ minWidth: 250 }}>
                              {dept}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <InputLabel>Year</InputLabel>
                        <Select
                          value={filterInputs.year}
                          label="Year"
                          onChange={(e) =>
                            setFilterInputs((prev) => ({
                              ...prev,
                              year: e.target.value
                            }))
                          }
                          MenuProps={{
                            PaperProps: {
                              style: {
                                maxHeight: 300,
                                minWidth: 250,
                              },
                            },
                          }}
                          sx={{
                            '& .MuiSelect-select': {
                              minWidth: '120px'
                            }
                          }}
                        >
                          {years.map((yr) => (
                            <MenuItem key={yr} value={yr} sx={{ minWidth: 250 }}>
                              {yr}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Batch"
                        value={filterInputs.batch}
                        onChange={(e) =>
                          setFilterInputs((prev) => ({
                            ...prev,
                            batch: e.target.value
                          }))
                        }
                        fullWidth
                        sx={{
                          '& .MuiInputBase-root': {
                              minWidth: '120px'
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Zoom in={true}>
                        <Button
                          variant="contained"
                          color="secondary"
                          onClick={handleFilterStudents}
                          fullWidth
                          sx={{ height: '56px', mt: 1 }}
                          disabled={loading.global}
                          startIcon={loading.global ? <CircularProgress size={20} color="inherit" /> : null}
                        >
                          {loading.global ? 'Filtering...' : 'Filter Students'}
                        </Button>
                      </Zoom>
                    </Grid>
                  </Grid>
                ) : (
                  <Grid container spacing={2} alignItems="flex-end">
                    <Grid item xs={12}>
                      <TextField
                        label="Student Name"
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        fullWidth
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Person color="action" />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Zoom in={true}>
                        <Button
                          variant="contained"
                          color="secondary"
                          onClick={handleSearchByName}
                          fullWidth
                          sx={{ height: '56px', mt: 1 }}
                          disabled={loading.searching}
                          startIcon={loading.searching ? <CircularProgress size={20} color="inherit" /> : <Search />}
                        >
                          {loading.searching ? 'Searching...' : 'Search Students'}
                        </Button>
                      </Zoom>
                    </Grid>
                  </Grid>
                )}
              </Collapse>
            </Paper>
          </motion.div>

          {filteredStudents.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center' }}>
                    <Person color="primary" sx={{ mr: 1 }} />
                    {filteredStudents.length} Students Found
                  </Typography>
                  {searchTab === 'filter' && (
                    <Zoom in={true}>
                      <Button
                        variant="contained"
                        onClick={() => handleAssignMentor()}
                        startIcon={<AssignmentInd />}
                        disabled={loading.global}
                        sx={{
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 500
                        }}
                      >
                        {loading.global ? 'Assigning...' : 'Assign All'}
                      </Button>
                    </Zoom>
                  )}
                </Box>
                <List dense>
                  {filteredStudents.map((student) => (
                    <motion.div
                      key={student.email}
                      whileHover={{ scale: 1.005 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ListItem 
                        sx={{
                          bgcolor: theme.palette.action.hover,
                          mb: 1,
                          borderRadius: 2,
                          '&:hover': {
                            bgcolor: theme.palette.action.selected
                          }
                        }}
                        secondaryAction={
                          <Tooltip title={assignedStudents.includes(student.email) ? "Already assigned" : "Assign mentor"}>
                            <span>
                              <Button
                                variant="contained"
                                size="small"
                                color={assignedStudents.includes(student.email) ? "success" : "primary"}
                                startIcon={
                                  loading.assigning[student.email] ? (
                                    <CircularProgress size={16} color="inherit" />
                                  ) : assignedStudents.includes(student.email) ? (
                                    <CheckCircle />
                                  ) : (
                                    <PersonAdd />
                                  )
                                }
                                onClick={() => !assignedStudents.includes(student.email) && handleAssignMentor(student.email)}
                                disabled={loading.assigning[student.email] || assignedStudents.includes(student.email)}
                                sx={{
                                  borderRadius: 2,
                                  textTransform: 'none',
                                  fontWeight: 500
                                }}
                              >
                                {assignedStudents.includes(student.email) ? 'Assigned' : 'Assign'}
                              </Button>
                            </span>
                          </Tooltip>
                        }
                      >
                        <ListItemAvatar>
                          <Avatar 
                            src={student.profileImage ? `data:image/jpeg;base64,${student.profileImage}` : undefined}
                            sx={{
                              bgcolor: theme.palette.primary.light,
                              color: theme.palette.primary.contrastText
                            }}
                          >
                            {student.name.charAt(0)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                              {student.name}
                            </Typography>
                          }
                          secondary={
                            <>
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                <Email fontSize="small" color="action" sx={{ mr: 1 }} />
                                <Typography variant="body2" component="span">
                                  {student.email}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                <School fontSize="small" color="action" sx={{ mr: 1 }} />
                                <Typography variant="body2" component="span">
                                  {student.department} • {student.year} • Batch {student.batch}
                                </Typography>
                              </Box>
                            </>
                          }
                        />
                      </ListItem>
                    </motion.div>
                  ))}
                </List>
              </Paper>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
                onClick={() => toggleSection('assigned')}
              >
                <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center' }}>
                  <Group color="secondary" sx={{ mr: 1 }} />
                  Students Assigned to {selectedTeacher.name}
                </Typography>
                {expandedSection.assigned ? <ExpandLess /> : <ExpandMore />}
              </Box>

              <Collapse in={expandedSection.assigned}>
                <Divider sx={{ my: 2 }} />
                {assignedStudents.length > 0 ? (
                  <List dense>
                    {assignedStudents.map((email, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                      >
                        <ListItem 
                          sx={{
                            bgcolor: idx % 2 === 0 ? theme.palette.grey[50] : 'inherit',
                            mb: 1,
                            borderRadius: 2,
                            '&:hover': {
                              bgcolor: theme.palette.action.hover
                            }
                          }}
                          secondaryAction={
                            <Tooltip title="Remove assignment">
                              <IconButton 
                                edge="end" 
                                onClick={() => handleRemoveAssignment(email)}
                                disabled={loading.removing[email]}
                              >
                                {loading.removing[email] ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <Delete color="error" />
                                )}
                              </IconButton>
                            </Tooltip>
                          }
                        >
                          <ListItemText 
                            primary={
                              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                                {email}
                              </Typography>
                            }
                            secondary={
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                <CheckCircle fontSize="small" color="success" sx={{ mr: 1 }} />
                                <Typography variant="body2" color="text.secondary">
                                  Assigned
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      </motion.div>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    p: 3,
                    textAlign: 'center'
                  }}>
                    <Cancel color="disabled" sx={{ fontSize: 60, mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                      No students assigned yet
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                      Use the filter or search above to find students and assign them to this teacher
                    </Typography>
                  </Box>
                )}
              </Collapse>
            </Paper>
          </motion.div>
        </>
      )}
    </Box>
  );
};