// server/server.js
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(bodyParser.json({ limit: '5mb' }));

// Configure multer for file uploads
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// Ensure uploads dir exists
fs.mkdirSync(path.join(__dirname, 'uploads/'), { recursive: true });

// POST /api/deob
// Accepts either multipart/form-data file upload (field 'file')
// or JSON { code: "...", filename?: "in.lua", options: {...} }
app.post('/api/deob', upload.single('file'), async (req, res) => {
  try {
    const opts = req.body.options ? JSON.parse(req.body.options) : (req.body.options || {});
    const trace = opts.trace || 'prints';
    const traceOnly = opts.traceOnly ? true : false;
    const pretty = (opts.pretty === undefined) ? true : (opts.pretty === 'true' || opts.pretty === true);
    const emit_ast = opts.emit_ast || null;
    const emit_snapshots_dir = opts.emit_snapshots_dir || null;

    // Determine input source (file upload or JSON code)
    let inputPath;
    let cleanupInput = false;
    if (req.file) {
      inputPath = req.file.path;
    } else if (req.body.code) {
      // write code to a tmp file
      const tmpFile = tmp.fileSync({ postfix: '.lua' });
      fs.writeFileSync(tmpFile.name, req.body.code, 'utf8');
      inputPath = tmpFile.name;
      cleanupInput = true;
    } else {
      return res.status(400).json({ error: 'No file or code provided.' });
    }

    // output path in tmp
    const outTmp = tmp.fileSync({ postfix: '.deob.lua' });
    const outPath = outTmp.name;

    // Build CLI args for lua script
    // We assume the CLI script is at ./src/deob/cli.lua relative to project root (see README)
    const cliPath = path.join(__dirname, '..', 'src', 'deob', 'cli.lua');

    if (!fs.existsSync(cliPath)) {
      return res.status(500).json({ error: `CLI script not found at ${cliPath}. See README.` });
    }

    // Compose args
    const args = [ cliPath, inputPath, '--out', outPath ];
    if (traceOnly) args.push('--trace-only');
    if (trace) args.push('--trace', String(trace));
    if (pretty === false) args.push('--no-pretty');
    if (emit_ast) args.push('--emit-ast', emit_ast);
    if (emit_snapshots_dir) args.push('--emit-snapshots', emit_snapshots_dir);

    // Spawn lua process (assumes `lua` is on PATH)
    const lua = spawn('lua', args, { cwd: path.join(__dirname, '..') });

    // capture logs
    let stdout = '';
    let stderr = '';

    lua.stdout.on('data', (data) => {
      stdout += data.toString();
      // optional: could stream logs to client via SSE / websocket
    });

    lua.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    lua.on('error', (err) => {
      console.error('Failed to start Lua process:', err);
    });

    lua.on('close', (code) => {
      // cleanup input if needed
      if (cleanupInput) {
        try { fs.unlinkSync(inputPath); } catch (e) {}
      }
      // read output file if present
      if (fs.existsSync(outPath)) {
        const result = fs.readFileSync(outPath, 'utf8');
        // send back result and logs
        res.json({
          success: true,
          exitCode: code,
          stdout: stdout,
          stderr: stderr,
          result: result
        });
        try { fs.unlinkSync(outPath); } catch (e) {}
      } else {
        res.status(500).json({
          success: false,
          exitCode: code,
          stdout: stdout,
          stderr: stderr,
          error: 'Output file not produced. Check CLI, dependencies, or logs.'
        });
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// simple health
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
