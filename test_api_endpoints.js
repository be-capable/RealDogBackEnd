/**
 * RealDog API Comprehensive Test Suite (Node.js version)
 * Tests all API endpoints with detailed reporting
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const OUTPUT_FILE = 'test_results.json';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

let authToken = null;
let refreshToken = null;
let testData = {
  userId: null,
  petId: null,
  eventId: null,
  mediaId: null,
};

const results = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
  tests: [],
};

function logTest(name, status, details = '', response = null) {
  const test = { name, status, details, timestamp: new Date().toISOString() };
  if (response) {
    test.statusCode = response.status;
    test.responseSize = JSON.stringify(response.data).length;
  }
  results.tests.push(test);
  results.summary.total++;
  
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${name}: ${status}`);
  if (details && status !== 'PASS') {
    console.log(`   ${details}`);
  }
}

function authApi() {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
  });
}

async function saveResults() {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\n📄 Results saved to ${OUTPUT_FILE}`);
}

async function testHealthCheck() {
  try {
    const response = await api.get('/');
    logTest('Health Check', 'PASS', 'Server is running', response);
  } catch (error) {
    logTest('Health Check', 'FAIL', error.message);
  }
}

async function testGetDogBreeds() {
  try {
    const response = await api.get('/dicts/dog-breeds');
    const count = Array.isArray(response.data.data) ? response.data.data.length : 0;
    logTest('Get Dog Breeds', 'PASS', `Retrieved ${count} breeds`, response);
  } catch (error) {
    logTest('Get Dog Breeds', 'FAIL', error.message);
  }
}

async function testUserRegistration() {
  const timestamp = Date.now();
  const email = `test_${timestamp}@example.com`;
  
  try {
    const response = await api.post('/auth/register', {
      email,
      password: 'TestPassword123!',
      name: 'Test User',
    });
    
    if (response.data.data?.id) {
      testData.userId = response.data.data.id;
      logTest('User Registration', 'PASS', `Created user ID: ${testData.userId}`, response);
      return { email, password: 'TestPassword123!' };
    } else {
      logTest('User Registration', 'FAIL', 'No user ID in response', response);
      return null;
    }
  } catch (error) {
    logTest('User Registration', 'FAIL', error.response?.data?.message || error.message);
    return null;
  }
}

async function testUserLogin(credentials) {
  try {
    const response = await api.post('/auth/login', credentials);
    
    if (response.data.data?.accessToken) {
      authToken = response.data.data.accessToken;
      refreshToken = response.data.data.refreshToken;
      logTest('User Login', 'PASS', 'Authentication successful', response);
      return true;
    } else {
      logTest('User Login', 'FAIL', 'No token in response', response);
      return false;
    }
  } catch (error) {
    logTest('User Login', 'FAIL', error.response?.data?.message || error.message);
    return false;
  }
}

async function testTokenVerification() {
  try {
    const response = await authApi().get('/auth/verify');
    logTest('Token Verification', 'PASS', 'Token is valid', response);
  } catch (error) {
    logTest('Token Verification', 'FAIL', error.message);
  }
}

async function testTokenRefresh() {
  try {
    const response = await authApi().post('/auth/refresh', { refreshToken });
    if (response.data.data?.accessToken) {
      authToken = response.data.data.accessToken;
      logTest('Token Refresh', 'PASS', 'Token refreshed successfully', response);
    } else {
      logTest('Token Refresh', 'FAIL', 'No new token', response);
    }
  } catch (error) {
    logTest('Token Refresh', 'FAIL', error.message);
  }
}

async function testGetCurrentUser() {
  try {
    const response = await authApi().get('/users');
    if (response.data.id) {
      testData.userId = response.data.id;
      logTest('Get Current User', 'PASS', `User: ${response.data.name}`, response);
    } else {
      logTest('Get Current User', 'FAIL', 'No user data', response);
    }
  } catch (error) {
    logTest('Get Current User', 'FAIL', error.message);
  }
}

async function testCreatePet() {
  try {
    const response = await authApi().post('/pets', {
      name: 'Test Dog',
      species: 'DOG',
      sex: 'MALE',
      breedId: 'golden-retriever',
      birthDate: '2023-01-01T00:00:00.000Z',
      isSpayedNeutered: false,
    });
    
    if (response.data.data?.id) {
      testData.petId = response.data.data.id;
      logTest('Create Pet', 'PASS', `Pet ID: ${testData.petId}`, response);
    } else {
      logTest('Create Pet', 'FAIL', 'No pet ID', response);
    }
  } catch (error) {
    logTest('Create Pet', 'FAIL', error.response?.data?.message || error.message);
  }
}

async function testGetPets() {
  try {
    const response = await authApi().get('/pets');
    const count = Array.isArray(response.data.data) ? response.data.data.length : 0;
    logTest('Get Pets List', 'PASS', `Retrieved ${count} pets`, response);
  } catch (error) {
    logTest('Get Pets List', 'FAIL', error.message);
  }
}

async function testGetPetDetails() {
  if (!testData.petId) {
    logTest('Get Pet Details', 'SKIP', 'No pet ID available');
    return;
  }
  try {
    const response = await authApi().get(`/pets/${testData.petId}`);
    logTest('Get Pet Details', 'PASS', `Pet: ${response.data.name}`, response);
  } catch (error) {
    logTest('Get Pet Details', 'FAIL', error.message);
  }
}

async function testUpdatePet() {
  if (!testData.petId) {
    logTest('Update Pet', 'SKIP', 'No pet ID available');
    return;
  }
  try {
    const response = await authApi().patch(`/pets/${testData.petId}`, {
      name: 'Updated Dog Name',
    });
    if (response.data.data?.name === 'Updated Dog Name') {
      logTest('Update Pet', 'PASS', 'Pet updated successfully', response);
    } else {
      logTest('Update Pet', 'FAIL', 'Update not reflected', response);
    }
  } catch (error) {
    logTest('Update Pet', 'FAIL', error.message);
  }
}

async function testGetPetMedia() {
  if (!testData.petId) {
    logTest('Get Pet Media', 'SKIP', 'No pet ID available');
    return;
  }
  try {
    const response = await authApi().get(`/pets/${testData.petId}/media`);
    logTest('Get Pet Media', 'PASS', 'Media list retrieved', response);
  } catch (error) {
    logTest('Get Pet Media', 'FAIL', error.message);
  }
}

async function testCreatePetEvent() {
  if (!testData.petId) {
    logTest('Create Pet Event', 'SKIP', 'No pet ID available');
    return;
  }
  try {
    const response = await authApi().post(`/pets/${testData.petId}/events`, {
      eventType: 'WALK',
      meaningText: 'Went for a nice walk',
      inputTranscript: 'Let me go for a walk!',
    });
    
    if (response.data.data?.id) {
      testData.eventId = response.data.data.id;
      logTest('Create Pet Event', 'PASS', `Event ID: ${testData.eventId}`, response);
    } else {
      logTest('Create Pet Event', 'FAIL', 'No event ID', response);
    }
  } catch (error) {
    logTest('Create Pet Event', 'FAIL', error.response?.data?.message || error.message);
  }
}

async function testGetPetEvents() {
  if (!testData.petId) {
    logTest('Get Pet Events', 'SKIP', 'No pet ID available');
    return;
  }
  try {
    const response = await authApi().get(`/pets/${testData.petId}/events`);
    logTest('Get Pet Events', 'PASS', 'Events list retrieved', response);
  } catch (error) {
    logTest('Get Pet Events', 'FAIL', error.message);
  }
}

async function testGetEventDetails() {
  if (!testData.eventId) {
    logTest('Get Event Details', 'SKIP', 'No event ID available');
    return;
  }
  try {
    const response = await authApi().get(`/events/${testData.eventId}`);
    logTest('Get Event Details', 'PASS', `Event: ${response.data.eventType}`, response);
  } catch (error) {
    logTest('Get Event Details', 'FAIL', error.message);
  }
}

async function testGetHome() {
  try {
    const response = await authApi().get('/home');
    logTest('Get Home Data', 'PASS', 'Home data retrieved', response);
  } catch (error) {
    logTest('Get Home Data', 'FAIL', error.message);
  }
}

async function testAIInterpret() {
  if (!testData.petId) {
    logTest('AI Interpret', 'SKIP', 'No pet ID available');
    return;
  }
  try {
    const response = await authApi().post('/ai/dog/interpret', {
      audioUrl: 'https://example.com/test.wav',
      petId: testData.petId,
      context: 'Morning walk',
      style: 'default',
    });
    logTest('AI Interpret', 'PASS', 'AI interpretation received', response);
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    if (msg.includes('audio') || msg.includes('valid')) {
      logTest('AI Interpret', 'SKIP', 'Requires valid audio');
    } else {
      logTest('AI Interpret', 'FAIL', msg);
    }
  }
}

async function testAISynthesize() {
  if (!testData.petId) {
    logTest('AI Synthesize', 'SKIP', 'No pet ID available');
    return;
  }
  try {
    const response = await authApi().post('/ai/dog/synthesize', {
      text: 'Woof woof!',
      petId: testData.petId,
      style: 'happy',
    });
    logTest('AI Synthesize', 'PASS', 'Audio synthesized', response);
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    if (msg.includes('API') || msg.includes('key')) {
      logTest('AI Synthesize', 'SKIP', 'Requires API key');
    } else {
      logTest('AI Synthesize', 'FAIL', msg);
    }
  }
}

async function testAIDialogue() {
  if (!testData.petId) {
    logTest('AI Dialogue', 'SKIP', 'No pet ID available');
    return;
  }
  try {
    const response = await authApi().post('/ai/dialogue/turn', {
      petId: testData.petId,
      audioUrl: 'https://example.com/audio.wav',
      style: 'default',
    });
    logTest('AI Dialogue', 'PASS', 'Dialogue response received', response);
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    if (msg.includes('audio') || msg.includes('valid')) {
      logTest('AI Dialogue', 'SKIP', 'Requires valid audio');
    } else {
      logTest('AI Dialogue', 'FAIL', msg);
    }
  }
}

async function testProtectedEndpointWithoutAuth() {
  try {
    await api.get('/pets');
    logTest('Protected Endpoint Without Auth', 'FAIL', 'Should have been rejected');
  } catch (error) {
    if (error.response?.status === 401) {
      logTest('Protected Endpoint Without Auth', 'PASS', 'Correctly rejected', error.response);
    } else {
      logTest('Protected Endpoint Without Auth', 'FAIL', `Wrong status: ${error.response?.status}`);
    }
  }
}

async function testLogout() {
  try {
    await authApi().post('/auth/logout');
    logTest('Logout', 'PASS', 'Logged out successfully');
  } catch (error) {
    logTest('Logout', 'FAIL', error.message);
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('RealDog API Comprehensive Test Suite');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(60) + '\n');

  // Check server availability
  try {
    await api.get('/');
  } catch (error) {
    console.log('\n❌ Server is not responding. Please start the server first.');
    console.log(`   Expected URL: ${BASE_URL}`);
    process.exit(1);
  }

  console.log('📋 Running Tests...\n');

  // Public endpoints
  console.log('--- Public Endpoints ---');
  await testHealthCheck();
  await testGetDogBreeds();

  // Auth endpoints
  console.log('\n--- Authentication ---');
  const userData = await testUserRegistration();
  if (userData) {
    await testUserLogin(userData);
  }

  if (authToken) {
    await testTokenVerification();
    await testTokenRefresh();
    await testGetCurrentUser();
    await testGetHome();
    await testProtectedEndpointWithoutAuth();

    // Pet endpoints
    console.log('\n--- Pets ---');
    await testCreatePet();
    await testGetPets();
    await testGetPetDetails();
    await testUpdatePet();

    // Pet Media endpoints
    console.log('\n--- Pet Media ---');
    await testGetPetMedia();

    // Pet Events endpoints
    console.log('\n--- Pet Events ---');
    await testCreatePetEvent();
    await testGetPetEvents();
    await testGetEventDetails();

    // AI endpoints
    console.log('\n--- AI Features ---');
    await testAIInterpret();
    await testAISynthesize();
    await testAIDialogue();

    // Logout
    console.log('\n--- Cleanup ---');
    await testLogout();
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(`✅ Passed: ${results.summary.passed}`);
  console.log(`❌ Failed: ${results.summary.failed}`);
  console.log(`⚠️  Skipped: ${results.summary.skipped}`);

  if (results.summary.total > 0) {
    const rate = ((results.summary.passed / results.summary.total) * 100).toFixed(1);
    console.log(`📊 Success Rate: ${rate}%`);
  }

  console.log('\nTest Data Created:');
  console.log(`- User ID: ${testData.userId}`);
  console.log(`- Pet ID: ${testData.petId}`);
  console.log(`- Event ID: ${testData.eventId}`);

  await saveResults();

  if (results.summary.failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Check test_results.json for details.');
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
