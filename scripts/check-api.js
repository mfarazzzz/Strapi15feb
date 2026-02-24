
const axios = require('axios');

async function check() {
  try {
    const response = await axios.get('http://localhost:1337/api/articles/featured');
    console.log('Featured Articles:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error fetching featured articles:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

check();
