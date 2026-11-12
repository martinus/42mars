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
rem The library is compiled once: lib makes the static library of the
rem object, the linker the DLL with the exports listed in lib\42mars.def. A
rem second object for the DLL (with M42_DLL) was a second cl /O2 run of
rem about 40 s, and two in parallel shared the 4 vCPUs of GitHub's runner.
rem CI restores build\42mars.obj from its cache when lib\ did not change and
rem then sets M42_OBJ_CACHED=true (.github/workflows/test.yml). A local
rem build always compiles.
if "%M42_OBJ_CACHED%"=="true" if exist build\42mars.obj goto have_obj
cl %FLAGS% /c lib\42mars.c /Fobuild\42mars.obj || exit /b 1
:have_obj
lib /nologo /out:build\42mars-static.lib build\42mars.obj || exit /b 1
cl %FLAGS% /LD build\42mars.obj /Fe:build\42mars.dll /link /DEF:lib\42mars.def || exit /b 1
cl %FLAGS% cli\42mars.c build\42mars-static.lib /Fobuild\cli.obj /Fe:build\42mars.exe || exit /b 1
cl %FLAGS% test\c\api-test.c build\42mars.lib /Fobuild\api-test.obj /Fe:build\api-test.exe || exit /b 1
cl %FLAGS% /Ilib examples\example.c build\42mars-static.lib /Fobuild\example.obj /Fe:build\example.exe || exit /b 1
