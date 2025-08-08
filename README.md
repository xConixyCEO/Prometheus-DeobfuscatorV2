## Prometheus-DeobfuscatorV2

A research-grade deobfuscator for Lua scripts protected by the Prometheus obfuscator. This repository is used to test GPT‑5.0 and what it can do for reverse engineering assistance, automation, and code generation.

### Key features
- **Modular pipeline**: Independent steps with per-step metrics (line delta, functions, strings, numbers, assignments)
- **Constant array decode**: Unrotates, Base64-decodes, and inlines constants from indexed lookups and wrappers; evaluates arithmetic index expressions safely
- **String decrypt undo**: Reconstructs PRNG and statically decrypts `STRINGS[DECRYPT(enc, seed)]` patterns
- **Proxy locals undo**: Conservatively detects proxified locals and rewrites reads/writes back to direct variables
- **Split strings undo**: Joins split string fragments and folds concatenations
- **Environment normalize**: Rewrites aliased globals to canonical names
- **Dispatcher flattening (initial)**: Early attempt for static flattening of dispatcher state machines
- **Dynamic trace & reconstruction**: Sandbox execution with hooks to reconstruct observable behavior as AST/code
- **Roblox-aware stubs**: Minimal stubs for `game`, `workspace`, `Instance.new`, `task.*` with call logging
- **AST visibility**: Emit final AST code or snapshots per step to help reversers understand transformations
- **Readable output**: Pretty-printing by default and numeric escape decoding to plain text

### Installation
Requirements: Lua 5.1 or LuaJIT


### Examples
## ORG 
<img width="576" height="202" alt="image" src="https://github.com/user-attachments/assets/42806f78-a786-44bf-946d-066417ff895c" />

## Obfuscated
<img width="974" height="611" alt="image" src="https://github.com/user-attachments/assets/df0966de-a68a-43fe-a70e-299a34dfaf3c" />

## Deobfuscated Reconstucted 
<img width="471" height="357" alt="image" src="https://github.com/user-attachments/assets/e84c2000-c34f-48ef-bca8-686afc206554" />

<img width="980" height="641" alt="image" src="https://github.com/user-attachments/assets/de834be9-3b8a-48d2-88f6-5aa916f43dd1" />


```lua
-- ORGINAL 
--// Services

local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

--// Variables

local Key = Enum.KeyCode.E
local Flying = false
local Typing = false

--// Typing Check

UserInputService.TextBoxFocused:Connect(function()
    Typing = true
end)

UserInputService.TextBoxFocusReleased:Connect(function()
    Typing = false
end)

--// Main

RunService.RenderStepped:Connect(function()
    if Flying then
        Players.LocalPlayer.Character.Humanoid:ChangeState(4)
        Players.LocalPlayer.Character.Humanoid.WalkSpeed = 100
    end
end)

UserInputService.InputBegan:Connect(function(Input)
    if Input.KeyCode == Key then
        Flying = not Flying
        
        if not Flying then
            Players.LocalPlayer.Character.Humanoid.WalkSpeed = 16 
        end
    end
end)

-- Calls logged

print("[call:pcall]", "function: 014D5BB0");
print("[call:pcall]", "function: 014D6450");
print("[call:tostring]", "[string \"return(function(...)local p={\"\121\079\113\...\"]:1: attempt to perform arithmetic on local \'L\' (a string value)");
print("[call:tonumber]", "1");
print("[call:tostring]", "4799");
print("[call:pcall]", "function: 014D6540");
print("[call:pcall]", "function: 014D6120");
print("[call:tostring]", "[string \"return(function(...)local p={\"\121\079\113\...\"]:1: attempt to perform arithmetic on local \'L\' (a string value)");
print("[call:tonumber]", "1");
print("[call:tostring]", "5879");
print("[call:pcall]", "function: 014D62D0");
print("[call:error]", "[string \"return(function(...)local p={\"\121\079\113\...\"]:5879: attempt to perform arithmetic on local \'L\' (a string value)", "0");
print("[call:tostring]", "7438");
print("[call:pcall]", "function: 014D6030");
print("[call:pcall]", "function: 014D6600");
print("[call:tostring]", "[string \"return(function(...)local p={\"\121\079\113\...\"]:1: attempt to perform arithmetic on local \'L\' (a string value)");
print("[call:tonumber]", "1");
print("[call:error]", "[string \"return(function(...)local p={\"\121\079\113\...\"]:7438: attempt to perform arithmetic on local \'L\' (a string value)", "0");
print("[call:game.GetService]", "<stub game>", "UserInputService");
print("[call:game.GetService]", "<stub game>", "RunService");
print("[call:game.GetService]", "<stub game>", "Players");
print("[call:game.GetService.TextBoxFocused.Connect]", "<stub game.GetService.TextBoxFocused>", "function: 014D6210");
print("[call:game.GetService.TextBoxFocusReleased.Connect]", "<stub game.GetService.TextBoxFocusReleased>", "function: 014D6240");
print("[call:game.GetService.RenderStepped.Connect]", "<stub game.GetService.RenderStepped>", "function: 014D6270");
print("[call:game.GetService.InputBegan.Connect]", "<stub game.GetService.InputBegan>", "function: 014D6090");


-- CALL 
lua src\deob\cli.lua hello.obfuscated.lua --trace api --out api.deob.lua

```


Clone this repo and the Prometheus obfuscator repo in the same directory so the `Prometheus/` folder is available:

```
# clone this project
git clone https://github.com/0x251/Prometheus-DeobfuscatorV2.git
cd Prometheus-DeobfuscatorV2

# clone Prometheus obfuscator next to src/
# required so imports like Prometheus/src/prometheus/* resolve
git clone https://github.com/wcrddn/Prometheus.git
```

Reference: [wcrddn/Prometheus](https://github.com/wcrddn/Prometheus.git)

### How it works
1. **Static passes** run first to peel common layers: `UnwrapFunction`, `ConstantArrayDecode`, `FoldNumbers`, `EnvNormalize`, `FoldConcats`, `UndoSplitStrings`, `UndoEncryptStrings`, `UndoProxifyLocals`, `CleanupObfuscatorScaffold`.
2. **Dynamic trace** optionally executes the original source in a sandbox, capturing prints, global/API calls, and (optionally) debug call/line events. It also breadth-first executes functions returned by the chunk to capture nested behavior.
3. The **final code** is produced from the transformed AST, with optional snapshots and AST dumps available for inspection.

### CLI
```
lua src/deob/cli.lua <input.lua> [options]
```

- **--out <path>**: Output file path (default: <input>.deob.lua)
- **--trace <mode>**: Dynamic reconstruction mode
  - `off`: no dynamic tracing
  - `prints`: only print/io.write reconstruction (clean)
  - `calls`: reconstruct meaningful global function calls (filtered)
  - `api`: log Roblox/global API calls/sets as printable lines
  - `debug`: verbose debug hooks (calls, lines, locals) as printable lines
- **--pretty | --no-pretty**: Toggle pretty printing (default: pretty)
- **--emit-ast <path>**: Write the final AST-as-code after all steps
- **--emit-snapshots <dir>**: Write code snapshots after each step into a directory

Numeric string escapes are post-processed to plain text in the final output.

### Quickstart
```
# run pure static passes and save snapshots
lua src/deob/cli.lua hello.obfuscated.lua --trace off --emit-snapshots snapshots --out static.deob.lua

# reconstruct prints and meaningful global calls
lua src/deob/cli.lua hello.obfuscated.lua --trace calls --out calls.deob.lua

# API/Roblox oriented logging
lua src/deob/cli.lua script.lua --trace api --out api.deob.lua

# verbose debug tracing
lua src/deob/cli.lua script.lua --trace debug --out debug.deob.lua

# emit final AST code representation
lua src/deob/cli.lua hello.obfuscated.lua --trace prints --emit-ast ast_out.lua --out prints.deob.lua
```

### Project structure
- `src/deob/pipeline.lua`: Orchestrates steps, collects metrics, manages parser/unparser, snapshots
- `src/deob/steps/*.lua`: Individual deobfuscation steps
- `Prometheus/src/...`: Prometheus obfuscator source (reference for reversing)

### Notes and scope
- This project is for **research and education**. Use on your own code or with permission.
- The sandbox is **best-effort** and not a security boundary. Execute untrusted code in an isolated environment.
- VM devirtualization is currently **dynamic-first**. A full static VM lifter is on the roadmap.

### Roadmap
- Stronger `UndoProxifyLocals` with richer patterns
- More precise scaffold cleanup and dead code removal
- Expanded Roblox stubs and service-specific modeling
- Optional raw trace file + clean reconstruction output
- Automated test suite and corpus
- Static VM lifter and dispatcher reconstruction

### Why
Prometheus-DeobfuscatorV2 exists to test GPT‑5.0 driven workflows for reverse engineering support: reading large codebases, implementing transformations, building tooling, and iterating quickly with measurable outputs. It demonstrates how LLM-assisted development can accelerate complex reversing tasks while remaining transparent and auditable. 
