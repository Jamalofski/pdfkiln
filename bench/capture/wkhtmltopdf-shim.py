#!/usr/bin/env python3
"""Stand-in for wkhtmltopdf that records each call, then runs the real one.

Used to build the corpus: an application (Odoo, Frappe...) is pointed at this
script under the name `wkhtmltopdf`, and every conversion it asks for is
saved with its exact arguments and input files.

Environment:
  WKHTMLTOPDF_REAL         path of the real wkhtmltopdf binary
  WKHTMLTOPDF_REAL_LIBS    optional LD_LIBRARY_PATH for it
  WKHTMLTOPDF_CAPTURE_DIR  where calls are recorded; nothing is recorded if unset

Each call gets a directory holding call.json (argv, cwd, input files, exit
code), a copy of every argument that is an existing file, stdin.html when
the page comes on standard input, and output.pdf.
"""

import json
import os
import shutil
import subprocess
import sys
import time

real = os.environ["WKHTMLTOPDF_REAL"]
env = dict(os.environ)
if os.environ.get("WKHTMLTOPDF_REAL_LIBS"):
    env["LD_LIBRARY_PATH"] = os.environ["WKHTMLTOPDF_REAL_LIBS"]
capture_root = os.environ.get("WKHTMLTOPDF_CAPTURE_DIR")
args = sys.argv[1:]

if not capture_root or not args or args[0] in ("-V", "--version", "-h", "--help", "-H", "--extended-help"):
    os.execve(real, [real, *args], env)

call_dir = os.path.join(capture_root, f"{time.strftime('%Y%m%d-%H%M%S')}-{os.getpid()}")
os.makedirs(call_dir)

files = {}
for arg in args[:-1]:  # the last argument is the output
    if os.path.isfile(arg) and arg not in files:
        name = os.path.basename(arg)
        shutil.copyfile(arg, os.path.join(call_dir, name))
        files[arg] = name

stdin_data = None
if "-" in args[:-1]:
    stdin_data = sys.stdin.buffer.read()
    with open(os.path.join(call_dir, "stdin.html"), "wb") as f:
        f.write(stdin_data)

result = subprocess.run([real, *args], input=stdin_data, capture_output=True, env=env)

out = args[-1]
if out == "-":
    pdf = result.stdout
elif os.path.isfile(out):
    with open(out, "rb") as f:
        pdf = f.read()
else:
    pdf = b""
with open(os.path.join(call_dir, "output.pdf"), "wb") as f:
    f.write(pdf)

with open(os.path.join(call_dir, "call.json"), "w") as f:
    json.dump({
        "argv": args,
        "cwd": os.getcwd(),
        "files": files,
        "stdin": stdin_data is not None,
        "exit_code": result.returncode,
        "stderr": result.stderr.decode("utf-8", "replace")[-4000:],
    }, f, indent=2)

sys.stdout.buffer.write(result.stdout)
sys.stderr.buffer.write(result.stderr)
sys.exit(result.returncode)
