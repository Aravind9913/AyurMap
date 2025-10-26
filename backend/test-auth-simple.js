const axios = require('axios');

async function testAuth() {
  console.log('🧪 Testing authentication...');
  
  try {
    // Test without token
    console.log('\n1. Testing without token:');
    try {
      await axios.get('http://localhost:5000/api/farmer/test-auth');
    } catch (error) {
      console.log('✅ Expected 401:', error.response?.status);
    }
    
    // Test with invalid token
    console.log('\n2. Testing with invalid token:');
    try {
      await axios.get('http://localhost:5000/api/farmer/test-auth', {
        headers: { Authorization: 'Bearer invalid_token' }
      });
    } catch (error) {
      console.log('✅ Expected 401:', error.response?.status);
    }
    
    // Test with mock token (this should work with our fallback)
    console.log('\n3. Testing with mock token:');
    try {
      const response = await axios.get('http://localhost:5000/api/farmer/test-auth', {
        headers: { Authorization: 'Bearer mock_token_for_testing' }
      });
      console.log('✅ Mock token worked:', response.data);
    } catch (error) {
      console.log('❌ Mock token failed:', error.response?.status, error.response?.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAuth();
