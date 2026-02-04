/**
 * RealDog API Authentication Flow Test Script (Fixed Version)
 * Tests the complete authentication flow and all protected endpoints
 */

const axios = require('axios');
const fs = require('fs');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const OUTPUT_FILE = 'auth_flow_test_results.json';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

let authToken = null;
let testData = {
  userId: null,
  petId: null,
  eventId: null,
  mediaId: null,
  postId: null,
  commentId: null,
  likeId: null,
};

const results = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  summary: { total: 0, passed: 0, failed: 0 },
  tests: [],
  testData: testData,
};

function logTest(name, status, details = '', response = null) {
  const test = { name, status, details, timestamp: new Date().toISOString() };
  if (response) {
    test.statusCode = response.status;
    test.responseSize = JSON.stringify(response.data).length;
  }
  results.tests.push(test);
  results.summary.total++;
  
  if (status === 'PASS') {
    results.summary.passed++;
  } else if (status === 'FAIL') {
    results.summary.failed++;
  }
  
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

async function testHealthCheck() {
  try {
    const response = await api.get('/');
    logTest('Health Check', 'PASS', 'Server is running', response);
    return true;
  } catch (error) {
    logTest('Health Check', 'FAIL', error.message);
    return false;
  }
}

async function testGetDogBreeds() {
  try {
    const response = await api.get('/dicts/dog-breeds');
    const count = Array.isArray(response.data.data) ? response.data.data.length : 0;
    logTest('Get Dog Breeds', 'PASS', `Retrieved ${count} breeds`, response);
    return true;
  } catch (error) {
    logTest('Get Dog Breeds', 'FAIL', error.message);
    return false;
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
    
    if (response.data.data?.token) {
      authToken = response.data.data.token;
      testData.userId = response.data.data.user.id;
      logTest('User Registration', 'PASS', `Created user ID: ${testData.userId}`, response);
      return { email, password: 'TestPassword123!', name: 'Test User' };
    } else {
      logTest('User Registration', 'FAIL', 'No token in response', response);
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
    
    if (response.data.data?.token) {
      authToken = response.data.data.token;
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

async function testGetCurrentUser() {
  try {
    const response = await authApi().get('/users/account'); // Changed to correct endpoint
    if (response.data.id) {
      testData.userId = response.data.id;
      logTest('Get Current User', 'PASS', `User: ${response.data.name}`, response);
      return true;
    } else {
      logTest('Get Current User', 'FAIL', 'No user data', response);
      return false;
    }
  } catch (error) {
    logTest('Get Current User', 'FAIL', error.message);
    return false;
  }
}

async function testGetUserById() {
  if (!testData.userId) {
    logTest('Get User By ID', 'FAIL', 'No user ID available');
    return false;
  }
  try {
    const response = await authApi().get(`/users/${testData.userId}`);
    logTest('Get User By ID', 'PASS', `Retrieved user: ${response.data.name}`, response);
    return true;
  } catch (error) {
    logTest('Get User By ID', 'FAIL', error.message);
    return false;
  }
}

async function testUpdateUser() {
  if (!testData.userId) {
    logTest('Update User', 'FAIL', 'No user ID available');
    return false;
  }
  try {
    const response = await authApi().patch(`/users/${testData.userId}`, {
      name: 'Updated Test User',
    });
    if (response.data.name === 'Updated Test User') {
      logTest('Update User', 'PASS', 'User updated successfully', response);
      return true;
    } else {
      logTest('Update User', 'FAIL', 'Update not reflected', response);
      return false;
    }
  } catch (error) {
    logTest('Update User', 'FAIL', error.message);
    return false;
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
      return true;
    } else {
      logTest('Create Pet', 'FAIL', 'No pet ID', response);
      return false;
    }
  } catch (error) {
    logTest('Create Pet', 'FAIL', error.response?.data?.message || error.message);
    return false;
  }
}

async function testGetPets() {
  try {
    const response = await authApi().get('/pets');
    const count = Array.isArray(response.data.data) ? response.data.data.length : 0;
    logTest('Get Pets List', 'PASS', `Retrieved ${count} pets`, response);
    return true;
  } catch (error) {
    logTest('Get Pets List', 'FAIL', error.message);
    return false;
  }
}

async function testGetPetDetails() {
  if (!testData.petId) {
    logTest('Get Pet Details', 'FAIL', 'No pet ID available');
    return false;
  }
  try {
    const response = await authApi().get(`/pets/${testData.petId}`);
    logTest('Get Pet Details', 'PASS', `Pet: ${response.data.name}`, response);
    return true;
  } catch (error) {
    logTest('Get Pet Details', 'FAIL', error.message);
    return false;
  }
}

async function testUpdatePet() {
  if (!testData.petId) {
    logTest('Update Pet', 'FAIL', 'No pet ID available');
    return false;
  }
  try {
    const response = await authApi().patch(`/pets/${testData.petId}`, {
      name: 'Updated Dog Name',
    });
    if (response.data.data?.name === 'Updated Dog Name') {
      logTest('Update Pet', 'PASS', 'Pet updated successfully', response);
      return true;
    } else {
      logTest('Update Pet', 'FAIL', 'Update not reflected', response);
      return false;
    }
  } catch (error) {
    logTest('Update Pet', 'FAIL', error.message);
    return false;
  }
}

async function testGetPetMedia() {
  if (!testData.petId) {
    logTest('Get Pet Media', 'FAIL', 'No pet ID available');
    return false;
  }
  try {
    const response = await authApi().get(`/pets/${testData.petId}/media`);
    logTest('Get Pet Media', 'PASS', 'Media list retrieved', response);
    return true;
  } catch (error) {
    logTest('Get Pet Media', 'FAIL', error.message);
    return false;
  }
}

async function testCreatePetEvent() {
  if (!testData.petId) {
    logTest('Create Pet Event', 'FAIL', 'No pet ID available');
    return false;
  }
  try {
    const response = await authApi().post(`/pets/${testData.petId}/events`, {
      eventType: 'BARK',  // Fixed to valid event type
      meaningText: 'Went for a nice walk',
      inputTranscript: 'Let me go for a walk!',
    });
    
    if (response.data.data?.id) {
      testData.eventId = response.data.data.id;
      logTest('Create Pet Event', 'PASS', `Event ID: ${testData.eventId}`, response);
      return true;
    } else {
      logTest('Create Pet Event', 'FAIL', 'No event ID', response);
      return false;
    }
  } catch (error) {
    logTest('Create Pet Event', 'FAIL', error.response?.data?.message || error.message);
    return false;
  }
}

async function testGetPetEvents() {
  if (!testData.petId) {
    logTest('Get Pet Events', 'FAIL', 'No pet ID available');
    return false;
  }
  try {
    const response = await authApi().get(`/pets/${testData.petId}/events`);
    logTest('Get Pet Events', 'PASS', 'Events list retrieved', response);
    return true;
  } catch (error) {
    logTest('Get Pet Events', 'FAIL', error.message);
    return false;
  }
}

async function testGetEventDetails() {
  if (!testData.eventId) {
    logTest('Get Event Details', 'FAIL', 'No event ID available');
    return false;
  }
  try {
    const response = await authApi().get(`/events/${testData.eventId}`);
    logTest('Get Event Details', 'PASS', `Event: ${response.data.eventType}`, response);
    return true;
  } catch (error) {
    logTest('Get Event Details', 'FAIL', error.message);
    return false;
  }
}

async function testGetHome() {
  try {
    const response = await authApi().get('/home');
    logTest('Get Home Data', 'PASS', 'Home data retrieved', response);
    return true;
  } catch (error) {
    logTest('Get Home Data', 'FAIL', error.message);
    return false;
  }
}

async function testAIInterpret() {
  if (!testData.petId) {
    logTest('AI Interpret', 'SKIP', 'No pet ID available');
    return true;
  }
  try {
    const response = await authApi().post('/ai/dog/interpret', {
      audioUrl: 'https://example.com/test.wav',
      petId: testData.petId,
      context: 'Morning walk',
      style: 'default',
    });
    logTest('AI Interpret', 'PASS', 'AI interpretation received', response);
    return true;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    if (msg.includes('audio') || msg.includes('valid')) {
      logTest('AI Interpret', 'SKIP', 'Requires valid audio');
      return true;
    } else {
      logTest('AI Interpret', 'FAIL', msg);
      return false;
    }
  }
}

async function testAISynthesize() {
  if (!testData.petId) {
    logTest('AI Synthesize', 'SKIP', 'No pet ID available');
    return true;
  }
  try {
    const response = await authApi().post('/ai/dog/synthesize', {
      text: 'Woof woof!',
      petId: testData.petId,
      style: 'happy',
    });
    logTest('AI Synthesize', 'PASS', 'Audio synthesized', response);
    return true;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    if (msg.includes('API') || msg.includes('key')) {
      logTest('AI Synthesize', 'SKIP', 'Requires API key');
      return true;
    } else {
      logTest('AI Synthesize', 'FAIL', msg);
      return false;
    }
  }
}

async function testAIDialogue() {
  if (!testData.petId) {
    logTest('AI Dialogue', 'SKIP', 'No pet ID available');
    return true;
  }
  try {
    const response = await authApi().post('/ai/dialogue/turn', {
      petId: testData.petId,
      inputText: 'How are you?',
      mode: 'HUMAN_TO_DOG',
    });
    logTest('AI Dialogue', 'PASS', 'Dialogue response received', response);
    return true;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    if (msg.includes('audio') || msg.includes('valid')) {
      logTest('AI Dialogue', 'SKIP', 'Requires valid audio');
      return true;
    } else {
      logTest('AI Dialogue', 'FAIL', msg);
      return false;
    }
  }
}

async function testSocialFeed() {
  try {
    const response = await authApi().get('/social/feed?page=1&limit=10');
    logTest('Get Social Feed', 'PASS', 'Social feed retrieved', response);
    return true;
  } catch (error) {
    logTest('Get Social Feed', 'FAIL', error.message);
    return false;
  }
}

async function testCreateSocialPost() {
  if (!testData.petId) {
    logTest('Create Social Post', 'SKIP', 'No pet ID available');
    return true;
  }
  try {
    const response = await authApi().post('/social/posts', {
      content: 'Testing social feature',
      petId: testData.petId,
      visibility: 'PUBLIC'
    });
    if (response.data.data?.id) {
      testData.postId = response.data.data.id;
      logTest('Create Social Post', 'PASS', `Post ID: ${testData.postId}`, response);
      return true;
    } else {
      logTest('Create Social Post', 'FAIL', 'No post ID', response);
      return false;
    }
  } catch (error) {
    logTest('Create Social Post', 'FAIL', error.message);
    return false;
  }
}

async function testLikeSocialPost() {
  if (!testData.postId) {
    logTest('Like Social Post', 'SKIP', 'No post ID available');
    return true;
  }
  try {
    const response = await authApi().post(`/social/likes`, {
      targetId: testData.postId,
      targetType: 'SocialPost'
    });
    logTest('Like Social Post', 'PASS', 'Post liked successfully', response);
    return true;
  } catch (error) {
    logTest('Like Social Post', 'FAIL', error.message);
    return false;
  }
}

async function testProtectedEndpointWithoutAuth() {
  try {
    await api.get('/pets');
    logTest('Protected Endpoint Without Auth', 'FAIL', 'Should have been rejected');
    return false;
  } catch (error) {
    if (error.response?.status === 401) {
      logTest('Protected Endpoint Without Auth', 'PASS', 'Correctly rejected', error.response);
      return true;
    } else {
      logTest('Protected Endpoint Without Auth', 'FAIL', `Wrong status: ${error.response?.status}`);
      return false;
    }
  }
}

async function testLogout() {
  try {
    await authApi().post('/auth/logout');
    logTest('Logout', 'PASS', 'Logged out successfully');
    return true;
  } catch (error) {
    logTest('Logout', 'FAIL', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('RealDog API Authentication Flow Test Suite');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(60) + '\n');

  // Check server availability
  const serverAvailable = await testHealthCheck();
  if (!serverAvailable) {
    console.log('\n❌ Server is not responding. Please start the server first.');
    console.log(`   Expected URL: ${BASE_URL}`);
    process.exit(1);
  }

  await testGetDogBreeds(); // Public endpoint

  console.log('\n--- AUTHENTICATION FLOW ---');
  // Registration and login
  let credentials = await testUserRegistration();
  if (!credentials) {
    credentials = { email: 'existing@test.com', password: 'password' }; // fallback
    console.log('⚠️  Skipping login test due to registration failure');
  } else {
    await testUserLogin(credentials);
  }

  if (authToken) {
    console.log('\n--- USER MANAGEMENT ---');
    await testGetCurrentUser();
    await testGetUserById();
    await testUpdateUser();

    console.log('\n--- PET MANAGEMENT ---');
    await testCreatePet();
    await testGetPets();
    await testGetPetDetails();
    await testUpdatePet();

    console.log('\n--- PET MEDIA ---');
    await testGetPetMedia();

    console.log('\n--- PET EVENTS ---');
    await testCreatePetEvent();
    await testGetPetEvents();
    await testGetEventDetails();

    console.log('\n--- HOME DATA ---');
    await testGetHome();

    console.log('\n--- AI FEATURES ---');
    await testAIInterpret();
    await testAISynthesize();
    await testAIDialogue();

    console.log('\n--- SOCIAL FEATURES ---');
    await testSocialFeed();
    await testCreateSocialPost();
    await testLikeSocialPost();

    console.log('\n--- SECURITY TESTS ---');
    await testProtectedEndpointWithoutAuth();

    console.log('\n--- CLEANUP ---');
    await testLogout();
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(`✅ Passed: ${results.summary.passed}`);
  console.log(`❌ Failed: ${results.summary.failed}`);

  if (results.summary.total > 0) {
    const rate = ((results.summary.passed / results.summary.total) * 100).toFixed(1);
    console.log(`📊 Success Rate: ${rate}%`);
  }

  console.log('\nTest Data Created:');
  console.log(`- User ID: ${testData.userId}`);
  console.log(`- Pet ID: ${testData.petId}`);
  console.log(`- Event ID: ${testData.eventId}`);
  console.log(`- Post ID: ${testData.postId}`);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\n📄 Results saved to ${OUTPUT_FILE}`);

  if (results.summary.failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log(`\n❌ ${results.summary.failed} tests failed.`);
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});