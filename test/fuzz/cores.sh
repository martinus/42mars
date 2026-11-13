#!/bin/sh
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Martin Leitner-Ankerl
#
# Prints the number of physical cores (Linux, macOS; else 1): the default
# number of fuzz processes of `make fuzz`, one per core.

n=$(lscpu -p=core,socket 2>/dev/null | grep -v '^#' | sort -u | wc -l)
[ "$n" -gt 0 ] 2>/dev/null || n=$(sysctl -n hw.physicalcpu 2>/dev/null)
echo "${n:-1}"
