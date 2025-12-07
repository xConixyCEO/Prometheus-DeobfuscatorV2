const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

// serve frontend
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ limit: '10mb' }));

// upload directory
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

app.post('/api/deob', upload.single('file'), async (req, res) => {
  try {
    const opts = req.body.options ? JSON.parse(req.body.options) : {};

    const trace = opts.trace || 'prints';
    const traceOnly = opts.traceOnly === true;
    const pretty = !(opts.pretty === false);
    const emit_ast = opts.emit_ast || '';

    // input file
    let inputPath;
    let cleanupInput = false;
    if (req.file) {
      inputPath = req.file.path;
    } else if (req.body.code) {
      const tmpFile = tmp.fileSync({ postfix: '.lua' });
      fs.writeFileSync(tmpFile.name, req.body.code, 'utf8');
      inputPath = tmpFile.name;
      cleanupInput = true;
    } else {
      return res.status(400).json({ error: 'No code file or input provided' });
    }

    // output file
    const outTmp = tmp.fileSync({ postfix: '.deob.lua' });
    const outPath = outTmp.name;

    // Lua CLI path (NOW ROOT RELATIVE)
    const cliPath = path.join(__dirname, 'src', 'deob', 'cli.lua');

    const args = [cliPath, inputPath, '--out', outPath];
    if (traceOnly) args.push('--trace-only');
    args.push('--trace', trace);
    if (!pretty) args.push('--no-pretty');
    if (emit_ast) args.push('--emit-ast', emit_ast);

    const lua = spawn('lua', args);

    let stdout = '';
    let stderr = '';

    lua.stdout.on('data', d => stdout += d.toString());
    lua.stderr.on('data', d => stderr += d.toString());

    lua.on('close', () => {
      if (cleanupInput) try { fs.unlinkSync(inputPath);} catch {}

      if (!fs.existsSync(outPath)) {
        return res.status(500).json({
          success: false,
          error: 'No output was produced',
          stdout,
          stderr
        });
      }

      const result = fs.readFileSync(outPath, 'utf8');
      try { fs.unlinkSync(outPath); } catch {}

      res.json({
        success: true,
        stdout,
        stderr,
        result
      });
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Local test
app.get('/api/health', (_, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening at http://localhost:${port}`));
