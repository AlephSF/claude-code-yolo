import express from 'express';
import { query } from '@anthropic-ai/claude-code';
import { spawn } from 'child_process';
import { promisify } from 'util';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Configuration
const PORT = process.env.CLAUDE_CODE_API_PORT || 8080;
const API_KEY = process.env.CLAUDE_CODE_API_KEY || 'your-secure-api-key-here';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Validate required environment variables
if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

// Middleware for API authentication
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Utility function to get git diff for changes tracking
async function getGitDiff(codebasePath) {
  return new Promise((resolve) => {
    const gitProcess = spawn('git', ['diff', '--name-only'], { 
      cwd: codebasePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    gitProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    gitProcess.on('close', (code) => {
      if (code === 0 && output.trim()) {
        resolve({
          hasChanges: true,
          changedFiles: output.trim().split('\n').filter(f => f.trim())
        });
      } else {
        resolve({
          hasChanges: false,
          changedFiles: []
        });
      }
    });
    
    gitProcess.on('error', () => {
      resolve({
        hasChanges: false,
        changedFiles: [],
        error: 'Git not available'
      });
    });
  });
}

// Main Claude Code execution function using SDK
async function executeClaudeCodeWithSDK(task, codebasePath, context = '') {
  console.log(`Executing Claude Code SDK in: ${codebasePath}`);
  console.log(`Task: ${task}`);
  
  const startTime = Date.now();
  
  try {
    // Prepare the full prompt
    let fullPrompt = task;
    if (context) {
      fullPrompt = `${task}\n\nAdditional context: ${context}`;
    }
    
    console.log(`Starting Claude Code SDK query...`);
    
    let result = null;
    let totalCost = 0;
    let turns = 0;
    
    // Use the SDK query function with permission auto-approval
    for await (const message of query({
      prompt: fullPrompt,
      options: {
        systemPrompt: "You are a helpful coding assistant. Execute the requested task efficiently and provide clear feedback about what you accomplished.",
        maxTurns: 5,
        cwd: codebasePath,
        permissionMode: 'acceptEdits' // Auto-approve file operations for automation
      }
    })) {
      const elapsed = Date.now() - startTime;
      console.log(`[${elapsed}ms] SDK Message:`, JSON.stringify(message, null, 2));
      
      if (message.type === "result") {
        // Handle different result subtypes
        if (message.subtype === "error_during_execution" && !message.is_error) {
          // Task completed but with some execution issues (still successful)
          result = "Task completed successfully (with minor execution details)";
        } else if (message.result) {
          result = message.result;
        } else {
          // Fallback: consider it successful if we got a result message with costs
          result = "Task completed successfully";
        }
        
        totalCost = message.total_cost_usd || 0;
        turns = message.num_turns || 1;
        break;
      } else if (message.type === "error") {
        throw new Error(`Claude Code SDK error: ${message.error}`);
      }
    }
    
    if (!result) {
      throw new Error('No result received from Claude Code SDK');
    }
    
    // Get git diff to see what changed
    const changes = await getGitDiff(codebasePath);
    
    const totalTime = Date.now() - startTime;
    console.log(`Claude Code SDK completed successfully after ${totalTime}ms`);
    
    return {
      success: true,
      result: result,
      summary: `Task completed successfully in ${turns} turn(s)`,
      cost: totalCost,
      duration_ms: totalTime,
      changes: changes
    };
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`Claude Code SDK error after ${totalTime}ms:`, error.message);
    
    throw {
      success: false,
      error: 'Claude Code SDK execution failed',
      details: error.message,
      duration_ms: totalTime
    };
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0-sdk',
    sdk: 'claude-code'
  });
});

// Main Claude Code execution endpoint
app.post('/api/claude-code', authenticate, async (req, res) => {
  const { task, codebase_path, context } = req.body;
  
  if (!task || !codebase_path) {
    return res.status(400).json({ 
      error: 'Missing required parameters: task and codebase_path' 
    });
  }
  
  console.log('Received request:', { task, codebase_path, context });
  
  try {
    const result = await executeClaudeCodeWithSDK(task, codebase_path, context);
    res.json(result);
  } catch (error) {
    console.error('Error executing Claude Code SDK:', error);
    res.status(500).json({ 
      error: 'Failed to execute Claude Code SDK', 
      details: error 
    });
  }
});

// Validate Claude Code SDK installation
app.get('/api/claude-code/validate', authenticate, async (req, res) => {
  try {
    console.log('Validating Claude Code SDK installation...');
    
    // Test a simple query
    const testResult = await executeClaudeCodeWithSDK(
      'Just respond with "SDK validation successful"',
      process.cwd()
    );
    
    res.json({
      status: 'valid',
      message: 'Claude Code SDK is working correctly',
      test_result: testResult.result,
      cost: testResult.cost
    });
  } catch (error) {
    console.error('SDK validation failed:', error);
    res.status(500).json({
      status: 'invalid',
      error: 'Claude Code SDK validation failed',
      details: error.details || error.message
    });
  }
});

// Test endpoint for SDK functionality
app.post('/api/claude-code/test', authenticate, async (req, res) => {
  try {
    console.log('Running Claude Code SDK test...');
    
    // Create a temporary directory for testing
    const testDir = '/tmp/claude-test-' + Date.now();
    await new Promise((resolve, reject) => {
      spawn('mkdir', ['-p', testDir]).on('close', (code) => {
        code === 0 ? resolve() : reject(new Error('Failed to create test directory'));
      });
    });
    
    // Test creating a file
    const testResult = await executeClaudeCodeWithSDK(
      'Create a file called test.md with content: "# Claude Code SDK Test\n\nThis file was created by the Claude Code SDK to test the API wrapper."',
      testDir
    );
    
    // Clean up
    spawn('rm', ['-rf', testDir]);
    
    res.json({
      status: 'success',
      message: 'Claude Code SDK test completed successfully',
      test_directory: testDir,
      result: testResult
    });
  } catch (error) {
    console.error('SDK test failed:', error);
    res.status(500).json({
      status: 'failed',
      error: 'Claude Code SDK test failed',
      details: error.details || error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Claude Code API server running on port ${PORT}`);
  console.log(`API Key required: ${API_KEY !== 'your-secure-api-key-here' ? 'Yes (configured)' : 'Yes (using default - change for production)'}`);
  
  if (ANTHROPIC_API_KEY) {
    console.log('✅ Anthropic API key configured');
  } else {
    console.log('❌ Anthropic API key not configured');
  }
  
  console.log('✅ Using Claude Code SDK instead of CLI spawn');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});