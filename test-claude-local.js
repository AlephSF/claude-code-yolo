#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Test Claude Code execution directly without the API wrapper
async function testClaudeCode() {
  console.log('Testing Claude Code CLI directly...\n');
  
  // Check if ANTHROPIC_API_KEY is set
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set');
    process.exit(1);
  }
  
  // Simple test task
  const testTask = 'Please just respond with "Hello from Claude Code" and nothing else';
  
  // Test different argument configurations
  const testConfigs = [
    {
      name: 'Basic test with minimal flags',
      args: ['-p', testTask]
    },
    {
      name: 'Test with JSON output',
      args: ['-p', '--output-format', 'json', testTask]
    },
    {
      name: 'Test with allowed tools',
      args: [
        '-p',
        '--output-format', 'json',
        '--allowedTools', 'Bash(*)',
        '--dangerously-skip-permissions',
        testTask
      ]
    }
  ];
  
  for (const config of testConfigs) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${config.name}`);
    console.log(`Command: claude ${config.args.join(' ')}`);
    console.log(`${'='.repeat(60)}\n`);
    
    await runTest(config.args);
  }
}

function runTest(args) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    
    console.log('Starting Claude Code process...');
    
    const claudeProcess = spawn('claude', args, {
      env: {
        ...process.env,
        CLAUDE_CODE_AUTOMATION: 'true',
        CLAUDE_CODE_AUTO_APPROVE: 'true'
      },
      timeout: 30000 // 30 second timeout for testing
    });
    
    // Set a manual timeout
    const timeout = setTimeout(() => {
      timedOut = true;
      console.error('\n⏱️  Process timed out after 30 seconds');
      claudeProcess.kill('SIGTERM');
    }, 30000);
    
    claudeProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log('STDOUT:', chunk);
    });
    
    claudeProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.error('STDERR:', chunk);
    });
    
    claudeProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error('Process error:', error.message);
      resolve();
    });
    
    claudeProcess.on('exit', (code, signal) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      
      console.log('\n--- Process completed ---');
      console.log(`Exit code: ${code}`);
      console.log(`Signal: ${signal}`);
      console.log(`Duration: ${duration}ms`);
      console.log(`Timed out: ${timedOut}`);
      
      if (stdout.trim()) {
        console.log('\nFinal output:');
        console.log(stdout.trim());
      }
      
      if (stderr.trim()) {
        console.log('\nError output:');
        console.log(stderr.trim());
      }
      
      resolve();
    });
  });
}

// Also test if claude is available
console.log('Checking Claude Code installation...\n');
const versionCheck = spawn('claude', ['--version']);

versionCheck.on('error', (error) => {
  console.error('ERROR: Claude Code CLI not found or not accessible');
  console.error('Make sure Claude Code is installed: npm install -g @anthropic-ai/claude-code');
  process.exit(1);
});

versionCheck.on('exit', (code) => {
  if (code === 0) {
    console.log('✓ Claude Code CLI is installed\n');
    testClaudeCode();
  } else {
    console.error('ERROR: Claude Code CLI check failed with code', code);
    process.exit(1);
  }
});