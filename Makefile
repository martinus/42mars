# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Martin Leitner-Ankerl
#
# The C library and the 42mars program, with gcc or clang on Linux and macOS
# (GNU make 3.81 or newer). Windows with MSVC: build-msvc.bat.
#
#   make                 build/lib42mars.a, the shared library, build/42mars,
#                        build/42evolve (the evolver, POSIX threads)
#   make test            the C tests of the Node test suite on these builds
#                        (test/c-api.test.js, test/cli.test.js,
#                        test/evolver*.test.js; needs Node 20+)
#   make test-lib        only the library and 42mars (test/c-api.test.js,
#                        test/cli.test.js); make test TESTS='...' runs
#                        those test files only
#   make install         into $(DESTDIR)$(PREFIX): bin/42mars, include/42mars.h,
#                        lib/lib42mars.a, the shared library, lib/pkgconfig/42mars.pc
#   make dist            build/42mars-<version>-<os>-<cpu>.tar.gz, an install
#                        tree with the license
#   make fuzz            the fuzz targets of test/fuzz/, FUZZ_SECONDS each
#                        (default 60) on FUZZ_JOBS processes (default: one
#                        per physical core); fails on any report. With AFL++
#                        (afl-fuzz on the PATH, or AFL=<its folder>) through
#                        test/fuzz/afl.sh, else clang's libFuzzer with ASan
#                        and UBSan (FUZZ_ENGINE=libfuzzer picks it always)
#   make clean
#
# The version is the one of lib/42mars.h. CC, CFLAGS, LDFLAGS and PREFIX
# work as usual.

CC ?= cc
CFLAGS ?= -O3 -Wall -Wextra
PREFIX ?= /usr/local
BINDIR = $(PREFIX)/bin
INCLUDEDIR = $(PREFIX)/include
LIBDIR = $(PREFIX)/lib

VERSION := $(shell awk '/define M42_VERSION_/ { v = v s $$3; s = "." } END { print v }' lib/42mars.h)
MAJOR := $(word 1,$(subst ., ,$(VERSION)))
MINOR := $(word 2,$(subst ., ,$(VERSION)))
# Until 1.0.0 every minor version may change the interface.
ifeq ($(MAJOR),0)
ABI := $(MAJOR).$(MINOR)
else
ABI := $(MAJOR)
endif

OS := $(shell uname -s)
ifeq ($(OS),Darwin)
# The id names the folder the library is installed in; install fixes it.
SHARED := lib42mars.$(ABI).dylib
SHARED_LINKS := lib42mars.dylib
SHARED_FLAGS = -dynamiclib -install_name @rpath/$(SHARED) -compatibility_version $(ABI) -current_version $(VERSION)
RPATH = -Wl,-rpath,@loader_path
else
SHARED := lib42mars.so.$(VERSION)
SHARED_LINKS := lib42mars.so.$(ABI) lib42mars.so
SHARED_FLAGS = -shared -Wl,-soname,lib42mars.so.$(ABI)
RPATH = -Wl,-rpath,'$$ORIGIN'
endif

LIB_SOURCES := lib/42mars.c lib/42mars.h $(wildcard lib/src/*.c lib/src/*.h)
# the files of 42evolve alone (evolver/evolve.h)
EVOLVE := evolver/evolve.c evolver/pool.c evolver/events.c evolver/state.c evolver/panel.c
EVOLVER_SOURCES := evolver/genome.c evolver/generator.c evolver/gen-change.c evolver/pushoff.c evolver/names.c evolver/style.c $(wildcard evolver/*.h)
DIST := 42mars-$(VERSION)-$(shell uname -s | tr A-Z a-z)-$(shell uname -m)

all: build/lib42mars.a build/$(SHARED) build/42mars build/42evolve build/42spectrum build/42gen

build/42mars.o: $(LIB_SOURCES)
	@mkdir -p build
	$(CC) $(CFLAGS) -fPIC -c -o $@ lib/42mars.c

build/lib42mars.a: build/42mars.o
	rm -f $@
	$(AR) rcs $@ build/42mars.o

build/$(SHARED): build/42mars.o
	$(CC) $(CFLAGS) $(SHARED_FLAGS) $(LDFLAGS) -o $@ build/42mars.o
	for l in $(SHARED_LINKS); do ln -sf $(SHARED) build/$$l; done

build/42mars: cli/42mars.c build/lib42mars.a
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ cli/42mars.c build/lib42mars.a

build/42evolve: $(EVOLVE) $(EVOLVER_SOURCES) build/lib42mars.a
	$(CC) $(CFLAGS) -pthread $(LDFLAGS) -Ilib -o $@ $(EVOLVE) evolver/genome.c evolver/generator.c evolver/gen-change.c evolver/pushoff.c evolver/names.c evolver/style.c build/lib42mars.a -lm

# 42spectrum: what one change does to a warrior (docs/evolver.md)
build/42spectrum: evolver/spectrum.c $(EVOLVER_SOURCES) build/lib42mars.a
	$(CC) $(CFLAGS) -pthread $(LDFLAGS) -Ilib -o $@ evolver/spectrum.c evolver/genome.c evolver/generator.c evolver/gen-change.c build/lib42mars.a -lm

# 42gen: the warrior a generator writes (docs/evolver-gen.md)
build/42gen: evolver/gen.c $(EVOLVER_SOURCES) build/lib42mars.a
	$(CC) $(CFLAGS) $(LDFLAGS) -Ilib -o $@ evolver/gen.c evolver/generator.c build/lib42mars.a -lm

# The test programs: api-test through the shared library, the examples as
# 42mars.h describes them.
build/api-test: test/c/api-test.c build/$(SHARED)
	$(CC) $(CFLAGS) $(LDFLAGS) $(RPATH) -o $@ test/c/api-test.c -Lbuild -l42mars

build/example: examples/example.c build/lib42mars.a
	$(CC) $(CFLAGS) $(LDFLAGS) -Ilib -o $@ examples/example.c build/lib42mars.a

build/parallel: examples/parallel.c build/lib42mars.a
	$(CC) $(CFLAGS) -pthread $(LDFLAGS) -Ilib -o $@ examples/parallel.c build/lib42mars.a

build/evolver-test: test/c/evolver-test.c $(EVOLVER_SOURCES) build/lib42mars.a
	$(CC) $(CFLAGS) $(LDFLAGS) -Ilib -Ievolver -o $@ test/c/evolver-test.c evolver/genome.c evolver/generator.c evolver/gen-change.c evolver/pushoff.c evolver/names.c build/lib42mars.a -lm

build/generator-test: test/c/generator-test.c $(EVOLVER_SOURCES) build/lib42mars.a
	$(CC) $(CFLAGS) $(LDFLAGS) -Ilib -Ievolver -o $@ test/c/generator-test.c evolver/generator.c evolver/gen-change.c evolver/genome.c build/lib42mars.a -lm

# test-lib: the library and 42mars only, without the evolver (CI builds the C11
# code that MSVC compiles with it, test.yml)
TESTS = test/c-api.test.js test/cli.test.js test/evolver*.test.js
test: all build/api-test build/example build/parallel build/evolver-test build/generator-test
	M42_BIN=build node --test $(TESTS)

test-lib: build/lib42mars.a build/$(SHARED) build/42mars build/api-test build/example build/parallel
	M42_BIN=build node --test test/c-api.test.js test/cli.test.js

install: all
	install -d $(DESTDIR)$(BINDIR) $(DESTDIR)$(INCLUDEDIR) $(DESTDIR)$(LIBDIR)/pkgconfig
	install -m 755 build/42mars $(DESTDIR)$(BINDIR)/
	install -m 644 lib/42mars.h $(DESTDIR)$(INCLUDEDIR)/
	install -m 644 build/lib42mars.a $(DESTDIR)$(LIBDIR)/
	install -m 755 build/$(SHARED) $(DESTDIR)$(LIBDIR)/
	for l in $(SHARED_LINKS); do ln -sf $(SHARED) $(DESTDIR)$(LIBDIR)/$$l; done
ifeq ($(OS),Darwin)
	install_name_tool -id $(LIBDIR)/$(SHARED) $(DESTDIR)$(LIBDIR)/$(SHARED)
endif
	printf '%s\n' 'prefix=$(PREFIX)' 'includedir=$${prefix}/include' 'libdir=$${prefix}/lib' '' \
	  'Name: 42mars' 'Description: Redcode assembler and MARS simulator with the results of pMARS 0.9.5' \
	  'Version: $(VERSION)' 'URL: https://github.com/martinus/42mars' \
	  'Cflags: -I$${includedir}' 'Libs: -L$${libdir} -l42mars' > $(DESTDIR)$(LIBDIR)/pkgconfig/42mars.pc

# The tree under $(PREFIX) of an install: unpacked there, pkg-config finds
# the library as it is (elsewhere: pkg-config --define-prefix).
dist: all
	rm -rf build/stage build/$(DIST) build/$(DIST).tar.gz
	$(MAKE) install DESTDIR=$(CURDIR)/build/stage
	mv build/stage$(PREFIX) build/$(DIST)
	install -m 644 LICENSE build/$(DIST)/
	cd build && tar -czf $(DIST).tar.gz $(DIST)
	rm -rf build/stage build/$(DIST)

# Fuzz targets: AFL++ or libFuzzer (clang only; FUZZ_CC=clang-22 picks
# another one).
AFL ?= $(patsubst %/,%,$(dir $(shell command -v afl-fuzz 2>/dev/null)))
FUZZ_ENGINE ?= $(if $(AFL),afl,libfuzzer)
FUZZ_CC ?= clang
FUZZ_SECONDS ?= 60
FUZZ_JOBS ?= $(shell sh test/fuzz/cores.sh)
FUZZ_TARGETS := fuzz_asm fuzz_eval fuzz_make

build/fuzz/%: test/fuzz/%.c $(LIB_SOURCES)
	@mkdir -p build/fuzz
	$(FUZZ_CC) -g -O1 -fsanitize=fuzzer,address,undefined -fno-sanitize-recover=undefined -Ilib -o $@ $< lib/42mars.c

ifeq ($(FUZZ_ENGINE),afl)
fuzz:
	sh test/fuzz/afl.sh $(AFL) $(FUZZ_SECONDS) $(FUZZ_JOBS) $(FUZZ_TARGETS)
else
fuzz: $(addprefix build/fuzz/,$(FUZZ_TARGETS))
	sh test/fuzz/run.sh $(FUZZ_SECONDS) $(FUZZ_JOBS) $(FUZZ_TARGETS)
endif

clean:
	rm -rf build

.PHONY: all test test-lib install dist fuzz clean
