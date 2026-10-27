/* P07 native Linux confinement launcher. No container engine, VM or WSL.
 * Compile-only source: cc -O2 -Wall -Wextra -Werror -o ... p07-isolate.c
 * Requires Landlock ABI >=1 and an already delegated cgroup-v2 leaf.
 * The Host supplies absolute, verified read/write roots and the executable.
 * Failure at any stage exits without executing the Agent. */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/landlock.h>
#include <linux/seccomp.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <unistd.h>

#ifndef LANDLOCK_ACCESS_FS_REFER
#define LANDLOCK_ACCESS_FS_REFER (1ULL << 13)
#endif
#ifndef LANDLOCK_ACCESS_FS_TRUNCATE
#define LANDLOCK_ACCESS_FS_TRUNCATE (1ULL << 14)
#endif

static void fail(void) { fputs("P07_NATIVE_ISOLATION_FAILED\n", stderr); _exit(125); }
static const char *required(const char *key) {
  const char *value = getenv(key);
  if (!value || !*value || strchr(value, '\r')) fail();
  return value;
}
static void write_exact(const char *path, const char *value, int flags) {
  int fd = open(path, O_WRONLY | O_CLOEXEC | O_NOFOLLOW | flags, 0600);
  if (fd < 0) fail();
  size_t size = strlen(value), offset = 0;
  while (offset < size) {
    ssize_t n = write(fd, value + offset, size - offset);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) fail();
    offset += (size_t)n;
  }
  if ((flags & O_CREAT) && fsync(fd)) fail();
  if (close(fd)) fail();
}
static void limit(int kind, rlim_t value) {
  struct rlimit bound = {value, value};
  if (setrlimit(kind, &bound)) fail();
}

static void roots(int ruleset, const char *list, uint64_t access, int writable) {
  char *copy = strdup(list), *save = NULL;
  if (!copy) fail();
  for (char *path = strtok_r(copy, "\n", &save); path; path = strtok_r(NULL, "\n", &save)) {
    if (path[0] != '/' || !strcmp(path, "/") || strstr(path, "/../")) fail();
    int fd = open(path, O_PATH | O_CLOEXEC | O_NOFOLLOW);
    struct stat info;
    if (fd < 0 || fstat(fd, &info) || S_ISLNK(info.st_mode)) fail();
    uint64_t rights = access;
    if (!S_ISDIR(info.st_mode)) {
      rights &= LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_EXECUTE;
      if (writable) rights |= LANDLOCK_ACCESS_FS_WRITE_FILE;
    }
    struct landlock_path_beneath_attr rule = {.allowed_access = rights, .parent_fd = fd};
    if (syscall(SYS_landlock_add_rule, ruleset, LANDLOCK_RULE_PATH_BENEATH, &rule, 0)) fail();
    close(fd);
  }
  free(copy);
}

/* Deny cross-process inspection, signal attacks, handles/io_uring bypasses and
 * privilege-changing kernel interfaces. The Codex workspace sandbox additionally
 * constrains command-network access. No seccomp result is treated as a substitute
 * for the startup physical cross-directory/network probe. */
#define DENY(n) BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, (n), 0, 1), BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | EPERM)
static void filter(void) {
#if defined(__x86_64__)
  const unsigned int arch = AUDIT_ARCH_X86_64;
#elif defined(__aarch64__)
  const unsigned int arch = AUDIT_ARCH_AARCH64;
#else
#error Unsupported architecture
#endif
  struct sock_filter instructions[] = {
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch)),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, arch, 1, 0),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL_PROCESS),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
#if defined(__x86_64__)
    BPF_JUMP(BPF_JMP | BPF_JGE | BPF_K, 0x40000000, 0, 1),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL_PROCESS),
#endif
    /* ABI 1 does not mediate truncate(). Deny path truncation and the unusual
     * read-only O_TRUNC open form; ordinary writable opens remain Landlock-gated. */
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, SYS_openat, 0, 5),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[2])),
    BPF_STMT(BPF_ALU | BPF_AND | BPF_K, O_TRUNC | O_ACCMODE),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, O_TRUNC, 0, 1),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | EPERM),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
#ifdef SYS_open
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, SYS_open, 0, 5),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[1])),
    BPF_STMT(BPF_ALU | BPF_AND | BPF_K, O_TRUNC | O_ACCMODE),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, O_TRUNC, 0, 1),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | EPERM),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
#endif
    DENY(SYS_openat2), DENY(SYS_truncate),
#ifdef SYS_chmod
    DENY(SYS_chmod),
#endif
    DENY(SYS_fchmod), DENY(SYS_fchmodat),
#ifdef SYS_chown
    DENY(SYS_chown),
#endif
    DENY(SYS_fchown), DENY(SYS_fchownat),
    DENY(SYS_ptrace), DENY(SYS_process_vm_readv), DENY(SYS_process_vm_writev),
    DENY(SYS_kill), DENY(SYS_tkill), DENY(SYS_tgkill), DENY(SYS_pidfd_send_signal),
    DENY(SYS_pidfd_getfd), DENY(SYS_perf_event_open), DENY(SYS_bpf),
    DENY(SYS_open_by_handle_at), DENY(SYS_name_to_handle_at),
    DENY(SYS_io_uring_setup), DENY(SYS_userfaultfd), DENY(SYS_kcmp),
    DENY(SYS_keyctl), DENY(SYS_add_key), DENY(SYS_request_key),
    DENY(SYS_reboot), DENY(SYS_kexec_load), DENY(SYS_init_module), DENY(SYS_finit_module),
    DENY(SYS_delete_module), DENY(SYS_swapon), DENY(SYS_swapoff),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW)
  };
  struct sock_fprog program = {.len = (unsigned short)(sizeof(instructions) / sizeof(instructions[0])), .filter = instructions};
  if (prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &program)) fail();
}

int main(int argc, char **argv) {
  if (argc < 2 || getuid() == 0 || geteuid() != getuid()) fail();
  const char *executable = required("P07_EXECUTABLE");
  const char *cgroup = required("P07_CGROUP_PROCS");
  const char *receipt = required("P07_PROCESS_RECEIPT");
  const char *nonce = required("P07_PROCESS_NONCE");
  const char *reads = required("P07_READ_ROOTS");
  const char *writes = required("P07_WRITE_ROOTS");
  if (executable[0] != '/' || cgroup[0] != '/' || receipt[0] != '/' || strlen(nonce) != 64) fail();
  for (const char *p = nonce; *p; p++) if (!strchr("0123456789abcdef", *p)) fail();
  int abi = (int)syscall(SYS_landlock_create_ruleset, NULL, 0, LANDLOCK_CREATE_RULESET_VERSION);
  if (abi < 1) fail();
  int proof_fd = open(receipt, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC | O_NOFOLLOW, 0600);
  if (proof_fd < 0) fail();
  char pid[40]; snprintf(pid, sizeof(pid), "%ld", (long)getpid());
  write_exact(cgroup, pid, 0);
  limit(RLIMIT_CORE, 0); limit(RLIMIT_NOFILE, 256); limit(RLIMIT_FSIZE, 220000000);
  limit(RLIMIT_CPU, 930);
  if (prctl(PR_SET_DUMPABLE, 0) || prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0)) fail();
  uint64_t read_access = LANDLOCK_ACCESS_FS_EXECUTE | LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_READ_DIR;
  uint64_t write_access = LANDLOCK_ACCESS_FS_WRITE_FILE | LANDLOCK_ACCESS_FS_REMOVE_DIR | LANDLOCK_ACCESS_FS_REMOVE_FILE
    | LANDLOCK_ACCESS_FS_MAKE_DIR | LANDLOCK_ACCESS_FS_MAKE_REG | LANDLOCK_ACCESS_FS_MAKE_SOCK;
  uint64_t handled = read_access | write_access | LANDLOCK_ACCESS_FS_MAKE_CHAR | LANDLOCK_ACCESS_FS_MAKE_BLOCK
    | LANDLOCK_ACCESS_FS_MAKE_FIFO | LANDLOCK_ACCESS_FS_MAKE_SYM;
  if (abi >= 2) handled |= LANDLOCK_ACCESS_FS_REFER;
  if (abi >= 3) handled |= LANDLOCK_ACCESS_FS_TRUNCATE;
  struct landlock_ruleset_attr policy = {.handled_access_fs = handled};
  int ruleset = (int)syscall(SYS_landlock_create_ruleset, &policy, sizeof(policy), 0);
  if (ruleset < 0) fail();
  roots(ruleset, reads, read_access, 0);
  roots(ruleset, writes, read_access | write_access | (abi >= 2 ? LANDLOCK_ACCESS_FS_REFER : 0)
    | (abi >= 3 ? LANDLOCK_ACCESS_FS_TRUNCATE : 0), 1);
  if (syscall(SYS_landlock_restrict_self, ruleset, 0)) fail();
  close(ruleset);
  filter();
  /* Opened before confinement; the Agent never inherits this descriptor. */
  char proof[256];
  snprintf(proof, sizeof(proof), "{\"pid\":%ld,\"landlock_abi\":%d,\"no_new_privs\":true,\"seccomp\":true,\"nonce\":\"%s\"}\n", (long)getpid(), abi, nonce);
  size_t size = strlen(proof);
  if (write(proof_fd, proof, size) != (ssize_t)size || fsync(proof_fd) || close(proof_fd)) fail();
  unsetenv("P07_READ_ROOTS"); unsetenv("P07_WRITE_ROOTS"); unsetenv("P07_CGROUP_PROCS");
  unsetenv("P07_PROCESS_RECEIPT"); unsetenv("P07_PROCESS_NONCE");
  unsetenv("P07_EXECUTABLE");
  argv[0] = (char *)executable;
  execv(executable, argv);
  fail();
}
