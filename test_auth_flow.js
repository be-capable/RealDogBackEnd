const BASE_URL = 'http://localhost:3000/auth';

async function test() {
  const email = `test${Date.now()}@example.com`;
  const password = 'password123';

  console.log(`Using email: ${email}`);

  console.log('1. Registering...');
  const regRes = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Test User' })
  });
  
  if (regRes.status !== 201) {
    console.log('Register Failed:', await regRes.text());
    return;
  }
  const regData = await regRes.json();
  console.log('Register OK. Has AT:', !!regData.accessToken, 'Has RT:', !!regData.refreshToken);

  console.log('2. Logging in...');
  const loginRes = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (loginRes.status !== 200) {
    console.log('Login Failed:', await loginRes.text());
    return;
  }
  const loginData = await loginRes.json();
  console.log('Login OK.');

  const { accessToken, refreshToken } = loginData;

  console.log('3. Refreshing token...');
  const refreshRes = await fetch(`${BASE_URL}/refresh`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${refreshToken}`
    }
  });
  
  if (refreshRes.status !== 200) {
      console.log('Refresh Failed:', await refreshRes.text());
  } else {
      const refreshData = await refreshRes.json();
      console.log('Refresh OK.');
      console.log('New AT differs:', refreshData.accessToken !== accessToken);
      console.log('New RT differs:', refreshData.refreshToken !== refreshToken);
      
      console.log('4. Logout...');
      const logoutRes = await fetch(`${BASE_URL}/logout`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${refreshData.accessToken}`
        }
      });
      console.log('Logout:', logoutRes.status);
  }
}

test().catch(console.error);
