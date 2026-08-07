const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from workspace root
app.use(express.static(__dirname));

const TEMP_DIR = path.join(__dirname, '.temp_exec');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Helper to search directories with wildcard resolver
function findInDirectories(pattern, filename) {
  if (!fs.existsSync(pattern)) return null;
  try {
    const files = fs.readdirSync(pattern);
    for (const file of files) {
      const fullPath = path.join(pattern, file);
      if (fs.statSync(fullPath).isDirectory()) {
        const binPath = path.join(fullPath, 'bin', filename);
        if (fs.existsSync(binPath)) {
          return binPath;
        }
        const directBin = path.join(fullPath, filename);
        if (fs.existsSync(directBin)) {
          return directBin;
        }
      }
    }
  } catch (err) {}
  return null;
}

// Thorough compiler path resolution
function resolveCommand(cmdName) {
  // 1. Check if it exists in PATH
  try {
    const { execSync } = require('child_process');
    const checkCmd = os.platform() === 'win32' ? `where ${cmdName}` : `which ${cmdName}`;
    const result = execSync(checkCmd, { stdio: [] }).toString().trim().split('\r\n')[0];
    if (result && fs.existsSync(result)) {
      return result;
    }
  } catch (e) {
    // Ignore and search default paths
  }

  // 2. Default installation paths mapping
  if (os.platform() === 'win32') {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const homeDir = os.homedir();

    if (cmdName === 'javac' || cmdName === 'java') {
      const javaDirs = [
        path.join(programFiles, 'Java'),
        path.join(programFiles, 'Eclipse Adoptium'),
        path.join(programFiles, 'Eclipse adoptium'),
        path.join(programFiles, 'Microsoft')
      ];
      for (const d of javaDirs) {
        const resolved = findInDirectories(d, cmdName + '.exe');
        if (resolved) return resolved;
      }
    }

    if (cmdName === 'g++' || cmdName === 'gcc') {
      const cppDirs = [
        'C:\\winlibs',
        path.join(programFiles, 'winlibs'),
        path.join(programFilesX86, 'winlibs'),
        'C:\\msys64\\mingw64',
        'C:\\msys64\\ucrt64',
        'C:\\MinGW'
      ];
      for (const d of cppDirs) {
        const binPath = path.join(d, 'bin', cmdName + '.exe');
        if (fs.existsSync(binPath)) return binPath;
      }
      try {
        const cDirs = fs.readdirSync('C:\\');
        for (const dir of cDirs) {
          if (dir.toLowerCase().startsWith('winlibs')) {
            const binPath = path.join('C:\\', dir, 'bin', cmdName + '.exe');
            if (fs.existsSync(binPath)) return binPath;
          }
        }
      } catch (err) {}

      // Scan WinGet Packages directory for local WinLibs
      try {
        const wingetPackagesDir = path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
        if (fs.existsSync(wingetPackagesDir)) {
          const packages = fs.readdirSync(wingetPackagesDir);
          for (const pkg of packages) {
            if (pkg.toLowerCase().includes('brechtsanders.winlibs')) {
              const subDirs = ['mingw64\\bin', 'mingw32\\bin', 'bin'];
              for (const sub of subDirs) {
                const binPath = path.join(wingetPackagesDir, pkg, sub, cmdName + '.exe');
                if (fs.existsSync(binPath)) return binPath;
              }
            }
          }
        }
      } catch (err) {}
    }

    if (cmdName === 'go') {
      const goPath = path.join(programFiles, 'Go', 'bin', 'go.exe');
      if (fs.existsSync(goPath)) return goPath;
    }

    if (cmdName === 'rustc') {
      const rustcPath = path.join(homeDir, '.cargo', 'bin', 'rustc.exe');
      if (fs.existsSync(rustcPath)) return rustcPath;
    }

    if (cmdName === 'dotnet') {
      const dotnetPath = path.join(programFiles, 'dotnet', 'dotnet.exe');
      if (fs.existsSync(dotnetPath)) return dotnetPath;
    }

    if (cmdName === 'csc') {
      const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
      if (fs.existsSync(cscPath)) return cscPath;
    }

    if (cmdName === 'kotlinc' || cmdName === 'kotlin') {
      const localKotlin = path.join(__dirname, '.runtimes', 'kotlinc', 'bin', cmdName + '.bat');
      if (fs.existsSync(localKotlin)) return localKotlin;
    }
  }

  // Fallback to command name directly
  return cmdName;
}

// Bounded process execution helper
function runProcess(command, args, input, timeoutMs, maxOutputBytes, cwd, compilerBinDir) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    // Inherit and extend PATH environment variable
    const env = { ...process.env };
    if (compilerBinDir) {
      const pathKeys = Object.keys(env).filter(k => k.toLowerCase() === 'path');
      if (pathKeys.length > 0) {
        for (const key of pathKeys) {
          env[key] = `${compilerBinDir}${path.delimiter}${env[key] || ''}`;
        }
      } else {
        env['Path'] = compilerBinDir;
      }
      env['Path'] = `${compilerBinDir}${path.delimiter}${env['Path'] || env['PATH'] || ''}`;
      env['PATH'] = env['Path'];
    }

    const isCmdOrBat = typeof command === 'string' && (command.toLowerCase().endsWith('.bat') || command.toLowerCase().endsWith('.cmd'));
    const child = spawn(command, args, { cwd, env, shell: isCmdOrBat });

    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let killedDueToTimeout = false;
    let killedDueToLimit = false;

    const timer = setTimeout(() => {
      killedDueToTimeout = true;
      try {
        child.kill();
      } catch (e) {}
    }, timeoutMs);

    if (input) {
      child.stdin.write(input);
    }
    try {
      child.stdin.end();
    } catch (e) {}

    child.stdout.on('data', (data) => {
      if (stdoutBytes >= maxOutputBytes) {
        if (!killedDueToLimit) {
          killedDueToLimit = true;
          child.kill();
        }
        return;
      }
      const chunk = data.toString();
      stdout += chunk;
      stdoutBytes += Buffer.byteLength(chunk);
    });

    child.stderr.on('data', (data) => {
      if (stderrBytes >= maxOutputBytes) {
        if (!killedDueToLimit) {
          killedDueToLimit = true;
          child.kill();
        }
        return;
      }
      const chunk = data.toString();
      stderr += chunk;
      stderrBytes += Buffer.byteLength(chunk);
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        stdout,
        stderr: stderr + '\nProcess error: ' + err.message,
        exitCode: -1,
        duration: Date.now() - startTime,
        timeout: false,
        limitExceeded: false
      });
    });

    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      const duration = Date.now() - startTime;
      let finalStderr = stderr;
      if (killedDueToTimeout) {
        finalStderr += `\nError: Execution timed out after ${timeoutMs}ms.`;
      }
      if (killedDueToLimit) {
        finalStderr += `\nError: Execution output size limit exceeded (max ${maxOutputBytes / 1024}KB).`;
      }
      resolve({
        success: !killedDueToTimeout && !killedDueToLimit && code === 0,
        stdout,
        stderr: finalStderr,
        exitCode: code !== null ? code : (signal ? 1 : 0),
        duration,
        timeout: killedDueToTimeout,
        limitExceeded: killedDueToLimit
      });
    });
  });
}

app.post('/api/run', async (req, res) => {
  const { code, language, stdin, files, entryPoint } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }

  const sessionDir = path.join(TEMP_DIR, `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  fs.mkdirSync(sessionDir, { recursive: true });

  try {
    let sourceFilename = entryPoint || '';
    if (!sourceFilename) {
      if (language === 'java') sourceFilename = 'Main.java';
      else if (language === 'cpp' || language === 'c') sourceFilename = `main.${language === 'cpp' ? 'cpp' : 'c'}`;
      else if (language === 'csharp') sourceFilename = 'Program.cs';
      else if (language === 'go') sourceFilename = 'main.go';
      else if (language === 'rust') sourceFilename = 'main.rs';
      else if (language === 'kotlin') sourceFilename = 'main.kt';
      else if (language === 'python') sourceFilename = 'main.py';
    }

    let compileCmd = '';
    let compileArgs = [];
    let runCmd = '';
    let runArgs = [];
    let isCompiled = true;

    if (language === 'java') {
      const classMatch = code.match(/public\s+class\s+(\w+)/) || code.match(/class\s+(\w+)/);
      const className = classMatch ? classMatch[1] : 'Main';
      if (!sourceFilename.endsWith('.java')) {
        sourceFilename = `${className}.java`;
      }
      
      const javac = resolveCommand('javac');
      const java = resolveCommand('java');

      compileCmd = javac;
      compileArgs = [sourceFilename];

      const sourceFileDir = path.dirname(sourceFilename);
      runCmd = java;
      runArgs = ['-cp', sourceFileDir === '.' ? '.' : sourceFileDir, className];
    } else if (language === 'cpp' || language === 'c') {
      const gxx = resolveCommand(language === 'cpp' ? 'g++' : 'gcc');
      compileCmd = gxx;
      
      let allSources = [sourceFilename];
      if (files && typeof files === 'object') {
        const ext = language === 'cpp' ? '.cpp' : '.c';
        Object.keys(files).forEach(f => {
          if (f.endsWith(ext) && f !== sourceFilename) {
            allSources.push(f);
          }
        });
      }

      compileArgs = ['-O3', ...allSources, '-o', 'main.exe'];
      runCmd = path.join(sessionDir, 'main.exe');
      runArgs = [];
    } else if (language === 'csharp') {
      const csc = resolveCommand('csc');
      compileCmd = csc;
      compileArgs = [sourceFilename, '/out:program.exe', '/nologo'];
      runCmd = path.join(sessionDir, 'program.exe');
      runArgs = [];
    } else if (language === 'go') {
      const go = resolveCommand('go');
      compileCmd = go;
      compileArgs = ['build', '-o', 'main.exe', sourceFilename];
      runCmd = path.join(sessionDir, 'main.exe');
      runArgs = [];
    } else if (language === 'rust') {
      const rustc = resolveCommand('rustc');
      compileCmd = rustc;
      compileArgs = [sourceFilename, '-o', 'main.exe'];
      runCmd = path.join(sessionDir, 'main.exe');
      runArgs = [];
    } else if (language === 'kotlin') {
      const kotlinc = resolveCommand('kotlinc');
      const java = resolveCommand('java');
      compileCmd = kotlinc;
      compileArgs = [sourceFilename, '-include-runtime', '-d', 'main.jar'];
      runCmd = java;
      runArgs = ['-jar', 'main.jar'];
    } else if (language === 'python') {
      isCompiled = false;
      const python = resolveCommand('python') !== 'python' ? resolveCommand('python') : (resolveCommand('py') !== 'py' ? resolveCommand('py') : 'python');
      runCmd = python;
      runArgs = [sourceFilename];
    } else {
      return res.status(400).json({ error: `Language '${language}' is not supported for server-side execution.` });
    }

    // Write source code files
    if (files && typeof files === 'object') {
      for (const [relPath, fileObj] of Object.entries(files)) {
        if (fileObj && typeof fileObj.content === 'string') {
          const fullPath = path.join(sessionDir, relPath);
          const parentDir = path.dirname(fullPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
          fs.writeFileSync(fullPath, fileObj.content);
        }
      }
      if (sourceFilename) {
        const fullPath = path.join(sessionDir, sourceFilename);
        const parentDir = path.dirname(fullPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(fullPath, code);
      }
    } else {
      fs.writeFileSync(path.join(sessionDir, sourceFilename), code);
    }

    let compilerBinDir = null;
    if (isCompiled && path.isAbsolute(compileCmd)) {
      compilerBinDir = path.dirname(compileCmd);
    }
    // For Kotlin, we also need Java in the path because kotlinc.bat calls java
    if (language === 'kotlin') {
      const javaPath = resolveCommand('java');
      if (path.isAbsolute(javaPath)) {
        const javaBinDir = path.dirname(javaPath);
        compilerBinDir = compilerBinDir ? `${compilerBinDir}${path.delimiter}${javaBinDir}` : javaBinDir;
      }
    }

    // Compilation phase
    if (isCompiled) {
      let compilerAvailable = false;
      // If compileCmd is resolved path, it exists. If it's a fallback string, verify using 'where' command on Windows
      if (path.isAbsolute(compileCmd) && fs.existsSync(compileCmd)) {
        compilerAvailable = true;
      } else {
        try {
          const { execSync } = require('child_process');
          const checkCmd = os.platform() === 'win32' ? `where ${compileCmd}` : `which ${compileCmd}`;
          execSync(checkCmd, { stdio: [] });
          compilerAvailable = true;
        } catch (e) {}
      }

      if (!compilerAvailable) {
        const langNames = {
          java: 'Java (javac)',
          cpp: 'C++ (g++)',
          c: 'C (gcc)',
          csharp: 'C# (csc or dotnet)',
          go: 'Go (go)',
          rust: 'Rust (rustc)',
          kotlin: 'Kotlin (kotlinc)'
        };
        return res.json({
          success: false,
          compileError: `Compiler not found: '${langNames[language] || compileCmd}' is not installed or not in System PATH.\n\nPlease install the compiler or run the setup script 'setup_compilers.ps1' to configure it.`,
          exitCode: -1,
          duration: 0
        });
      }

      const compileResult = await runProcess(compileCmd, compileArgs, null, 15000, 102400, sessionDir, compilerBinDir);
      if (!compileResult.success) {
        return res.json({
          success: false,
          compileError: compileResult.stderr || compileResult.stdout || 'Compilation failed with unknown error.',
          exitCode: compileResult.exitCode,
          duration: compileResult.duration
        });
      }
    }

    // Execution phase
    if (!isCompiled) {
      let runnerExists = false;
      if (path.isAbsolute(runCmd) && fs.existsSync(runCmd)) {
        runnerExists = true;
      } else {
        try {
          const { execSync } = require('child_process');
          const checkCmd = os.platform() === 'win32' ? `where ${runCmd}` : `which ${runCmd}`;
          execSync(checkCmd, { stdio: [] });
          runnerExists = true;
        } catch (e) {}
      }
      if (!runnerExists) {
        return res.json({
          success: false,
          stderr: `Runner executable '${runCmd}' not found in System PATH.`,
          exitCode: -1,
          duration: 0
        });
      }
    }

    const runResult = await runProcess(runCmd, runArgs, stdin, 5000, 102400, sessionDir, compilerBinDir);
    return res.json({
      success: runResult.success,
      stdout: runResult.stdout,
      stderr: runResult.stderr,
      exitCode: runResult.exitCode,
      duration: runResult.duration
    });

  } catch (err) {
    return res.status(500).json({ error: `Server error during execution: ${err.message}` });
  } finally {
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      console.error('Failed to clean up temp dir:', sessionDir, cleanupErr);
    }
  }
});

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_PORT_ATTEMPTS = 10;

function startServer(port, attemptsLeft) {
  const server = app.listen(port, () => {
    console.log(`Notepad backend running at http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use. Trying port ${nextPort}...`);
      setTimeout(() => startServer(nextPort, attemptsLeft - 1), 200);
    } else {
      console.error(`Failed to start server on port ${port}:`, err);
      process.exit(1);
    }
  });
}

startServer(DEFAULT_PORT, MAX_PORT_ATTEMPTS);
