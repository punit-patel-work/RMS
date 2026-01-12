// Quick script to check if your environment variables are set correctly
import 'dotenv/config';

console.log('🔍 Checking environment variables...\n');

const requiredVars = {
    'DATABASE_URL': process.env.DATABASE_URL,
    'AUTH_SECRET': process.env.AUTH_SECRET,
    'AUTH_URL': process.env.AUTH_URL,
    'GMAIL_USER': process.env.GMAIL_USER,
    'GMAIL_PASS': process.env.GMAIL_PASS,
    'OWNER_EMAIL': process.env.OWNER_EMAIL,
};

const oldVars = {
    'NEXTAUTH_SECRET': process.env.NEXTAUTH_SECRET,
    'NEXTAUTH_URL': process.env.NEXTAUTH_URL,
};

let hasIssues = false;

// Check for old variables
console.log('❌ Old NextAuth v4 variables (should NOT be present):');
for (const [key, value] of Object.entries(oldVars)) {
    if (value) {
        console.log(`  ⚠️  ${key} is set (should be removed)`);
        hasIssues = true;
    } else {
        console.log(`  ✅ ${key} is not set (good)`);
    }
}

console.log('\n✅ Required NextAuth v5 variables:');
for (const [key, value] of Object.entries(requiredVars)) {
    if (value) {
        console.log(`  ✅ ${key} is set`);
    } else {
        console.log(`  ❌ ${key} is MISSING`);
        hasIssues = true;
    }
}

if (hasIssues) {
    console.log('\n⚠️  Issues found! Please update your .env file.');
    console.log('\nRequired changes:');
    console.log('1. Remove: NEXTAUTH_SECRET and NEXTAUTH_URL');
    console.log('2. Add: AUTH_SECRET and AUTH_URL');
    console.log('\nSee .env.example for the correct format.');
} else {
    console.log('\n🎉 All environment variables are correctly configured!');
}
