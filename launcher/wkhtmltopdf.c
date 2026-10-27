/*
 * wkhtmltopdf.exe and wkhtmltoimage.exe, the Windows launcher of pdfkiln,
 * copied under both names: starts pdfkiln.exe, next to it, in the mode its
 * own name gives, with the same command line, the same standard input,
 * output and error, and returns its exit code. A symbolic link would need
 * administrator rights on Windows, and a second copy of the program would
 * weigh about 100 MB.
 *
 * The child runs in a job object: if the launcher is killed (a caller's
 * timeout), pdfkiln and its Chromium go with it.
 *
 *   x86_64-w64-mingw32-gcc -municode -O2 -s -o wkhtmltopdf.exe wkhtmltopdf.c
 */
#include <windows.h>
#include <stdio.h>
#include <wchar.h>

/* Skips argv[0] as CommandLineToArgvW reads it: quoted, or up to a space. */
static const wchar_t *skip_program(const wchar_t *cmd) {
    if (*cmd == L'"') {
        cmd++;
        while (*cmd && *cmd != L'"') cmd++;
        if (*cmd) cmd++;
    } else {
        while (*cmd && *cmd != L' ' && *cmd != L'\t') cmd++;
    }
    while (*cmd == L' ' || *cmd == L'\t') cmd++;
    return cmd;
}

int wmain(void) {
    static wchar_t self[32768];
    DWORD n = GetModuleFileNameW(NULL, self, 32768);
    if (n == 0 || n >= 32768) return 1;
    wchar_t *slash = wcsrchr(self, L'\\');
    if (!slash) return 1;
    /* The mode: this file's name without .exe, wkhtmltopdf unless it is
       wkhtmltoimage. */
    const wchar_t *mode = _wcsnicmp(slash + 1, L"wkhtmltoimage", 13) == 0 ? L"wkhtmltoimage" : L"wkhtmltopdf";
    slash[1] = 0;

    const wchar_t *args = skip_program(GetCommandLineW());
    size_t len = wcslen(self) + wcslen(args) + 64;
    wchar_t *cmd = HeapAlloc(GetProcessHeap(), 0, len * sizeof(wchar_t));
    if (!cmd) return 1;
    swprintf(cmd, len, L"\"%lspdfkiln.exe\" %ls %ls", self, mode, args);

    HANDLE job = CreateJobObjectW(NULL, NULL);
    if (job) {
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION info = {0};
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(job, JobObjectExtendedLimitInformation, &info, sizeof(info));
    }

    STARTUPINFOW si = {0};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
    si.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
    si.hStdError = GetStdHandle(STD_ERROR_HANDLE);
    PROCESS_INFORMATION pi;
    if (!CreateProcessW(NULL, cmd, NULL, NULL, TRUE, CREATE_SUSPENDED, NULL, NULL, &si, &pi)) {
        fwprintf(stderr, L"%ls: cannot start %lspdfkiln.exe (error %lu)\n", mode, self, GetLastError());
        return 1;
    }
    if (job) AssignProcessToJobObject(job, pi.hProcess);
    ResumeThread(pi.hThread);
    CloseHandle(pi.hThread);

    /* Ctrl+C reaches the child through the console; the launcher waits. */
    SetConsoleCtrlHandler(NULL, TRUE);
    WaitForSingleObject(pi.hProcess, INFINITE);
    DWORD code = 1;
    GetExitCodeProcess(pi.hProcess, &code);
    return (int)code;
}
