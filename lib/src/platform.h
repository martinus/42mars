// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Everything that differs between compilers, in one place. The rest of
// lib/src is C11. Three cases:
// - gcc and clang (also clang for wasm32, without libc): attributes and
//   builtins, which the hot loops of mars.c were tuned with
// - MSVC (cl): its spellings of inlining, and memcpy from the C library
// - anything else, or -DM42_PORTABLE (to check the C11 part with gcc or
//   clang -pedantic): plain C11

#ifndef M42_PLATFORM_H
#define M42_PLATFORM_H

#include <stddef.h>
#include <stdint.h>

typedef unsigned char u8;
typedef unsigned short u16;
typedef unsigned int u32;
typedef int i32;
typedef long long i64;
typedef unsigned long long u64;
typedef size_t usize; // pointer-sized also on 64-bit Windows, where long is 32 bits

#if (defined(__GNUC__) || defined(__clang__)) && !defined(M42_PORTABLE)

#define M42_FORCE_INLINE static inline __attribute__((always_inline))
#define M42_NOINLINE __attribute__((noinline))
#define LIKELY(x) __builtin_expect(!!(x), 1)
#define UNLIKELY(x) __builtin_expect(!!(x), 0)
// Emitted where defined (see the static arrays in mars.c).
#define M42_USED __attribute__((used))
// The wasm build has no libc: these are the compiler's.
#define m42_memcpy __builtin_memcpy
#define m42_memset __builtin_memset
#define m42_add_overflow __builtin_add_overflow
#define m42_sub_overflow __builtin_sub_overflow
// A build without optimization gets the 16 cases of MSVC (M42_DISPATCH_16
// below, dispatch.h): M42_FORCE_INLINE copies the whole generic code into
// every case then: gcc -O0 took 18 s for the library with 64 cases and 3.6 s
// with 16, clang 4.4 s and 0.9 s.
#ifndef __OPTIMIZE__
#define M42_DISPATCH_16
#endif

// Hides a value from the optimizer (asm.c, umulh()).
#define M42_OPAQUE(x) __asm__("" : "+r"(x))
// The same for clang only, and for the wasm build only: where the
// optimizer's rewrite of a value made the loops of mars.c slower with that
// compiler and the others lose by hiding it (execute2(), step()).
#ifdef __clang__
#define M42_OPAQUE_CLANG(x) M42_OPAQUE(x)
#else
#define M42_OPAQUE_CLANG(x) ((void)0)
#endif
#ifdef __wasm__
#define M42_OPAQUE_WASM(x) M42_OPAQUE(x)
#else
#define M42_OPAQUE_WASM(x) ((void)0)
#endif
#ifdef __clang__
// clang turns the loop of a strlen() into a call to strlen.
#define M42_NO_BUILTIN_STRLEN __attribute__((no_builtin("strlen")))
#else
#define M42_NO_BUILTIN_STRLEN
#endif

#else // MSVC or plain C11

#include <string.h>
#if defined(_MSC_VER) && !defined(M42_PORTABLE)
#define M42_FORCE_INLINE static __forceinline
#define M42_NOINLINE __declspec(noinline)
// Only the 16 most executed instruction words get a case in step() (mars.c,
// dispatch.h). cl /O2 takes superlinear time in the size of the loops of
// execute2(): 141 s for lib/42mars.c with 32 cases, 37 s with 16, and the
// program was as fast (docs/performance-log.md). That was measured with
// the generic code inside the loops; since the sixth round it is a function
// of its own, and nobody has timed cl with more cases since.
#define M42_DISPATCH_16
#else
#define M42_FORCE_INLINE static inline
#define M42_NOINLINE
#endif
#define LIKELY(x) (x)
#define UNLIKELY(x) (x)
#define M42_USED
#define m42_memcpy memcpy
#define m42_memset memset
#define M42_OPAQUE(x) ((void)0)
#define M42_OPAQUE_CLANG(x) ((void)0)
#define M42_OPAQUE_WASM(x) ((void)0)
#define M42_NO_BUILTIN_STRLEN

// a + b and a - b with wraparound into *r; 1 on overflow.
static inline int m42_add_overflow(long long a, long long b, long long *r) {
  *r = (long long)((unsigned long long)a + (unsigned long long)b);
  return (a >= 0) == (b >= 0) && (*r >= 0) != (a >= 0);
}
static inline int m42_sub_overflow(long long a, long long b, long long *r) {
  *r = (long long)((unsigned long long)a - (unsigned long long)b);
  return (a >= 0) != (b >= 0) && (*r >= 0) != (a >= 0);
}

#endif

// The functions of 42mars.h are the exports of the WebAssembly module
// (those of a Windows DLL: M42_API in 42mars.h). Natively every function
// that is not static is one of them.
#ifdef __wasm__
#define EXPORT(name) __attribute__((export_name(#name)))
#else
#define EXPORT(name)
#endif

// 64-byte aligned memory for m42_new() (api.c): C11's aligned_alloc, which
// the Windows C libraries do not have.
#ifndef M42_NO_LIBC
#ifdef _WIN32
#include <malloc.h>
#define m42_aligned_alloc(align, size) _aligned_malloc((size), (align))
#define m42_aligned_free _aligned_free
#else
#include <stdlib.h>
#define m42_aligned_alloc aligned_alloc
#define m42_aligned_free free
#endif
#endif

#endif
