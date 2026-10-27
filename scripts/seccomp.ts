// docker/seccomp.json: Docker's default seccomp profile, plus what
// Chromium's sandbox needs and nothing else. Docker allows clone and
// unshare only without namespace flags (without CAP_SYS_ADMIN); the
// sandbox creates user, PID and network namespaces. Mount, cgroup, UTS
// and IPC namespaces stay refused, and so does everything else the
// default profile refuses.
//
//   node dist/scripts/seccomp.js <default.json of github.com/moby/profiles/seccomp>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../src/chromium.js';

const NAMESPACES = 0x7e020000; // NEWNS, NEWCGROUP, NEWUTS, NEWIPC, NEWUSER, NEWPID, NEWNET
const NEWUSER = 0x10000000;
const NEWPID = 0x20000000;
const NEWNET = 0x40000000;

const source = process.argv[2];
if (!source) throw new Error('usage: seccomp.js <moby default.json>');
const profile = JSON.parse(readFileSync(source, 'utf8')) as { syscalls: object[] };
const allowed = [NEWUSER, NEWPID, NEWNET, NEWUSER | NEWPID, NEWUSER | NEWNET, NEWPID | NEWNET, NEWUSER | NEWPID | NEWNET];
for (const flags of allowed) {
  profile.syscalls.push({
    names: ['clone', 'unshare'],
    action: 'SCMP_ACT_ALLOW',
    args: [{ index: 0, value: NAMESPACES, valueTwo: flags, op: 'SCMP_CMP_MASKED_EQ' }],
    comment: "pdfkiln: user, PID and network namespaces for Chromium's sandbox",
    excludes: { arches: ['s390', 's390x'] },
  });
}
writeFileSync(join(repoRoot, 'docker', 'seccomp.json'), `${JSON.stringify(profile, null, 2)}\n`);
