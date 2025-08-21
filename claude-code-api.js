// Express API wrapper for Claude Code CLI
// This service handles programmatic execution of Claude Code

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Configuration
const PORT = process.env.CLAUDE_CODE_API_PORT || 8080;
const API_KEY = process.env.CLAUDE_CODE_API_KEY || 'your-secure-api-key-here';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // Required for Claude Code
const MAX_EXECUTION_TIME = 900000; // 15 minutes timeout

// Middleware for API authentication
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Helper function to execute Claude Code
async function executeClaudeCode(task, codebasePath, context = '') {
  return new Promise((resolve, reject) => {
    const taskId = crypto.randomBytes(8).toString('hex');
    const startTime = Date.now();
    
    // Build the complete prompt
    let fullPrompt = task;
    if (context) {
      fullPrompt = `${task}\n\nAdditional context: ${context}`;
    }
    
    // Claude Code command with print mode for non-interactive execution
    const command = 'claude';
    const args = [
      '-p', // Print mode for non-interactive execution
      '--output-format', 'json', // Get structured JSON output
      '--allowedTools', 'Bash(*)', 'Write(*)', 'Read(*)', 'Edit(*)', 'MultiEdit(*)', 'Grep(*)', 'Glob(*)', 'LS(*)', // Allow essential file operations
      '--dangerously-skip-permissions', // Skip permission prompts for automation
      fullPrompt
    ];
    
    console.log(`Executing Claude Code in: ${codebasePath}`);
    console.log(`Task: ${task}`);
    
    // Log the full command for debugging
    console.log(`Full command: ${command} ${args.join(' ')}`);
    console.log(`Environment vars: ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY ? 'SET' : 'NOT SET'}`);
    
    // Execute Claude Code
    const claudeProcess = spawn(command, args, {
      cwd: codebasePath,
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: ANTHROPIC_API_KEY,
        CLAUDE_CODE_NON_INTERACTIVE: 'true',
        CLAUDE_CODE_AUTO_APPROVE: 'true'
      },
      timeout: MAX_EXECUTION_TIME
    });
    
    let output = '';
    let errorOutput = '';
    let jsonOutput = null;
    let processStartTime = Date.now();
    
    // Set up a timeout handler
    const timeoutHandler = setTimeout(() => {
      console.error(`Process timeout after ${MAX_EXECUTION_TIME}ms - killing process`);
      claudeProcess.kill('SIGTERM');
      setTimeout(() => {
        if (!claudeProcess.killed) {
          console.error('Process did not terminate with SIGTERM, sending SIGKILL');
          claudeProcess.kill('SIGKILL');
        }
      }, 5000);
    }, MAX_EXECUTION_TIME);
    
    claudeProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      
      // Log with timestamp for debugging
      const elapsed = Date.now() - processStartTime;
      console.log(`[${elapsed}ms] Claude Output: ${chunk}`);
      
      // Try to parse JSON output
      try {
        // Claude Code outputs JSON when using --output-format json
        const lines = chunk.split('\n').filter(line => line.trim());
        for (const line of lines) {
          if (line.startsWith('{')) {
            try {
              jsonOutput = JSON.parse(line);
            } catch (e) {
              // Not valid JSON yet, might be partial
            }
          }
        }
      } catch (e) {
        // Continue collecting output
      }
    });
    
    claudeProcess.stderr.on('data', (data) => {
      const elapsed = Date.now() - processStartTime;
      errorOutput += data.toString();
      console.error(`[${elapsed}ms] Claude Error: ${data}`);
    });
    
    claudeProcess.on('close', async (code) => {
      clearTimeout(timeoutHandler);
      const totalTime = Date.now() - processStartTime;
      console.log(`Claude Code process exited with code ${code} after ${totalTime}ms`);
      
      if (code !== 0) {
        reject({
          error: 'Claude Code execution failed',
          code,
          output,
          errorOutput
        });
      } else {
        // Get git diff to see what changed
        const changes = await getGitDiff(codebasePath);
        
        // Extract summary from output or JSON
        let summary = 'Task completed successfully';
        if (jsonOutput && jsonOutput.message) {
          summary = jsonOutput.message;
        } else {
          summary = extractSummaryFromOutput(output);
        }
        
        resolve({
          success: true,
          taskId,
          summary,
          changes,
          output: output.substring(0, 5000), // Limit output size
          executionTime: Date.now() - startTime
        });
      }
    });
    
    // Set timeout
    setTimeout(() => {
      claudeProcess.kill('SIGTERM');
      reject({ error: 'Execution timeout exceeded' });
    }, MAX_EXECUTION_TIME);
  });
}

// Extract summary from Claude's text output
function extractSummaryFromOutput(output) {
  // Look for common patterns in Claude's responses
  const lines = output.split('\n').filter(line => line.trim());
  
  // Try to find lines that look like summaries
  const summaryPatterns = [
    /^I've .+/i,
    /^I have .+/i,
    /^Successfully .+/i,
    /^Completed .+/i,
    /^Created .+/i,
    /^Updated .+/i,
    /^Fixed .+/i,
    /^Added .+/i
  ];
  
  for (const line of lines) {
    for (const pattern of summaryPatterns) {
      if (pattern.test(line)) {
        return line;
      }
    }
  }
  
  // Return first non-empty line if no summary pattern found
  return lines[0] || 'Task completed';
}

// Get git diff for the changes
async function getGitDiff(codebasePath) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec('git diff --stat && git status --short', 
      { cwd: codebasePath, maxBuffer: 1024 * 1024 }, 
      (error, stdout, stderr) => {
        if (error) {
          console.error('Git diff error:', error);
          resolve('Unable to get diff');
        } else {
          resolve(stdout || 'No changes detected');
        }
      }
    );
  });
}

// API Endpoints

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'claude-code-api',
    version: '1.0.0'
  });
});

// Execute Claude Code task
app.post('/api/claude-code', authenticate, async (req, res) => {
  const { task, codebase_path, context } = req.body;
  
  if (!task || !codebase_path) {
    return res.status(400).json({ 
      error: 'Missing required parameters: task and codebase_path' 
    });
  }
  
  console.log('Received request:', { task, codebase_path, context });
  
  try {
    // Verify codebase path exists
    await fs.access(codebase_path);
    
    // Ensure we're in a git repository
    const gitDir = path.join(codebase_path, '.git');
    try {
      await fs.access(gitDir);
    } catch (e) {
      console.warn('Warning: Not a git repository, some features may not work');
    }
    
    // Execute Claude Code
    const result = await executeClaudeCode(task, codebase_path, context);
    
    res.json(result);
  } catch (error) {
    console.error('Error executing Claude Code:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to execute Claude Code',
      details: error
    });
  }
});

// Validate Claude Code installation
app.get('/api/claude-code/validate', authenticate, async (req, res) => {
  const { exec } = require('child_process');
  
  exec('claude --version', (error, stdout, stderr) => {
    if (error) {
      res.status(500).json({ 
        error: 'Claude Code not installed or not in PATH',
        details: stderr
      });
    } else {
      // Also check for API key
      const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
      
      res.json({ 
        installed: true, 
        version: stdout.trim(),
        apiKeyConfigured: hasApiKey,
        workingDirectory: process.cwd()
      });
    }
  });
});

// Test endpoint for simple tasks
app.post('/api/claude-code/test', authenticate, async (req, res) => {
  const testDir = `/tmp/test-${Date.now()}`;
  
  try {
    // Create a test directory
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a simple test file
    await fs.writeFile(
      path.join(testDir, 'test.js'),
      'console.log("Hello World");'
    );
    
    // Run a simple Claude Code task
    const result = await executeClaudeCode(
      'Add a comment to test.js explaining what it does',
      testDir
    );
    
    // Clean up
    await fs.rm(testDir, { recursive: true, force: true });
    
    res.json({
      success: true,
      test: 'Claude Code is working correctly',
      result
    });
  } catch (error) {
    // Clean up on error
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {}
    
    res.status(500).json({
      error: 'Test failed',
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Claude Code API server running on port ${PORT}`);
  console.log(`API Key required: ${API_KEY ? 'Yes (configured)' : 'No (using default)'}`);
  
  // Validate Claude Code installation on startup
  const { exec } = require('child_process');
  
  exec('claude --version', (error, stdout, stderr) => {
    if (error) {
      console.error('⚠️  WARNING: Claude Code not found in PATH');
      console.error('Please ensure Claude Code is installed in the container');
      console.error('Installation: npm install -g @anthropic-ai/claude-code');
    } else {
      console.log(`✅ Claude Code version: ${stdout.trim()}`);
    }
  });
  
  // Validate API key
  if (!ANTHROPIC_API_KEY) {
    console.error('⚠️  WARNING: ANTHROPIC_API_KEY environment variable not set');
    console.error('Claude Code will not be able to authenticate with Anthropic');
  } else {
    console.log('✅ Anthropic API key configured');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down Claude Code API server...');
  process.exit(0);
});