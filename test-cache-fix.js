#!/usr/bin/env node

/**
 * Test script to verify cache behavior in the expandable-blocks API
 * This script makes multiple requests to the same endpoint to test if cache hits are working
 */

const axios = require('axios');

const API_BASE = 'http://localhost:8055';
const TOKEN = 'd1r3ctu5'; // Update with your actual token
const COLLECTION = 'pages'; // Test collection

async function testCacheHits() {
    console.log('Testing cache behavior for expandable-blocks API...\n');
    
    const config = {
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
        }
    };
    
    try {
        // Test 1: Metadata endpoint
        console.log('=== Testing Metadata Endpoint ===');
        console.log('Making first request (should be cache MISS)...');
        
        let start = Date.now();
        const response1 = await axios.get(`${API_BASE}/expandable-blocks/${COLLECTION}/metadata`, config);
        let duration1 = Date.now() - start;
        
        console.log(`First request completed in ${duration1}ms`);
        console.log('Response keys:', Object.keys(response1.data));
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('\nMaking second request (should be cache HIT)...');
        start = Date.now();
        const response2 = await axios.get(`${API_BASE}/expandable-blocks/${COLLECTION}/metadata`, config);
        let duration2 = Date.now() - start;
        
        console.log(`Second request completed in ${duration2}ms`);
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('\nMaking third request (should be cache HIT)...');
        start = Date.now();
        const response3 = await axios.get(`${API_BASE}/expandable-blocks/${COLLECTION}/metadata`, config);
        let duration3 = Date.now() - start;
        
        console.log(`Third request completed in ${duration3}ms`);
        
        // Analysis
        console.log('\n=== Cache Performance Analysis ===');
        console.log(`First request (cold cache): ${duration1}ms`);
        console.log(`Second request (warm cache): ${duration2}ms`);
        console.log(`Third request (warm cache): ${duration3}ms`);
        
        if (duration2 < duration1 * 0.5 && duration3 < duration1 * 0.5) {
            console.log('✅ Cache appears to be working! Subsequent requests are significantly faster.');
        } else {
            console.log('⚠️  Cache may not be working properly. Times are not significantly different.');
        }
        
        console.log(`\nSpeed improvement: ${Math.round((1 - duration2/duration1) * 100)}% for second request`);
        console.log(`Speed improvement: ${Math.round((1 - duration3/duration1) * 100)}% for third request`);
        
        // Test 2: Items endpoint with usage
        console.log('\n\n=== Testing Items Endpoint with Usage ===');
        
        // First get some item IDs
        const itemsResponse = await axios.get(`${API_BASE}/items/${COLLECTION}?limit=3`, config);
        const itemIds = itemsResponse.data.data.map(item => item.id);
        
        if (itemIds.length > 0) {
            console.log(`Testing with item IDs: ${itemIds.join(', ')}`);
            
            console.log('\nMaking first request (should be cache MISS)...');
            start = Date.now();
            await axios.post(`${API_BASE}/expandable-blocks/${COLLECTION}/items`, {
                ids: itemIds,
                fields: 'id,title,status'
            }, config);
            duration1 = Date.now() - start;
            console.log(`First request completed in ${duration1}ms`);
            
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 100));
            
            console.log('\nMaking second request (should have some cache HITS)...');
            start = Date.now();
            await axios.post(`${API_BASE}/expandable-blocks/${COLLECTION}/items`, {
                ids: itemIds,
                fields: 'id,title,status'
            }, config);
            duration2 = Date.now() - start;
            console.log(`Second request completed in ${duration2}ms`);
            
            console.log(`\nSpeed improvement: ${Math.round((1 - duration2/duration1) * 100)}% for second request`);
        }
        
    } catch (error) {
        console.error('Error during testing:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testCacheHits().catch(console.error);