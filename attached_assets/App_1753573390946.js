// crisis-dashboard/src/App.js
import React, { useState, useEffect } from 'react';
import DisasterMap from './components/DisasterMap';
import ResponseViewer from './components/ResponseViewer';
import { Box, Grid, Paper, Typography, CircularProgress } from '@mui/material';
import './App.css';

function App() {
  const [disasters, setDisasters] = useState([]);
  const [selectedDisaster, setSelectedDisaster] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [disastersRes, statsRes] = await Promise.all([
          fetch('http://localhost:5000/api/disasters'),
          fetch('http://localhost:5000/api/stats')
        ]);
        
        setDisasters(await disastersRes.json());
        setStats(await statsRes.json());
      } catch (error) {
        console.error('Fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectDisaster = (disaster) => {
    setSelectedDisaster(disaster);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress size={80} />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading disaster data...</Typography>
      </Box>
    );
  }

  return (
    <div className="App">
      <Paper className="header">
        <Typography variant="h4">AI Crisis Navigator</Typography>
        <Typography>Real-time disaster response system</Typography>
      </Paper>

      <Grid container spacing={3} sx={{ p: 3 }}>
        {/* Stats Panel */}
        <Grid item xs={12} md={3}>
          <Paper className="stats-panel">
            <Typography variant="h6" gutterBottom>Global Stats</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography>Total Events:</Typography>
              <Typography fontWeight="bold">{stats?.total_events || 0}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography>Processed:</Typography>
              <Typography fontWeight="bold">{stats?.processed || 0}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography>High Severity:</Typography>
              <Typography fontWeight="bold" color="error">
                {stats?.high_severity || 0}
              </Typography>
            </Box>
            
            {selectedDisaster && (
              <Box mt={3}>
                <Typography variant="subtitle1" gutterBottom>Selected Event</Typography>
                <Typography>{selectedDisaster.raw_data?.title || 'Untitled'}</Typography>
                <Typography variant="body2" color="textSecondary">
                  {selectedDisaster.type} • Severity: {selectedDisaster.severity}/10
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Main Map */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ overflow: 'hidden' }}>
            <div className="map-container">
              <DisasterMap 
                disasters={disasters} 
                onSelect={handleSelectDisaster} 
              />
            </div>
          </Paper>
        </Grid>
        
        {/* Response Viewer */}
        <Grid item xs={12} md={3}>
          <Paper className="response-viewer">
            <ResponseViewer disaster={selectedDisaster} />
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default App;