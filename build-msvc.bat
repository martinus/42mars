@echo off
rem SPDX-License-Identifier: MIT
rem Copyright (c) 2026 Martin Leitner-Ankerl
rem
rem The C library and the 42mars program with MSVC, what the Makefile builds
rem on Linux and macOS. Writes into build\:
rem   42mars.exe            the command line program
rem   42mars-static.lib     the library to link statically
rem   42mars.dll            the library as a DLL, 42mars.lib its import library
rem   api-test.exe          (through the DLL) and example.exe: the test programs
rem Then the tests: set M42_BIN=build and run
rem   node --test test/c-api.test.js test/cli.test.js
rem Runs in a Developer Command Prompt, or anywhere with Visual Studio 2019
rem 16.8 or newer installed (C11): it then finds vcvars64.bat through vswhere.

setlocal
cd /d "%~dp0"
rem No parenthesized blocks: the ")" of %ProgramFiles(x86)% would end them.
where cl >nul 2>nul
if not errorlevel 1 goto build
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
for /f "usebackq delims=" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do call "%%i\VC\Auxiliary\Build\vcvars64.bat" >nul
where cl >nul 2>nul
if not errorlevel 1 goto build
echo build-msvc.bat: no cl.exe, and vswhere found no Visual Studio with C++ tools 1>&2
exit /b 1

:build
if not exist build mkdir build
set FLAGS=/nologo /std:c11 /O2 /W3 /D_CRT_SECURE_NO_WARNINGS
rem The library twice, in parallel (/MP): for the static library, and with
rem M42_DLL for the DLL (build\42mars-dll.c includes lib\42mars.c).
> build\42mars-dll.c echo #define M42_DLL
>> build\42mars-dll.c echo #include "../lib/42mars.c"
cl %FLAGS% /MP /c lib\42mars.c build\42mars-dll.c /Fobuild\ || exit /b 1
lib /nologo /out:build\42mars-static.lib build\42mars.obj || exit /b 1
cl %FLAGS% /LD build\42mars-dll.obj /Fe:build\42mars.dll || exit /b 1
cl %FLAGS% cli\42mars.c build\42mars-static.lib /Fobuild\cli.obj /Fe:build\42mars.exe || exit /b 1
cl %FLAGS% test\c\api-test.c build\42mars.lib /Fobuild\api-test.obj /Fe:build\api-test.exe || exit /b 1
cl %FLAGS% /Ilib examples\example.c build\42mars-static.lib /Fobuild\example.obj /Fe:build\example.exe || exit /b 1
