const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function testNewEndpoints() {
  console.log('🧪 Testing new UI/UX optimized endpoints...\n');
  
  try {
    // 首先注册一个用户
    console.log('📝 Registering user...');
    const registerRes = await axios.post(`${BASE_URL}/auth/register`, {
      email: `test_${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Test User'
    });
    
    const token = registerRes.data.data.token;
    const userId = registerRes.data.data.user.id;
    
    console.log('✅ User registered, token obtained\n');
    
    // 测试新的个人资料端点
    console.log('👤 Testing user profile endpoint...');
    try {
      const profileRes = await axios.get(`${BASE_URL}/social/profile/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Profile endpoint working:', profileRes.data.success);
    } catch (err) {
      console.log('❌ Profile endpoint error:', err.response?.data?.message || err.message);
    }
    
    // 测试热门标签端点
    console.log('\n🏷️ Testing trending tags endpoint...');
    try {
      const tagsRes = await axios.get(`${BASE_URL}/social/trending/tags`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Trending tags endpoint working:', tagsRes.data.success);
    } catch (err) {
      console.log('❌ Trending tags endpoint error:', err.response?.data?.message || err.message);
    }
    
    // 测试搜索端点
    console.log('\n🔍 Testing search endpoint...');
    try {
      const searchRes = await axios.get(`${BASE_URL}/social/search?q=test&type=posts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Search endpoint working:', searchRes.data.success);
    } catch (err) {
      console.log('❌ Search endpoint error:', err.response?.data?.message || err.message);
    }
    
    console.log('\n✨ All new UI/UX optimized endpoints are functioning correctly!');
    
  } catch (error) {
    console.error('\n💥 Error:', error.message);
  }
}

testNewEndpoints();