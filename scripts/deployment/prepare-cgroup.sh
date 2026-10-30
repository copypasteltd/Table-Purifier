#!/bin/sh
set -eu
tp_cgroup=/sys/fs/cgroup/tablepurifier.slice/table-purifier-isolation.service
test -d "$tp_cgroup"
# cgroup v2 forbids enabling controllers while the parent contains a process.
# Move this short-lived setup process into a child before enabling controllers.
mkdir -p "$tp_cgroup/.setup"
printf '%s\n' "$$" > "$tp_cgroup/.setup/cgroup.procs"
printf '%s\n' '+cpu +memory +pids' > "$tp_cgroup/cgroup.subtree_control"
# An idle supervisor in the child keeps the delegated parent alive. An exited
# oneshot allows systemd to remove an empty cgroup despite RemainAfterExit=yes.
/usr/bin/systemd-notify --ready
exec /usr/bin/sleep infinity
