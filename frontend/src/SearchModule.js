import React from 'react';
import {
  TextField,
  Button,
  Card,
  CardHeader,
  CardContent,
  Grid,
  Typography,
  Avatar,
  Chip,
  Box,
  Paper,
  Divider,
  useTheme,
  Fade,
  Zoom,
  InputAdornment,
  CircularProgress,
  Tabs,
  Tab,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import { Search, Person, School, Email, Phone, Home, Groups, Badge, Info, Description, SupervisorAccount } from '@mui/icons-material';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { motion } from 'framer-motion';

export const SearchModule = ({ setAlert }) => {
  const theme = useTheme();
  const [searchInputs, setSearchInputs] = React.useState({ student: '', teacher: '' });
  const [searchType, setSearchType] = React.useState({ student: 'email', teacher: 'email' });
  const [searchedStudent, setSearchedStudent] = React.useState(null);
  const [searchedTeacher, setSearchedTeacher] = React.useState(null);
  const [mentorName, setMentorName] = React.useState('Loading...');
  const [isSearching, setIsSearching] = React.useState({ student: false, teacher: false });
  const [searchResults, setSearchResults] = React.useState({ student: [], teacher: [] });
  const [activeTab, setActiveTab] = React.useState('student');

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const fetchMentorName = async (mentorEmail) => {
    if (!mentorEmail) {
      setMentorName('N/A');
      return;
    }

    try {
      const mentorDoc = await getDoc(doc(db, 'teachers', mentorEmail));
      if (mentorDoc.exists()) {
        setMentorName(mentorDoc.data().name || 'N/A');
      } else {
        setMentorName('Not Found');
      }
    } catch (error) {
      console.error("Error fetching mentor:", error);
      setMentorName('Error loading');
    }
  };

  const handleSearch = async (type) => {
    const searchTerm = searchInputs[type].trim();
    if (!searchTerm) {
      setAlert({ open: true, message: 'Please enter a search term', severity: 'warning' });
      return;
    }

    try {
      setIsSearching(prev => ({ ...prev, [type]: true }));
      
      // Clear previous search results
      if (type === 'student') {
        setSearchedTeacher(null);
      } else {
        setSearchedStudent(null);
      }

      if (searchType[type] === 'email') {
        // Email search (direct document fetch)
        if (!isValidEmail(searchTerm)) {
          setAlert({ open: true, message: 'Enter a valid email.', severity: 'warning' });
          return;
        }

        const docSnap = await getDoc(doc(db, type === 'student' ? 'students' : 'teachers', searchTerm.toLowerCase()));

        if (docSnap.exists()) {
          const data = docSnap.data();
          handleSearchResult(type, data, searchTerm);
        } else {
          setAlert({ 
            open: true, 
            message: `${type.charAt(0).toUpperCase() + type.slice(1)} not found!`, 
            severity: 'error' 
          });
        }
      } else {
        // Name search (query)
        const collectionRef = collection(db, type === 'student' ? 'students' : 'teachers');
        const q = query(collectionRef, where('name', '>=', searchTerm), where('name', '<=', searchTerm + '\uf8ff'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setAlert({ 
            open: true, 
            message: `No ${type}s found with that name`, 
            severity: 'error' 
          });
          setSearchResults(prev => ({ ...prev, [type]: [] }));
        } else {
          const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setSearchResults(prev => ({ ...prev, [type]: results }));
          
          if (results.length === 1) {
            // If only one result, automatically display it
            handleSearchResult(type, results[0], results[0].email);
          } else {
            setAlert({ 
              open: true, 
              message: `Found ${results.length} ${type}s`, 
              severity: 'info' 
            });
          }
        }
      }
    } catch (error) {
      console.error("Error searching:", error);
      setAlert({ 
        open: true, 
        message: 'Error occurred while searching.', 
        severity: 'error' 
      });
    } finally {
      setIsSearching(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleSearchResult = (type, data, email) => {
    if (type === 'teacher') {
      setSearchedTeacher({ ...data, email });
      setSearchInputs(prev => ({ ...prev, student: '' }));
    } else {
      setSearchedStudent({ ...data, email });
      setSearchInputs(prev => ({ ...prev, teacher: '' }));
      if (data.mentoremail) {
        fetchMentorName(data.mentoremail);
      } else {
        setMentorName('N/A');
      }
    }
    setAlert({ 
      open: true, 
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} found!`, 
      severity: 'success' 
    });
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ 
        fontWeight: 600,
        color: theme.palette.primary.dark,
        mb: 4,
        textAlign: 'center'
      }}>
        User Search
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} centered>
          <Tab label="Student Search" value="student" icon={<School />} iconPosition="start" />
          <Tab label="Teacher Search" value="teacher" icon={<SupervisorAccount />} iconPosition="start" />
        </Tabs>
      </Box>

      <Grid container spacing={3} justifyContent="center">
        <Grid item xs={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
              {activeTab === 'student' ? (
                <>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                    <School color="primary" sx={{ mr: 1 }} />
                    Search Students
                  </Typography>
                  
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={3}>
                      <FormControl fullWidth>
                        <InputLabel>Search By</InputLabel>
                        <Select
                          value={searchType.student}
                          onChange={(e) => setSearchType(prev => ({ ...prev, student: e.target.value }))}
                          label="Search By"
                        >
                          <MenuItem value="email">Email</MenuItem>
                          <MenuItem value="name">Name</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={7}>
                      <TextField
                        label={searchType.student === 'email' ? 'Student Email' : 'Student Name'}
                        variant="outlined"
                        value={searchInputs.student}
                        onChange={(e) => setSearchInputs(prev => ({ ...prev, student: e.target.value }))}
                        fullWidth
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              {searchType.student === 'email' ? <Email color="action" /> : <Badge color="action" />}
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => handleSearch('student')}
                        startIcon={isSearching.student ? <CircularProgress size={20} color="inherit" /> : <Search />}
                        disabled={isSearching.student}
                        fullWidth
                        sx={{
                          height: '56px',
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 500
                        }}
                      >
                        {isSearching.student ? 'Searching...' : 'Search'}
                      </Button>
                    </Grid>
                  </Grid>
                  
                  {searchType.student === 'name' && searchResults.student.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Search Results ({searchResults.student.length})
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                        {searchResults.student.map((student, index) => (
                          <Box 
                            key={index} 
                            sx={{ 
                              p: 1.5, 
                              mb: 1, 
                              borderRadius: 1, 
                              backgroundColor: theme.palette.grey[100],
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: theme.palette.grey[200]
                              }
                            }}
                            onClick={() => handleSearchResult('student', student, student.email)}
                          >
                            <Typography fontWeight="medium">{student.name}</Typography>
                            <Typography variant="body2" color="text.secondary">{student.email}</Typography>
                            <Typography variant="body2">Roll No: {student.rollno || 'N/A'}</Typography>
                          </Box>
                        ))}
                      </Paper>
                    </Box>
                  )}
                </>
              ) : (
                <>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                    <SupervisorAccount color="secondary" sx={{ mr: 1 }} />
                    Search Teachers
                  </Typography>
                  
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={3}>
                      <FormControl fullWidth>
                        <InputLabel>Search By</InputLabel>
                        <Select
                          value={searchType.teacher}
                          onChange={(e) => setSearchType(prev => ({ ...prev, teacher: e.target.value }))}
                          label="Search By"
                        >
                          <MenuItem value="email">Email</MenuItem>
                          <MenuItem value="name">Name</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={7}>
                      <TextField
                        label={searchType.teacher === 'email' ? 'Teacher Email' : 'Teacher Name'}
                        variant="outlined"
                        value={searchInputs.teacher}
                        onChange={(e) => setSearchInputs(prev => ({ ...prev, teacher: e.target.value }))}
                        fullWidth
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              {searchType.teacher === 'email' ? <Email color="action" /> : <Badge color="action" />}
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <Button
                        variant="contained"
                        color="secondary"
                        onClick={() => handleSearch('teacher')}
                        startIcon={isSearching.teacher ? <CircularProgress size={20} color="inherit" /> : <Search />}
                        disabled={isSearching.teacher}
                        fullWidth
                        sx={{
                          height: '56px',
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 500
                        }}
                      >
                        {isSearching.teacher ? 'Searching...' : 'Search'}
                      </Button>
                    </Grid>
                  </Grid>
                  
                  {searchType.teacher === 'name' && searchResults.teacher.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Search Results ({searchResults.teacher.length})
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                        {searchResults.teacher.map((teacher, index) => (
                          <Box 
                            key={index} 
                            sx={{ 
                              p: 1.5, 
                              mb: 1, 
                              borderRadius: 1, 
                              backgroundColor: theme.palette.grey[100],
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: theme.palette.grey[200]
                              }
                            }}
                            onClick={() => handleSearchResult('teacher', teacher, teacher.email)}
                          >
                            <Typography fontWeight="medium">{teacher.name}</Typography>
                            <Typography variant="body2" color="text.secondary">{teacher.email}</Typography>
                            <Typography variant="body2">Department: {teacher.department || 'N/A'}</Typography>
                          </Box>
                        ))}
                      </Paper>
                    </Box>
                  )}
                </>
              )}
            </Paper>
          </motion.div>
        </Grid>
      </Grid>

      <Box sx={{ mt: 4 }}>
        {searchedStudent && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card sx={{ 
              mb: 3, 
              borderRadius: 3,
              boxShadow: theme.shadows[4],
              borderLeft: `4px solid ${theme.palette.primary.main}`
            }}>
              <CardHeader
                avatar={
                  <Avatar
                    src={searchedStudent.profileImage ? `data:image/jpeg;base64,${searchedStudent.profileImage}` : undefined}
                    sx={{ 
                      width: 80, 
                      height: 80,
                      bgcolor: theme.palette.primary.light,
                      color: theme.palette.primary.contrastText
                    }}
                  >
                    {searchedStudent.name?.charAt(0)}
                  </Avatar>
                }
                title={
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {searchedStudent.name}
                  </Typography>
                }
                subheader={
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <Email fontSize="small" color="action" sx={{ mr: 1 }} />
                    <Typography variant="body1" color="text.secondary">
                      {searchedStudent.email}
                    </Typography>
                  </Box>
                }
                sx={{ 
                  bgcolor: theme.palette.grey[50],
                  borderBottom: `1px solid ${theme.palette.divider}`
                }}
              />
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ 
                        fontWeight: 600, 
                        mb: 1,
                        color: theme.palette.primary.dark,
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <Badge color="primary" sx={{ mr: 1 }} />
                        Student Information
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                        <Phone fontSize="small" color="action" sx={{ mr: 1.5 }} />
                        <Typography>
                          <strong>Phone:</strong> {searchedStudent.phonenumber || 'N/A'}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                        <Home fontSize="small" color="action" sx={{ mr: 1.5 }} />
                        <Typography>
                          <strong>Address:</strong> {searchedStudent.address || 'N/A'}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                        <SupervisorAccount fontSize="small" color="action" sx={{ mr: 1.5 }} />
                        <Typography>
                          <strong>Mentor:</strong> {mentorName}
                          {searchedStudent.mentoremail && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              ({searchedStudent.mentoremail})
                            </Typography>
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ 
                        fontWeight: 600, 
                        mb: 1,
                        color: theme.palette.primary.dark,
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <Groups color="primary" sx={{ mr: 1 }} />
                        Academic Details
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography>
                            <strong>Roll No:</strong> {searchedStudent.rollno || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography>
                            <strong>Department:</strong> {searchedStudent.department || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography>
                            <strong>Year:</strong> {searchedStudent.year || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography>
                            <strong>Division:</strong> {searchedStudent.division || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography>
                            <strong>Batch:</strong> {searchedStudent.batch || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography>
                            <strong>Parent Phone:</strong> {searchedStudent.parentphone || 'N/A'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {searchedTeacher && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card sx={{ 
              borderRadius: 3,
              boxShadow: theme.shadows[4],
              borderLeft: `4px solid ${theme.palette.secondary.main}`
            }}>
              <CardHeader
                avatar={
                  <Avatar
                    src={searchedTeacher.profileImage ? `data:image/jpeg;base64,${searchedTeacher.profileImage}` : undefined}
                    sx={{ 
                      width: 80, 
                      height: 80,
                      bgcolor: theme.palette.secondary.light,
                      color: theme.palette.secondary.contrastText
                    }}
                  >
                    {searchedTeacher.name?.charAt(0)}
                  </Avatar>
                }
                title={
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {searchedTeacher.name}
                  </Typography>
                }
                subheader={
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <Email fontSize="small" color="action" sx={{ mr: 1 }} />
                    <Typography variant="body1" color="text.secondary">
                      {searchedTeacher.email}
                    </Typography>
                  </Box>
                }
                sx={{ 
                  bgcolor: theme.palette.grey[50],
                  borderBottom: `1px solid ${theme.palette.divider}`
                }}
              />
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ 
                        fontWeight: 600, 
                        mb: 1,
                        color: theme.palette.secondary.dark,
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <Person color="secondary" sx={{ mr: 1 }} />
                        Personal Information
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                        <Phone fontSize="small" color="action" sx={{ mr: 1.5 }} />
                        <Typography>
                          <strong>Phone:</strong> {searchedTeacher.phone || 'N/A'}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Home fontSize="small" color="action" sx={{ mr: 1.5 }} />
                        <Typography>
                          <strong>Address:</strong> {searchedTeacher.address || 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ 
                        fontWeight: 600, 
                        mb: 1,
                        color: theme.palette.secondary.dark,
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <School color="secondary" sx={{ mr: 1 }} />
                        Professional Details
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      
                      <Typography sx={{ mb: 1.5 }}>
                        <strong>Department:</strong> {searchedTeacher.department || 'N/A'}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {searchedTeacher.department && (
                          <Chip
                            label={searchedTeacher.department}
                            color="secondary"
                            size="medium"
                            variant="outlined"
                          />
                        )}
                        {searchedTeacher.subjects?.map((subject, index) => (
                          <Chip
                            key={index}
                            label={subject}
                            color="primary"
                            size="medium"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </Box>
    </Box>
  );
};